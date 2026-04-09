/**
 * Room Manager - Manages room state and mediasoup SFU via HTTP control API
 */

import { logger } from '../utils/logger.js';
import { SFUManager } from './SFUManager.js';
import { RedisService } from './RedisService.js';
import { AuthenticatedUser } from './AuthService.js';
import { ParticipantInfo } from '../types/signaling.js';
import { sfuFetch } from '../utils/sfuHttp.js';

interface RoomParticipant {
  id: string;
  odUserId: string;
  displayName: string;
  role: string;
  rtpCapabilities?: unknown;
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
  sfuHttpOrigin: string;
  routerId: string;
  routerRtpCapabilities: unknown;
  participants: Map<string, RoomParticipant>;
  createdAt: Date;
}

/** SFU HTTP response shape for create transport */
export interface SfuTransportCreated {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown[];
  dtlsParameters: unknown;
  sctpParameters?: unknown;
}

/** SFU HTTP response shape for create consumer */
export interface SfuConsumerCreated {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: unknown;
  appData: unknown;
}

/** SFU HTTP response shape for create data producer */
export interface SfuDataProducerCreated {
  id: string;
  sctpStreamParameters: unknown;
  label: string;
  protocol: string;
  appData: unknown;
}

/** SFU HTTP response shape for create data consumer */
export interface SfuDataConsumerCreated {
  id: string;
  dataProducerId: string;
  sctpStreamParameters: unknown;
  label: string;
  protocol: string;
  appData: unknown;
}

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  constructor(
    private sfuManager: SFUManager,
    private redisService: RedisService
  ) {}

  private async restoreRoomFromCluster(roomId: string): Promise<RoomState | null> {
    const rec = await this.redisService.getRoomRouter(roomId);
    if (!rec?.httpOrigin || !rec.routerId) return null;

    const room: RoomState = {
      id: roomId,
      sfuNode: rec.httpOrigin.replace(/^https?:\/\//, '').split('/')[0] ?? '',
      sfuHttpOrigin: rec.httpOrigin,
      routerId: rec.routerId,
      routerRtpCapabilities: rec.rtpCapabilities ?? {},
      participants: new Map(),
      createdAt: new Date(),
    };
    this.rooms.set(roomId, room);
    logger.info({ roomId }, 'Restored room state from Redis');
    return room;
  }

  async joinRoom(
    roomId: string,
    user: AuthenticatedUser,
    role: string,
    displayName: string
  ): Promise<{
    participantId: string;
    routerRtpCapabilities: unknown;
    sfuNode: string;
  }> {
    let room: RoomState | null | undefined = this.rooms.get(roomId);

    if (room === undefined) {
      room = await this.restoreRoomFromCluster(roomId);
    }

    if (!room) {
      const allocation = await this.sfuManager.allocateRoom(roomId);

      room = {
        id: roomId,
        sfuNode: allocation.node,
        sfuHttpOrigin: allocation.httpOrigin,
        routerId: allocation.routerId,
        routerRtpCapabilities: allocation.rtpCapabilities,
        participants: new Map(),
        createdAt: new Date(),
      };

      this.rooms.set(roomId, room);
    }

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

    if (room.participants.size === 0) {
      await this.sfuManager.releaseRoom(roomId);
      this.rooms.delete(roomId);
      logger.info({ roomId }, 'Room closed - no participants');
    }
  }

  async setParticipantRtpCapabilities(
    roomId: string,
    participantId: string,
    rtpCapabilities: unknown
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

  private getRoomOrThrow(roomId: string): RoomState {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    return room;
  }

  async createTransport(
    roomId: string,
    participantId: string,
    direction: 'send' | 'recv',
    sctpCapabilities?: unknown
  ): Promise<SfuTransportCreated> {
    const room = this.getRoomOrThrow(roomId);
    const participant = room.participants.get(participantId);
    if (!participant) throw new Error('participant not found');

    const t = await sfuFetch<SfuTransportCreated>(room.sfuHttpOrigin, `/api/routers/${encodeURIComponent(room.routerId)}/transports`, {
      method: 'POST',
      body: JSON.stringify({ direction, sctpCapabilities }),
    });

    if (direction === 'send') {
      participant.sendTransportId = t.id;
    } else {
      participant.recvTransportId = t.id;
    }

    return t;
  }

  async connectTransport(
    roomId: string,
    transportId: string,
    dtlsParameters: unknown
  ): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/transports/${encodeURIComponent(transportId)}/connect`,
      {
        method: 'POST',
        body: JSON.stringify({ dtlsParameters }),
      }
    );
  }

  async produce(
    roomId: string,
    participantId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: unknown,
    appData?: unknown
  ): Promise<{ id: string }> {
    const room = this.getRoomOrThrow(roomId);
    const participant = room.participants.get(participantId);
    if (!participant) throw new Error('participant not found');

    const mergedAppData =
      appData && typeof appData === 'object'
        ? { ...(appData as object), participantId }
        : { participantId };

    const p = await sfuFetch<{ id: string }>(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/producers`,
      {
        method: 'POST',
        body: JSON.stringify({
          transportId,
          kind,
          rtpParameters,
          appData: mergedAppData,
        }),
      }
    );

    participant.producers.set(p.id, {
      id: p.id,
      kind,
      source: (mergedAppData as { source?: string }).source || kind,
      paused: false,
    });

    return { id: p.id };
  }

  findProducerKind(roomId: string, producerId: string): 'audio' | 'video' | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (const p of room.participants.values()) {
      const pr = p.producers.get(producerId);
      if (pr) return pr.kind;
    }
    return null;
  }

  async consume(
    roomId: string,
    participantId: string,
    producerId: string,
    rtpCapabilities: unknown
  ): Promise<SfuConsumerCreated | null> {
    const room = this.getRoomOrThrow(roomId);
    const participant = room.participants.get(participantId);
    if (!participant?.recvTransportId) {
      throw new Error('Receive transport not created');
    }

    const c = await sfuFetch<{
      id: string;
      producerId: string;
      kind: 'audio' | 'video';
      rtpParameters: unknown;
      appData: unknown;
    } | null>(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/consumers`,
      {
        method: 'POST',
        body: JSON.stringify({
          transportId: participant.recvTransportId,
          producerId,
          rtpCapabilities,
        }),
      }
    );

    if (!c) return null;

    participant.consumers.set(c.id, {
      id: c.id,
      producerId,
      kind: c.kind,
      paused: true,
    });

    return {
      id: c.id,
      producerId,
      kind: c.kind,
      rtpParameters: c.rtpParameters,
      appData: c.appData,
    };
  }

  async produceData(
    roomId: string,
    participantId: string,
    transportId: string,
    sctpStreamParameters: unknown,
    label: string,
    protocol: string,
    appData?: unknown
  ): Promise<SfuDataProducerCreated> {
    const room = this.getRoomOrThrow(roomId);
    const participant = room.participants.get(participantId);
    if (!participant) throw new Error('participant not found');

    const dp = await sfuFetch<SfuDataProducerCreated>(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/data-producers`,
      {
        method: 'POST',
        body: JSON.stringify({
          transportId,
          sctpStreamParameters,
          label,
          protocol,
          appData,
        }),
      }
    );

    return dp;
  }

  async consumeData(
    roomId: string,
    participantId: string,
    dataProducerId: string
  ): Promise<SfuDataConsumerCreated | null> {
    const room = this.getRoomOrThrow(roomId);
    const participant = room.participants.get(participantId);
    if (!participant?.recvTransportId) {
      throw new Error('Receive transport not created');
    }

    const dc = await sfuFetch<SfuDataConsumerCreated | null>(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/data-consumers`,
      {
        method: 'POST',
        body: JSON.stringify({
          transportId: participant.recvTransportId,
          dataProducerId,
        }),
      }
    );

    return dc;
  }

  async resumeConsumer(roomId: string, consumerId: string): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/consumers/${encodeURIComponent(consumerId)}/resume`,
      { method: 'POST' }
    );
  }

  async pauseProducer(roomId: string, producerId: string): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/producers/${encodeURIComponent(producerId)}/pause`,
      { method: 'POST' }
    );
  }

  async resumeProducer(roomId: string, producerId: string): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/producers/${encodeURIComponent(producerId)}/resume`,
      { method: 'POST' }
    );
  }

  async closeProducer(roomId: string, producerId: string): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/producers/${encodeURIComponent(producerId)}`,
      { method: 'DELETE' }
    );

    for (const participant of room.participants.values()) {
      participant.producers.delete(producerId);
    }
  }

  async setPreferredLayers(
    roomId: string,
    consumerId: string,
    spatialLayer: number,
    temporalLayer?: number
  ): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/consumers/${encodeURIComponent(consumerId)}/layers`,
      {
        method: 'POST',
        body: JSON.stringify({ spatialLayer, temporalLayer }),
      }
    );
  }

  async restartIce(
    roomId: string,
    transportId: string
  ): Promise<unknown> {
    const room = this.getRoomOrThrow(roomId);
    const result = await sfuFetch<{ iceParameters: unknown }>(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/transports/${encodeURIComponent(transportId)}/restart-ice`,
      { method: 'POST' }
    );
    return result.iceParameters;
  }

  async setMaxIncomingBitrate(
    roomId: string,
    transportId: string,
    bitrate: number
  ): Promise<void> {
    const room = this.getRoomOrThrow(roomId);
    await sfuFetch(
      room.sfuHttpOrigin,
      `/api/routers/${encodeURIComponent(room.routerId)}/transports/${encodeURIComponent(transportId)}/max-bitrate`,
      {
        method: 'POST',
        body: JSON.stringify({ bitrate }),
      }
    );
  }

  async getRouterRtpCapabilities(roomId: string): Promise<unknown> {
    const room = this.rooms.get(roomId);
    return room?.routerRtpCapabilities || {};
  }

  getRoomRouterId(roomId: string): string | undefined {
    return this.rooms.get(roomId)?.routerId;
  }

  /** Drop in-memory state and tear down SFU router (Laravel close room). */
  async destroyRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    await this.sfuManager.releaseRoom(roomId);
  }

  async shutdown(): Promise<void> {
    for (const [roomId] of this.rooms) {
      await this.sfuManager.releaseRoom(roomId);
    }
    this.rooms.clear();
    logger.info('Room manager shut down');
  }
}
