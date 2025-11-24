/**
 * Signaling Server - Core WebSocket handler
 *
 * Manages WebSocket connections, authentication, and message routing
 * Implements the signaling protocol for WebRTC connection establishment
 */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { AuthService, AuthenticatedUser } from './AuthService.js';
import { SFUManager } from './SFUManager.js';
import { RedisService } from './RedisService.js';
import { RoomManager } from './RoomManager.js';
import { RateLimiterService } from './RateLimiterService.js';
import {
  SignalingMessage,
  ClientMessage,
  ServerMessage,
  ParticipantInfo,
} from '../types/signaling.js';

interface ConnectedClient {
  id: string;
  socket: WebSocket;
  user: AuthenticatedUser | null;
  roomId: string | null;
  participantId: string | null;
  transportIds: Set<string>;
  producerIds: Set<string>;
  consumerIds: Set<string>;
  lastPing: number;
  ip: string;
}

export class SignalingServer {
  private clients: Map<string, ConnectedClient> = new Map();
  private roomManager: RoomManager;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    private wss: WebSocketServer,
    private authService: AuthService,
    private sfuManager: SFUManager,
    private redisService: RedisService,
    private rateLimiter: RateLimiterService
  ) {
    this.roomManager = new RoomManager(sfuManager, redisService);
  }

  start(): void {
    this.wss.on('connection', this.handleConnection.bind(this));

    // Start ping interval for connection health
    this.pingInterval = setInterval(() => this.pingClients(), 30000);

    logger.info('Signaling server started');
  }

  async shutdown(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      await this.cleanupClient(client);
      client.socket.close(1001, 'Server shutting down');
    }

    this.clients.clear();
    await this.roomManager.shutdown();

    logger.info('Signaling server shut down');
  }

  private async handleConnection(socket: WebSocket, request: any): Promise<void> {
    const clientId = uuidv4();

    // Extract IP address
    const ip =
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.headers['x-real-ip'] ||
      request.socket.remoteAddress ||
      'unknown';

    // Check connection rate limit
    const rateLimitResult = await this.rateLimiter.checkConnection(ip);
    if (!rateLimitResult.allowed) {
      logger.warn({ ip, clientId }, 'Connection rate limit exceeded');
      socket.close(1008, `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}s`);
      return;
    }

    const client: ConnectedClient = {
      id: clientId,
      socket,
      user: null,
      roomId: null,
      participantId: null,
      transportIds: new Set(),
      producerIds: new Set(),
      consumerIds: new Set(),
      lastPing: Date.now(),
      ip,
    };

    this.clients.set(clientId, client);

    logger.info({ clientId, ip }, 'Client connected');

    socket.on('message', async (data) => {
      try {
        // Check message rate limit
        const rateLimitResult = await this.rateLimiter.checkMessage(
          clientId,
          client.user?.id
        );

        if (!rateLimitResult.allowed) {
          logger.warn({ clientId, userId: client.user?.id }, 'Message rate limit exceeded');
          this.sendError(
            client,
            `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}s`,
            'RATE_LIMIT_EXCEEDED'
          );
          return;
        }

        const message = JSON.parse(data.toString()) as ClientMessage;
        await this.handleMessage(client, message);
      } catch (error) {
        logger.error({ error, clientId }, 'Error handling message');
        this.sendError(client, 'Invalid message format');
      }
    });

    socket.on('close', async () => {
      logger.info({ clientId }, 'Client disconnected');
      await this.cleanupClient(client);
      this.clients.delete(clientId);
    });

    socket.on('error', (error) => {
      logger.error({ error, clientId }, 'WebSocket error');
    });

    socket.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Send welcome message
    this.send(client, {
      event: 'welcome',
      data: { clientId, serverTime: Date.now() },
    });
  }

  private async handleMessage(
    client: ConnectedClient,
    message: ClientMessage
  ): Promise<void> {
    logger.debug({ event: message.event, clientId: client.id }, 'Received message');

    switch (message.event) {
      case 'authenticate':
        await this.handleAuthenticate(client, message.data);
        break;

      case 'join-room':
        await this.handleJoinRoom(client, message.data);
        break;

      case 'leave-room':
        await this.handleLeaveRoom(client);
        break;

      case 'create-transport':
        await this.handleCreateTransport(client, message.data);
        break;

      case 'connect-transport':
        await this.handleConnectTransport(client, message.data);
        break;

      case 'produce':
        await this.handleProduce(client, message.data);
        break;

      case 'consume':
        await this.handleConsume(client, message.data);
        break;

      case 'resume-consumer':
        await this.handleResumeConsumer(client, message.data);
        break;

      case 'pause-producer':
        await this.handlePauseProducer(client, message.data);
        break;

      case 'resume-producer':
        await this.handleResumeProducer(client, message.data);
        break;

      case 'close-producer':
        await this.handleCloseProducer(client, message.data);
        break;

      case 'set-preferred-layers':
        await this.handleSetPreferredLayers(client, message.data);
        break;

      case 'get-router-rtp-capabilities':
        await this.handleGetRouterRtpCapabilities(client, message.data);
        break;

      default:
        this.sendError(client, `Unknown event: ${(message as any).event}`);
    }
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  private async handleAuthenticate(
    client: ConnectedClient,
    data: { token: string; organizationId: string; deviceInfo?: any }
  ): Promise<void> {
    try {
      const user = await this.authService.verifyToken(data.token);

      // Verify organization membership
      const isMember = await this.authService.verifyOrganizationMembership(
        user.id,
        data.organizationId
      );

      if (!isMember) {
        this.sendError(client, 'Not a member of this organization', 'AUTH_FAILED');
        return;
      }

      client.user = user;

      this.send(client, {
        event: 'authenticated',
        data: {
          userId: user.id,
          organizationId: data.organizationId,
          permissions: user.permissions,
        },
      });

      logger.info(
        { clientId: client.id, userId: user.id },
        'Client authenticated'
      );
    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Authentication failed');
      this.sendError(client, 'Authentication failed', 'AUTH_FAILED');
    }
  }

  private async handleJoinRoom(
    client: ConnectedClient,
    data: { roomId: string; role: string; displayName: string; rtpCapabilities?: any }
  ): Promise<void> {
    if (!client.user) {
      this.sendError(client, 'Not authenticated', 'NOT_AUTHENTICATED');
      return;
    }

    try {
      // Join the room through room manager
      const roomInfo = await this.roomManager.joinRoom(
        data.roomId,
        client.user,
        data.role,
        data.displayName
      );

      client.roomId = data.roomId;
      client.participantId = roomInfo.participantId;

      // Store RTP capabilities if provided
      if (data.rtpCapabilities) {
        await this.roomManager.setParticipantRtpCapabilities(
          data.roomId,
          roomInfo.participantId,
          data.rtpCapabilities
        );
      }

      // Get existing participants and their producers
      const participants = await this.roomManager.getParticipants(data.roomId);

      this.send(client, {
        event: 'room-joined',
        data: {
          roomId: data.roomId,
          participantId: roomInfo.participantId,
          routerRtpCapabilities: roomInfo.routerRtpCapabilities,
          participants: participants.filter((p) => p.id !== roomInfo.participantId),
          sfuNode: roomInfo.sfuNode,
        },
      });

      // Notify other participants
      await this.broadcastToRoom(data.roomId, client.id, {
        event: 'participant-joined',
        data: {
          participantId: roomInfo.participantId,
          userId: client.user.id,
          displayName: data.displayName,
          role: data.role,
        },
      });

      logger.info(
        { clientId: client.id, roomId: data.roomId, role: data.role },
        'Client joined room'
      );
    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Failed to join room');
      this.sendError(client, 'Failed to join room', 'JOIN_FAILED');
    }
  }

  private async handleLeaveRoom(client: ConnectedClient): Promise<void> {
    if (!client.roomId || !client.participantId) {
      return;
    }

    await this.cleanupClientRoom(client);
  }

  private async handleCreateTransport(
    client: ConnectedClient,
    data: { direction: 'send' | 'recv'; sctpCapabilities?: any }
  ): Promise<void> {
    if (!client.roomId || !client.participantId) {
      this.sendError(client, 'Not in a room', 'NOT_IN_ROOM');
      return;
    }

    try {
      const transport = await this.roomManager.createTransport(
        client.roomId,
        client.participantId,
        data.direction,
        data.sctpCapabilities
      );

      client.transportIds.add(transport.id);

      this.send(client, {
        event: 'transport-created',
        data: {
          transportId: transport.id,
          direction: data.direction,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
          sctpParameters: transport.sctpParameters,
        },
      });

      logger.debug(
        { clientId: client.id, transportId: transport.id, direction: data.direction },
        'Transport created'
      );
    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Failed to create transport');
      this.sendError(client, 'Failed to create transport', 'TRANSPORT_ERROR');
    }
  }

  private async handleConnectTransport(
    client: ConnectedClient,
    data: { transportId: string; dtlsParameters: any }
  ): Promise<void> {
    if (!client.roomId) {
      this.sendError(client, 'Not in a room', 'NOT_IN_ROOM');
      return;
    }

    try {
      await this.roomManager.connectTransport(
        client.roomId,
        data.transportId,
        data.dtlsParameters
      );

      this.send(client, {
        event: 'transport-connected',
        data: { transportId: data.transportId },
      });

      logger.debug(
        { clientId: client.id, transportId: data.transportId },
        'Transport connected'
      );
    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Failed to connect transport');
      this.sendError(client, 'Failed to connect transport', 'TRANSPORT_ERROR');
    }
  }

  private async handleProduce(
    client: ConnectedClient,
    data: {
      transportId: string;
      kind: 'audio' | 'video';
      rtpParameters: any;
      appData?: any;
    }
  ): Promise<void> {
    if (!client.roomId || !client.participantId) {
      this.sendError(client, 'Not in a room', 'NOT_IN_ROOM');
      return;
    }

    try {
      const producer = await this.roomManager.produce(
        client.roomId,
        client.participantId,
        data.transportId,
        data.kind,
        data.rtpParameters,
        data.appData
      );

      client.producerIds.add(producer.id);

      this.send(client, {
        event: 'produced',
        data: { producerId: producer.id },
      });

      // Notify other participants about the new producer
      await this.broadcastToRoom(client.roomId, client.id, {
        event: 'new-producer',
        data: {
          producerId: producer.id,
          producerUserId: client.user!.id,
          participantId: client.participantId,
          kind: data.kind,
          appData: data.appData,
        },
      });

      logger.info(
        { clientId: client.id, producerId: producer.id, kind: data.kind },
        'Producer created'
      );
    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Failed to produce');
      this.sendError(client, 'Failed to produce', 'PRODUCE_ERROR');
    }
  }

  private async handleConsume(
    client: ConnectedClient,
    data: { producerId: string; rtpCapabilities: any }
  ): Promise<void> {
    if (!client.roomId || !client.participantId) {
      this.sendError(client, 'Not in a room', 'NOT_IN_ROOM');
      return;
    }

    try {
      const consumer = await this.roomManager.consume(
        client.roomId,
        client.participantId,
        data.producerId,
        data.rtpCapabilities
      );

      if (!consumer) {
        this.sendError(client, 'Cannot consume this producer', 'CONSUME_ERROR');
        return;
      }

      client.consumerIds.add(consumer.id);

      this.send(client, {
        event: 'consumer-created',
        data: {
          consumerId: consumer.id,
          producerId: data.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          appData: consumer.appData,
        },
      });

      logger.debug(
        { clientId: client.id, consumerId: consumer.id },
        'Consumer created'
      );
    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Failed to consume');
      this.sendError(client, 'Failed to consume', 'CONSUME_ERROR');
    }
  }

  private async handleResumeConsumer(
    client: ConnectedClient,
    data: { consumerId: string }
  ): Promise<void> {
    if (!client.roomId) {
      return;
    }

    try {
      await this.roomManager.resumeConsumer(client.roomId, data.consumerId);

      this.send(client, {
        event: 'consumer-resumed',
        data: { consumerId: data.consumerId },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to resume consumer');
    }
  }

  private async handlePauseProducer(
    client: ConnectedClient,
    data: { producerId: string }
  ): Promise<void> {
    if (!client.roomId) {
      return;
    }

    try {
      await this.roomManager.pauseProducer(client.roomId, data.producerId);

      await this.broadcastToRoom(client.roomId, client.id, {
        event: 'producer-paused',
        data: { producerId: data.producerId },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to pause producer');
    }
  }

  private async handleResumeProducer(
    client: ConnectedClient,
    data: { producerId: string }
  ): Promise<void> {
    if (!client.roomId) {
      return;
    }

    try {
      await this.roomManager.resumeProducer(client.roomId, data.producerId);

      await this.broadcastToRoom(client.roomId, client.id, {
        event: 'producer-resumed',
        data: { producerId: data.producerId },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to resume producer');
    }
  }

  private async handleCloseProducer(
    client: ConnectedClient,
    data: { producerId: string }
  ): Promise<void> {
    if (!client.roomId) {
      return;
    }

    try {
      await this.roomManager.closeProducer(client.roomId, data.producerId);
      client.producerIds.delete(data.producerId);

      await this.broadcastToRoom(client.roomId, client.id, {
        event: 'producer-closed',
        data: { producerId: data.producerId },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to close producer');
    }
  }

  private async handleSetPreferredLayers(
    client: ConnectedClient,
    data: { consumerId: string; spatialLayer: number; temporalLayer?: number }
  ): Promise<void> {
    if (!client.roomId) {
      return;
    }

    try {
      await this.roomManager.setPreferredLayers(
        client.roomId,
        data.consumerId,
        data.spatialLayer,
        data.temporalLayer
      );
    } catch (error) {
      logger.error({ error }, 'Failed to set preferred layers');
    }
  }

  private async handleGetRouterRtpCapabilities(
    client: ConnectedClient,
    data: { roomId: string }
  ): Promise<void> {
    try {
      const capabilities = await this.roomManager.getRouterRtpCapabilities(
        data.roomId
      );

      this.send(client, {
        event: 'router-rtp-capabilities',
        data: { rtpCapabilities: capabilities },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get router RTP capabilities');
      this.sendError(client, 'Failed to get capabilities', 'ERROR');
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private send(client: ConnectedClient, message: ServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  private sendError(
    client: ConnectedClient,
    message: string,
    code?: string
  ): void {
    this.send(client, {
      event: 'error',
      data: { message, code },
    });
  }

  private async broadcastToRoom(
    roomId: string,
    excludeClientId: string,
    message: ServerMessage
  ): Promise<void> {
    for (const client of this.clients.values()) {
      if (client.roomId === roomId && client.id !== excludeClientId) {
        this.send(client, message);
      }
    }
  }

  private async cleanupClient(client: ConnectedClient): Promise<void> {
    await this.cleanupClientRoom(client);

    // Reset rate limiters for this client
    await this.rateLimiter.reset(client.id);
    if (client.user) {
      await this.rateLimiter.reset(client.user.id);
    }
  }

  private async cleanupClientRoom(client: ConnectedClient): Promise<void> {
    if (!client.roomId || !client.participantId) {
      return;
    }

    const roomId = client.roomId;
    const participantId = client.participantId;

    // Close all producers
    for (const producerId of client.producerIds) {
      try {
        await this.roomManager.closeProducer(roomId, producerId);
      } catch (error) {
        logger.error({ error, producerId }, 'Error closing producer');
      }
    }

    // Leave the room
    try {
      await this.roomManager.leaveRoom(roomId, participantId);
    } catch (error) {
      logger.error({ error }, 'Error leaving room');
    }

    // Notify other participants
    await this.broadcastToRoom(roomId, client.id, {
      event: 'participant-left',
      data: {
        participantId,
        userId: client.user?.id,
      },
    });

    // Clear client room state
    client.roomId = null;
    client.participantId = null;
    client.transportIds.clear();
    client.producerIds.clear();
    client.consumerIds.clear();

    logger.info({ clientId: client.id, roomId }, 'Client left room');
  }

  private pingClients(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastPing > timeout) {
        logger.warn({ clientId }, 'Client ping timeout, disconnecting');
        client.socket.terminate();
        continue;
      }

      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.ping();
      }
    }
  }
}
