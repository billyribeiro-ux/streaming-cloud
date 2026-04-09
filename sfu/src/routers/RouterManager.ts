/**
 * Router Manager - Manages Mediasoup Routers
 *
 * Each room gets its own router for media isolation
 * Handles transport creation, producer/consumer management
 */

import { types as MediasoupTypes } from 'mediasoup';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { WorkerManager } from '../workers/WorkerManager.js';
import { RedisService } from '../services/RedisService.js';
import { mediaCodecs, webRtcTransportOptions } from '../config/mediasoup.js';

interface RoomRouter {
  id: string;
  roomId: string;
  router: MediasoupTypes.Router;
  worker: MediasoupTypes.Worker;
  transports: Map<string, MediasoupTypes.WebRtcTransport>;
  producers: Map<string, MediasoupTypes.Producer>;
  consumers: Map<string, MediasoupTypes.Consumer>;
  audioLevelObserver: MediasoupTypes.AudioLevelObserver | null;
  createdAt: Date;
}

/** Callback for active speaker events */
export type ActiveSpeakerCallback = (roomId: string, producerId: string, volume: number) => void;

/** Callback for producer/consumer score events */
export type ScoreCallback = (
  roomId: string,
  type: 'producer' | 'consumer',
  id: string,
  score: unknown
) => void;

interface TransportInfo {
  id: string;
  iceParameters: MediasoupTypes.IceParameters;
  iceCandidates: MediasoupTypes.IceCandidate[];
  dtlsParameters: MediasoupTypes.DtlsParameters;
  sctpParameters?: MediasoupTypes.SctpParameters;
}

interface ProducerInfo {
  id: string;
  kind: MediasoupTypes.MediaKind;
  rtpParameters: MediasoupTypes.RtpParameters;
  appData: any;
}

interface ConsumerInfo {
  id: string;
  producerId: string;
  kind: MediasoupTypes.MediaKind;
  rtpParameters: MediasoupTypes.RtpParameters;
  appData: any;
}

export class RouterManager {
  private routers: Map<string, RoomRouter> = new Map();
  private onActiveSpeaker: ActiveSpeakerCallback | null = null;
  private onScore: ScoreCallback | null = null;

  constructor(
    private workerManager: WorkerManager,
    private redisService: RedisService,
    private nodeId: string
  ) {}

  /** Register callback for active speaker events */
  setActiveSpeakerCallback(cb: ActiveSpeakerCallback): void {
    this.onActiveSpeaker = cb;
  }

  /** Register callback for score events */
  setScoreCallback(cb: ScoreCallback): void {
    this.onScore = cb;
  }

  async initialize(): Promise<void> {
    logger.info('Router manager initialized');
  }

  /**
   * Create a router for a room
   */
  async createRouter(roomId: string): Promise<{
    routerId: string;
    rtpCapabilities: MediasoupTypes.RtpCapabilities;
  }> {
    // Check if router already exists for this room
    const existingRouter = Array.from(this.routers.values()).find(
      (r) => r.roomId === roomId
    );

    if (existingRouter) {
      return {
        routerId: existingRouter.id,
        rtpCapabilities: existingRouter.router.rtpCapabilities,
      };
    }

    // Get least loaded worker
    const worker = this.workerManager.getLeastLoadedWorker();

    // Create router with media codecs
    const router = await worker.createRouter({ mediaCodecs });

    const routerId = uuidv4();

    // Create AudioLevelObserver for speaker detection
    let audioLevelObserver: MediasoupTypes.AudioLevelObserver | null = null;
    try {
      audioLevelObserver = await router.createAudioLevelObserver({
        maxEntries: 1,
        threshold: -50,
        interval: 800,
      });

      audioLevelObserver.on('volumes', (volumes) => {
        if (volumes.length > 0 && this.onActiveSpeaker) {
          const { producer, volume } = volumes[0];
          this.onActiveSpeaker(roomId, producer.id, volume);
        }
      });

      audioLevelObserver.on('silence', () => {
        // Optionally notify about silence
      });

      logger.debug({ roomId, routerId }, 'AudioLevelObserver created');
    } catch (err) {
      logger.warn({ roomId, err }, 'Failed to create AudioLevelObserver');
    }

    const roomRouter: RoomRouter = {
      id: routerId,
      roomId,
      router,
      worker,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      audioLevelObserver,
      createdAt: new Date(),
    };

    this.routers.set(routerId, roomRouter);
    this.workerManager.incrementRouterCount(worker);

    // Register router in Redis
    await this.redisService.setRoomRouter(roomId, {
      nodeId: this.nodeId,
      routerId,
    });

    logger.info({ roomId, routerId }, 'Router created for room');

    return {
      routerId,
      rtpCapabilities: router.rtpCapabilities,
    };
  }

  /**
   * Get router by ID
   */
  getRouter(routerId: string): RoomRouter | undefined {
    return this.routers.get(routerId);
  }

  /**
   * Get router by room ID
   */
  getRouterByRoomId(roomId: string): RoomRouter | undefined {
    return Array.from(this.routers.values()).find((r) => r.roomId === roomId);
  }

  /**
   * Create WebRTC transport for a participant
   */
  async createTransport(
    routerId: string,
    direction: 'send' | 'recv',
    sctpCapabilities?: MediasoupTypes.SctpCapabilities
  ): Promise<TransportInfo> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) {
      throw new Error(`Router not found: ${routerId}`);
    }

    const transport = await roomRouter.router.createWebRtcTransport({
      ...webRtcTransportOptions,
      enableSctp: !!sctpCapabilities,
      numSctpStreams: sctpCapabilities?.numStreams,
      appData: { direction },
    });

    // Set up transport event handlers
    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'failed' || dtlsState === 'closed') {
        logger.warn(
          { transportId: transport.id, dtlsState },
          'Transport DTLS state changed'
        );
      }
    });

    transport.on('icestatechange', (iceState) => {
      if (iceState === 'disconnected' || iceState === 'closed') {
        logger.warn(
          { transportId: transport.id, iceState },
          'Transport ICE state changed'
        );
      }
    });

    roomRouter.transports.set(transport.id, transport);

    logger.debug(
      { transportId: transport.id, routerId, direction },
      'Transport created'
    );

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  /**
   * Connect transport (complete ICE/DTLS handshake)
   */
  async connectTransport(
    routerId: string,
    transportId: string,
    dtlsParameters: MediasoupTypes.DtlsParameters
  ): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) {
      throw new Error(`Router not found: ${routerId}`);
    }

    const transport = roomRouter.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    await transport.connect({ dtlsParameters });

    logger.debug({ transportId }, 'Transport connected');
  }

  /**
   * Create a producer on a transport
   */
  async produce(
    routerId: string,
    transportId: string,
    kind: MediasoupTypes.MediaKind,
    rtpParameters: MediasoupTypes.RtpParameters,
    appData?: any
  ): Promise<ProducerInfo> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) {
      throw new Error(`Router not found: ${routerId}`);
    }

    const transport = roomRouter.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: appData || {},
    });

    producer.on('transportclose', () => {
      logger.debug({ producerId: producer.id }, 'Producer transport closed');
      roomRouter.producers.delete(producer.id);
    });

    producer.on('score', (score) => {
      logger.debug({ producerId: producer.id, score }, 'Producer score');
      if (this.onScore) {
        this.onScore(roomRouter.roomId, 'producer', producer.id, score);
      }
    });

    roomRouter.producers.set(producer.id, producer);

    // Add audio producers to the AudioLevelObserver for speaker detection
    if (kind === 'audio' && roomRouter.audioLevelObserver) {
      try {
        await roomRouter.audioLevelObserver.addProducer({ producerId: producer.id });
        logger.debug({ producerId: producer.id }, 'Producer added to AudioLevelObserver');
      } catch (err) {
        logger.warn({ producerId: producer.id, err }, 'Failed to add producer to AudioLevelObserver');
      }
    }

    logger.info(
      { producerId: producer.id, kind, routerId },
      'Producer created'
    );

    return {
      id: producer.id,
      kind: producer.kind,
      rtpParameters: producer.rtpParameters,
      appData: producer.appData,
    };
  }

  /**
   * Create a consumer for a producer
   */
  async consume(
    routerId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: MediasoupTypes.RtpCapabilities
  ): Promise<ConsumerInfo | null> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) {
      throw new Error(`Router not found: ${routerId}`);
    }

    const transport = roomRouter.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const producer = roomRouter.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer not found: ${producerId}`);
    }

    // Check if router can consume
    if (
      !roomRouter.router.canConsume({
        producerId,
        rtpCapabilities,
      })
    ) {
      logger.warn(
        { producerId, routerId },
        'Cannot consume - incompatible RTP capabilities'
      );
      return null;
    }

    // Audio gets higher priority than video to ensure voice never degrades
    const priority = producer.kind === 'audio' ? 2 : 1;

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, client will resume
      appData: producer.appData,
      priority,
    });

    consumer.on('transportclose', () => {
      logger.debug({ consumerId: consumer.id }, 'Consumer transport closed');
      roomRouter.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      logger.debug({ consumerId: consumer.id }, 'Consumer producer closed');
      roomRouter.consumers.delete(consumer.id);
    });

    consumer.on('score', (score) => {
      logger.debug({ consumerId: consumer.id, score }, 'Consumer score');
      if (this.onScore) {
        this.onScore(roomRouter.roomId, 'consumer', consumer.id, score);
      }
    });

    roomRouter.consumers.set(consumer.id, consumer);

    logger.debug(
      { consumerId: consumer.id, producerId, kind: consumer.kind },
      'Consumer created'
    );

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      appData: consumer.appData,
    };
  }

  /**
   * Resume a consumer
   */
  async resumeConsumer(routerId: string, consumerId: string): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return;

    const consumer = roomRouter.consumers.get(consumerId);
    if (!consumer) return;

    await consumer.resume();
    logger.debug({ consumerId }, 'Consumer resumed');
  }

  /**
   * Pause a producer
   */
  async pauseProducer(routerId: string, producerId: string): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return;

    const producer = roomRouter.producers.get(producerId);
    if (!producer) return;

    await producer.pause();
    logger.debug({ producerId }, 'Producer paused');
  }

  /**
   * Resume a producer
   */
  async resumeProducer(routerId: string, producerId: string): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return;

    const producer = roomRouter.producers.get(producerId);
    if (!producer) return;

    await producer.resume();
    logger.debug({ producerId }, 'Producer resumed');
  }

  /**
   * Close a producer
   */
  async closeProducer(routerId: string, producerId: string): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return;

    const producer = roomRouter.producers.get(producerId);
    if (!producer) return;

    producer.close();
    roomRouter.producers.delete(producerId);
    logger.debug({ producerId }, 'Producer closed');
  }

  /**
   * Restart ICE on a transport (for network recovery without full re-negotiation)
   */
  async restartIce(
    routerId: string,
    transportId: string
  ): Promise<MediasoupTypes.IceParameters> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) {
      throw new Error(`Router not found: ${routerId}`);
    }

    const transport = roomRouter.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    const iceParameters = await transport.restartIce();
    logger.info({ transportId, routerId }, 'ICE restarted');
    return iceParameters;
  }

  /**
   * Set preferred layers for simulcast
   */
  async setPreferredLayers(
    routerId: string,
    consumerId: string,
    spatialLayer: number,
    temporalLayer?: number
  ): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return;

    const consumer = roomRouter.consumers.get(consumerId);
    if (!consumer) return;

    await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
    logger.debug(
      { consumerId, spatialLayer, temporalLayer },
      'Preferred layers set'
    );
  }

  /**
   * Close a router and clean up all resources
   */
  async closeRouter(routerId: string): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return;

    // Close all consumers
    for (const consumer of roomRouter.consumers.values()) {
      consumer.close();
    }

    // Close all producers
    for (const producer of roomRouter.producers.values()) {
      producer.close();
    }

    // Close all transports
    for (const transport of roomRouter.transports.values()) {
      transport.close();
    }

    // Close router
    roomRouter.router.close();

    // Update worker count
    this.workerManager.decrementRouterCount(roomRouter.worker);

    // Remove from Redis
    await this.redisService.deleteRoomRouter(roomRouter.roomId);

    // Remove from local map
    this.routers.delete(routerId);

    logger.info({ routerId, roomId: roomRouter.roomId }, 'Router closed');
  }

  /**
   * Set max incoming bitrate on a transport to cap per-transport bandwidth
   */
  async setMaxIncomingBitrate(
    routerId: string,
    transportId: string,
    bitrate: number
  ): Promise<void> {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) {
      throw new Error(`Router not found: ${routerId}`);
    }

    const transport = roomRouter.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport not found: ${transportId}`);
    }

    await transport.setMaxIncomingBitrate(bitrate);
    logger.info(
      { routerId, transportId, bitrate },
      'Max incoming bitrate set on transport'
    );
  }

  getRouterCount(): number {
    return this.routers.size;
  }

  getRtpCapabilities(routerId: string): MediasoupTypes.RtpCapabilities | null {
    const roomRouter = this.routers.get(routerId);
    return roomRouter?.router.rtpCapabilities || null;
  }

  /**
   * Get all producers in a room
   */
  getProducers(routerId: string): ProducerInfo[] {
    const roomRouter = this.routers.get(routerId);
    if (!roomRouter) return [];

    return Array.from(roomRouter.producers.values()).map((p) => ({
      id: p.id,
      kind: p.kind,
      rtpParameters: p.rtpParameters,
      appData: p.appData,
    }));
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down router manager...');

    for (const [routerId] of this.routers) {
      await this.closeRouter(routerId);
    }

    logger.info('Router manager shut down');
  }
}
