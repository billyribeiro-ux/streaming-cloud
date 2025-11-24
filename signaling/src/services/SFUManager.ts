/**
 * SFU Manager - Manages connections to SFU nodes in the cluster
 */

import { logger } from '../utils/logger.js';
import { RedisService } from './RedisService.js';

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
    private config: SFUConfig,
    private redisService: RedisService
  ) {}

  async initialize(): Promise<void> {
    // Parse node configurations
    for (const nodeStr of this.config.nodes) {
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

    // Start health checking
    this.healthCheckInterval = setInterval(() => this.checkHealth(), 10000);

    logger.info({ nodeCount: this.nodes.size }, 'SFU Manager initialized');
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info('SFU Manager shut down');
  }

  /**
   * Get the best SFU node for a new room based on load
   */
  async getBestNode(): Promise<SFUNode | null> {
    const healthyNodes = Array.from(this.nodes.values()).filter((n) => n.isHealthy);

    if (healthyNodes.length === 0) {
      logger.error('No healthy SFU nodes available');
      return null;
    }

    // Sort by load and return least loaded
    healthyNodes.sort((a, b) => a.load - b.load);
    return healthyNodes[0];
  }

  /**
   * Allocate a room to an SFU node
   */
  async allocateRoom(roomId: string): Promise<{
    node: string;
    routerId: string;
    iceServers: any[];
  }> {
    // Check if room already has an allocation
    const existing = await this.redisService.getRoomRouter(roomId);
    if (existing) {
      return {
        node: existing.nodeId,
        routerId: existing.routerId,
        iceServers: this.getIceServers(),
      };
    }

    // Get best node
    const node = await this.getBestNode();
    if (!node) {
      throw new Error('No available SFU nodes');
    }

    // In a real implementation, this would call the SFU node's API
    // to create a router and return the routerId
    const routerId = `router-${roomId}-${Date.now()}`;

    // Store allocation
    await this.redisService.setRoomRouter(roomId, {
      nodeId: node.id,
      routerId,
    });

    logger.info({ roomId, nodeId: node.id, routerId }, 'Room allocated to SFU node');

    return {
      node: `${node.host}:${node.port}`,
      routerId,
      iceServers: this.getIceServers(),
    };
  }

  /**
   * Release a room allocation
   */
  async releaseRoom(roomId: string): Promise<void> {
    await this.redisService.deleteRoomRouter(roomId);
    logger.info({ roomId }, 'Room released from SFU');
  }

  private async checkHealth(): Promise<void> {
    for (const [nodeId, node] of this.nodes) {
      try {
        // In production, this would make an HTTP request to the node's health endpoint
        // For now, we'll check Redis for heartbeat
        const heartbeat = await this.redisService.get(`sfu:node:${nodeId}:heartbeat`);

        if (heartbeat) {
          const lastBeat = parseInt(heartbeat, 10);
          const age = Date.now() - lastBeat;
          node.isHealthy = age < 60000; // Consider unhealthy if no heartbeat for 60s
        }

        // Update load from stats
        const statsStr = await this.redisService.get(`sfu:node:${nodeId}:stats`);
        if (statsStr) {
          const stats = JSON.parse(statsStr);
          node.load = stats.routers || 0;
        }

        node.lastHealthCheck = new Date();
      } catch (error) {
        logger.warn({ nodeId, error }, 'Health check failed for SFU node');
        node.isHealthy = false;
      }
    }
  }

  private getIceServers(): any[] {
    return [
      { urls: process.env.STUN_SERVER_URL || 'stun:stun.l.google.com:19302' },
      {
        urls: process.env.TURN_SERVER_URL || 'turn:turn.example.com:3478',
        username: process.env.TURN_SERVER_USERNAME || 'user',
        credential: process.env.TURN_SERVER_CREDENTIAL || 'pass',
      },
    ];
  }
}
