/**
 * Room Manager - Manages room state and SFU coordination
 */

import { logger } from '../utils/logger.js';
import { SFUManager } from './SFUManager.js';
import { RedisService } from './RedisService.js';
import { AuthenticatedUser } from './AuthService.js';
import { ParticipantInfo } from '../types/signaling.js';

interface RoomParticipant {
  id: string;
  odUserId: string;
  displayName: string;
  role: string;
  rtpCapabilities?: any;
  sendTransportId?: string;
  recvTransportId?: string;
  producers: Map<string, ProducerState>;
  consumers: Map<string, ConsumerState>;
}

interface ProducerState {
  id: string;
  kind: 'audio' | 'video';
  source: string;
  paused: boolean;
}

interface ConsumerState {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  paused: boolean;
}

interface RoomState {
  id: string;
  sfuNode: string;
  routerId: string;
  routerRtpCapabilities: any;
  participants: Map<string, RoomParticipant>;
  createdAt: Date;
}

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  constructor(
    private sfuManager: SFUManager,
    private redisService: RedisService
  ) {}

  async joinRoom(
    roomId: string,
    user: AuthenticatedUser,
    role: string,
    displayName: string
  ): Promise<{
    participantId: string;
    routerRtpCapabilities: any;
    sfuNode: string;
  }> {
    let room = this.rooms.get(roomId);

    if (!room) {
      // Allocate room to SFU
      const allocation = await this.sfuManager.allocateRoom(roomId);

      room = {
        id: roomId,
        sfuNode: allocation.node,
        routerId: allocation.routerId,
        routerRtpCapabilities: {}, // Would come from SFU
        participants: new Map(),
        createdAt: new Date(),
      };

      this.rooms.set(roomId, room);
    }

    // Create participant
    const participantId = `p-${user.id}-${Date.now()}`;
    const participant: RoomParticipant = {
      id: participantId,
      odUserId: user.id,
      displayName,
      role,
      producers: new Map(),
      consumers: new Map(),
    };

    room.participants.set(participantId, participant);

    logger.info(
      { roomId, participantId, userId: user.id, role },
      'Participant joined room'
    );

    return {
      participantId,
      routerRtpCapabilities: room.routerRtpCapabilities,
      sfuNode: room.sfuNode,
    };
  }

  async leaveRoom(roomId: string, participantId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.delete(participantId);

    // Clean up room if empty
    if (room.participants.size === 0) {
      await this.sfuManager.releaseRoom(roomId);
      this.rooms.delete(roomId);
      logger.info({ roomId }, 'Room closed - no participants');
    }
  }

  async setParticipantRtpCapabilities(
    roomId: string,
    participantId: string,
    rtpCapabilities: any
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(participantId);
    if (participant) {
      participant.rtpCapabilities = rtpCapabilities;
    }
  }

  async getParticipants(roomId: string): Promise<ParticipantInfo[]> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return Array.from(room.participants.values()).map((p) => ({
      id: p.id,
      odUserId: p.odUserId,
      displayName: p.displayName,
      role: p.role,
      producers: Array.from(p.producers.values()).map((prod) => ({
        id: prod.id,
        kind: prod.kind,
        source: prod.source as 'camera' | 'microphone' | 'screen',
      })),
    }));
  }

  async createTransport(
    roomId: string,
    participantId: string,
    direction: 'send' | 'recv',
    sctpCapabilities?: any
  ): Promise<any> {
    // In production, this would call the SFU node API
    const transportId = `transport-${direction}-${participantId}-${Date.now()}`;

    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(participantId);

    if (participant) {
      if (direction === 'send') {
        participant.sendTransportId = transportId;
      } else {
        participant.recvTransportId = transportId;
      }
    }

    // Mock transport data - in production this comes from SFU
    return {
      id: transportId,
      iceParameters: { usernameFragment: 'mock', password: 'mock' },
      iceCandidates: [],
      dtlsParameters: { fingerprints: [], role: 'auto' },
      sctpParameters: sctpCapabilities ? {} : undefined,
    };
  }

  async connectTransport(
    roomId: string,
    transportId: string,
    dtlsParameters: any
  ): Promise<void> {
    // In production, this would call the SFU node API
    logger.debug({ roomId, transportId }, 'Transport connected');
  }

  async produce(
    roomId: string,
    participantId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: any,
    appData?: any
  ): Promise<{ id: string }> {
    const producerId = `producer-${kind}-${participantId}-${Date.now()}`;

    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(participantId);

    if (participant) {
      participant.producers.set(producerId, {
        id: producerId,
        kind,
        source: appData?.source || kind,
        paused: false,
      });
    }

    return { id: producerId };
  }

  async consume(
    roomId: string,
    participantId: string,
    producerId: string,
    rtpCapabilities: any
  ): Promise<any | null> {
    const consumerId = `consumer-${producerId}-${participantId}-${Date.now()}`;

    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(participantId);

    if (participant) {
      participant.consumers.set(consumerId, {
        id: consumerId,
        producerId,
        kind: 'video', // Would come from producer
        paused: true,
      });
    }

    // Mock consumer data
    return {
      id: consumerId,
      producerId,
      kind: 'video',
      rtpParameters: {},
      appData: {},
    };
  }

  async resumeConsumer(roomId: string, consumerId: string): Promise<void> {
    // In production, call SFU API
    logger.debug({ roomId, consumerId }, 'Consumer resumed');
  }

  async pauseProducer(roomId: string, producerId: string): Promise<void> {
    logger.debug({ roomId, producerId }, 'Producer paused');
  }

  async resumeProducer(roomId: string, producerId: string): Promise<void> {
    logger.debug({ roomId, producerId }, 'Producer resumed');
  }

  async closeProducer(roomId: string, producerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const participant of room.participants.values()) {
      participant.producers.delete(producerId);
    }

    logger.debug({ roomId, producerId }, 'Producer closed');
  }

  async setPreferredLayers(
    roomId: string,
    consumerId: string,
    spatialLayer: number,
    temporalLayer?: number
  ): Promise<void> {
    logger.debug(
      { roomId, consumerId, spatialLayer, temporalLayer },
      'Preferred layers set'
    );
  }

  async getRouterRtpCapabilities(roomId: string): Promise<any> {
    const room = this.rooms.get(roomId);
    return room?.routerRtpCapabilities || {};
  }

  async shutdown(): Promise<void> {
    for (const [roomId] of this.rooms) {
      await this.sfuManager.releaseRoom(roomId);
    }
    this.rooms.clear();
    logger.info('Room manager shut down');
  }
}
