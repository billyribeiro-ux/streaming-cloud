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
  createdAt: Date;
}

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

  constructor(
    private workerManager: WorkerManager,
    private redisService: RedisService,
    private nodeId: string
  ) {}

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

    const roomRouter: RoomRouter = {
      id: routerId,
      roomId,
      router,
      worker,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
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
      if (iceState === 'disconnected' || iceState === 'failed') {
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
    });

    roomRouter.producers.set(producer.id, producer);

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

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, client will resume
      appData: producer.appData,
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
