/**
 * SFU Manager - Manages connections to SFU nodes in the cluster
 */

import { logger } from '../utils/logger.js';
import { RedisService } from './RedisService.js';
import { sfuFetch } from '../utils/sfuHttp.js';

interface SFUConfig {
  nodes: string[];
  secret: string;
}

interface SFUNode {
  id: string;
  host: string;
  port: number;
  isHealthy: boolean;
  load: number;
  lastHealthCheck: Date;
}

export class SFUManager {
  private nodes: Map<string, SFUNode> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private _config: SFUConfig,
    private redisService: RedisService
  ) {}

  async initialize(): Promise<void> {
    for (const nodeStr of this._config.nodes) {
      const [host, portStr] = nodeStr.split(':');
      const port = parseInt(portStr || '4000', 10);
      const nodeId = `sfu-${host}-${port}`;

      this.nodes.set(nodeId, {
        id: nodeId,
        host,
        port,
        isHealthy: true,
        load: 0,
        lastHealthCheck: new Date(),
      });
    }

    this.healthCheckInterval = setInterval(() => this.checkHealth(), 10000);

    logger.info({ nodeCount: this.nodes.size }, 'SFU Manager initialized');
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info('SFU Manager shut down');
  }

  async getBestNode(): Promise<SFUNode | null> {
    const healthyNodes = Array.from(this.nodes.values()).filter((n) => n.isHealthy);

    if (healthyNodes.length === 0) {
      logger.error('No healthy SFU nodes available');
      return null;
    }

    healthyNodes.sort((a, b) => a.load - b.load);
    return healthyNodes[0];
  }

  /**
   * Allocate a room on an SFU node (creates mediasoup router via HTTP).
   */
  async allocateRoom(roomId: string): Promise<{
    node: string;
    routerId: string;
    iceServers: unknown[];
    rtpCapabilities: unknown;
    httpOrigin: string;
  }> {
    const existing = await this.redisService.getRoomRouter(roomId);
    if (existing) {
      return {
        node: existing.httpOrigin.replace(/^https?:\/\//, '').split('/')[0] ?? '',
        routerId: existing.routerId,
        iceServers: this.getIceServers(),
        rtpCapabilities: existing.rtpCapabilities ?? {},
        httpOrigin: existing.httpOrigin,
      };
    }

    const node = await this.getBestNode();
    if (!node) {
      throw new Error('No available SFU nodes');
    }

    const httpOrigin = `http://${node.host}:${node.port}`;

    const created = await sfuFetch<{ routerId: string; rtpCapabilities: unknown }>(
      httpOrigin,
      `/api/rooms/${encodeURIComponent(roomId)}/router`,
      { method: 'POST' }
    );

    await this.redisService.setRoomRouter(roomId, {
      nodeId: node.id,
      routerId: created.routerId,
      httpOrigin,
      rtpCapabilities: created.rtpCapabilities,
    });

    logger.info(
      { roomId, nodeId: node.id, routerId: created.routerId },
      'Room allocated on SFU'
    );

    return {
      node: `${node.host}:${node.port}`,
      routerId: created.routerId,
      iceServers: this.getIceServers(),
      rtpCapabilities: created.rtpCapabilities,
      httpOrigin,
    };
  }

  /**
   * Release SFU router and Redis mapping.
   */
  async releaseRoom(roomId: string): Promise<void> {
    const rec = await this.redisService.getRoomRouter(roomId);
    if (rec) {
      try {
        await sfuFetch(
          rec.httpOrigin,
          `/api/routers/${encodeURIComponent(rec.routerId)}`,
          { method: 'DELETE' }
        );
      } catch (e) {
        logger.warn({ roomId, error: e }, 'SFU closeRouter failed (continuing)');
      }
    }
    await this.redisService.deleteRoomRouter(roomId);
    logger.info({ roomId }, 'Room released from SFU');
  }

  private async checkHealth(): Promise<void> {
    for (const [nodeId, node] of this.nodes) {
      try {
        const heartbeat = await this.redisService.get(`sfu:node:${nodeId}:heartbeat`);

        if (heartbeat) {
          const lastBeat = parseInt(heartbeat, 10);
          const age = Date.now() - lastBeat;
          node.isHealthy = age < 60000;
        }

        const statsStr = await this.redisService.get(`sfu:node:${nodeId}:stats`);
        if (statsStr) {
          const stats = JSON.parse(statsStr) as { routers?: number };
          node.load = stats.routers || 0;
        }

        node.lastHealthCheck = new Date();
      } catch (error) {
        logger.warn({ nodeId, error }, 'Health check failed for SFU node');
        node.isHealthy = false;
      }
    }
  }

  private getIceServers(): unknown[] {
    return [
      { urls: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302' },
      ...(process.env.TURN_SERVER_URL
        ? [
            {
              urls: process.env.TURN_SERVER_URL,
              username: process.env.TURN_SERVER_USERNAME || '',
              credential: process.env.TURN_SERVER_CREDENTIAL || '',
            },
          ]
        : []),
    ];
  }
}
