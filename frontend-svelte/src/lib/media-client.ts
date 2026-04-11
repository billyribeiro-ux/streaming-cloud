/**
 * MediaClient - Framework-agnostic mediasoup-client wrapper
 *
 * Wraps mediasoup-client Device, Transports, Producers, Consumers.
 * Uses SignalingClient for signaling. Pure TypeScript, no framework dependency.
 */

import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
  RtpCapabilities,
  DtlsParameters,
  RtpParameters,
  MediaKind,
  AppData,
  ConnectionState,
} from 'mediasoup-client/types';
import type { SignalingClient } from './signaling';

export type MediaClientEvent =
  | 'consumer-added'
  | 'consumer-removed'
  | 'producer-added'
  | 'producer-removed'
  | 'transport-state-change'
  | 'error';

export type MediaClientHandler = (data: any) => void;

export interface ConsumerInfo {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  track: MediaStreamTrack;
  participantId: string;
}

export class MediaClient {
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers = new Map<string, Producer>();
  private consumers = new Map<string, Consumer>();
  private consumerInfos = new Map<string, ConsumerInfo>();
  private signaling: SignalingClient;
  private listeners = new Map<string, Set<MediaClientHandler>>();

  // Pending transport-created resolvers: direction -> resolver
  private pendingTransportCreated = new Map<
    string,
    (data: any) => void
  >();

  constructor(signaling: SignalingClient) {
    this.signaling = signaling;
  }

  get rtpCapabilities(): RtpCapabilities | undefined {
    return this.device?.rtpCapabilities;
  }

  get allConsumers(): Map<string, ConsumerInfo> {
    return new Map(this.consumerInfos);
  }

  async initDevice(rtpCapabilities: RtpCapabilities): Promise<void> {
    const device = new Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    this.device = device;
  }

  async createSendTransport(options: {
    transportId: string;
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: any;
    sctpParameters?: any;
  }): Promise<void> {
    if (!this.device) throw new Error('Device not initialized');

    const transport = this.device.createSendTransport({
      id: options.transportId,
      iceParameters: options.iceParameters,
      iceCandidates: options.iceCandidates,
      dtlsParameters: options.dtlsParameters,
      sctpParameters: options.sctpParameters,
    });

    this.sendTransport = transport;

    transport.on(
      'connect',
      async (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
        errback: (error: Error) => void,
      ) => {
        try {
          this.signaling.send({
            event: 'connect-transport',
            data: { transportId: options.transportId, dtlsParameters },
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      },
    );

    transport.on(
      'produce',
      async (
        {
          kind,
          rtpParameters,
          appData,
        }: {
          kind: MediaKind;
          rtpParameters: RtpParameters;
          appData: AppData;
        },
        callback: (result: { id: string }) => void,
        errback: (error: Error) => void,
      ) => {
        try {
          this.signaling.send({
            event: 'produce',
            data: {
              transportId: options.transportId,
              kind,
              rtpParameters,
              appData,
            },
          });

          // Wait for produced event
          const producerId = await this.waitForProducerId();
          callback({ id: producerId });
        } catch (err) {
          errback(err as Error);
        }
      },
    );

    transport.on('connectionstatechange', (state: ConnectionState) => {
      console.log(`Transport send connection state: ${state}`);
      this.emit('transport-state-change', { direction: 'send', state });
      if (state === 'failed') {
        transport.close();
      }
    });
  }

  async createRecvTransport(options: {
    transportId: string;
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: any;
    sctpParameters?: any;
  }): Promise<void> {
    if (!this.device) throw new Error('Device not initialized');

    const transport = this.device.createRecvTransport({
      id: options.transportId,
      iceParameters: options.iceParameters,
      iceCandidates: options.iceCandidates,
      dtlsParameters: options.dtlsParameters,
      sctpParameters: options.sctpParameters,
    });

    this.recvTransport = transport;

    transport.on(
      'connect',
      async (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
        errback: (error: Error) => void,
      ) => {
        try {
          this.signaling.send({
            event: 'connect-transport',
            data: { transportId: options.transportId, dtlsParameters },
          });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      },
    );

    transport.on('connectionstatechange', (state: ConnectionState) => {
      console.log(`Transport recv connection state: ${state}`);
      this.emit('transport-state-change', { direction: 'recv', state });
      if (state === 'failed') {
        transport.close();
      }
    });
  }

  async produce(
    track: MediaStreamTrack,
    encodings?: any[],
    codecOptions?: any,
    appData?: AppData,
  ): Promise<Producer> {
    if (!this.sendTransport) throw new Error('Send transport not created');

    const producer = await this.sendTransport.produce({
      track,
      encodings,
      codecOptions,
      appData,
    });

    const source = (appData as any)?.source || track.kind;
    this.producers.set(source, producer);
    this.emit('producer-added', { source, producerId: producer.id });

    return producer;
  }

  async consume(params: {
    consumerId: string;
    producerId: string;
    kind: 'audio' | 'video';
    rtpParameters: any;
    appData?: any;
  }): Promise<Consumer> {
    if (!this.recvTransport) throw new Error('Recv transport not created');

    const consumer = await this.recvTransport.consume({
      id: params.consumerId,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters,
      appData: params.appData,
    });

    this.consumers.set(params.consumerId, consumer);

    const info: ConsumerInfo = {
      consumerId: params.consumerId,
      producerId: params.producerId,
      kind: params.kind,
      track: consumer.track,
      participantId: params.appData?.participantId || '',
    };
    this.consumerInfos.set(params.consumerId, info);

    // Resume consumer on server
    this.signaling.send({
      event: 'resume-consumer',
      data: { consumerId: params.consumerId },
    });

    this.emit('consumer-added', info);
    return consumer;
  }

  closeProducer(source: string): string | null {
    const producer = this.producers.get(source);
    if (!producer) return null;

    const producerId = producer.id;
    producer.close();
    this.producers.delete(source);

    this.signaling.send({
      event: 'close-producer',
      data: { producerId },
    });

    this.emit('producer-removed', { source, producerId });
    return producerId;
  }

  close(): void {
    // Close all producers
    for (const producer of this.producers.values()) {
      producer.close();
    }
    this.producers.clear();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();
    this.consumerInfos.clear();

    // Close transports
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport = null;
    this.recvTransport = null;
  }

  requestTransport(direction: 'send' | 'recv'): void {
    this.signaling.send({
      event: 'create-transport',
      data: { direction },
    });
  }

  requestConsume(producerId: string): void {
    if (!this.device?.rtpCapabilities) return;
    this.signaling.send({
      event: 'consume',
      data: {
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      },
    });
  }

  // Event emitter

  on(event: string, handler: MediaClientHandler): void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler);
  }

  off(event: string, handler: MediaClientHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private waitForProducerId(): Promise<string> {
    return new Promise((resolve) => {
      this.signaling.once('produced', (message: any) => {
        resolve(message.data?.producerId ?? message.producerId);
      });
    });
  }
}
