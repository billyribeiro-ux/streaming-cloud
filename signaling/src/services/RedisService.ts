/**
 * Redis Service - Caching and Pub/Sub for cluster coordination
 */

import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';

interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
}

export class RedisService {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private config: RedisConfig;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const connectionString = this.config.url || `redis://${this.config.host || 'localhost'}:${this.config.port || 6379}`;

    this.client = new Redis(connectionString);
    this.subscriber = new Redis(connectionString);

    this.client.on('error', (err: Error) => {
      logger.error({ error: err }, 'Redis client error');
    });

    this.subscriber.on('error', (err: Error) => {
      logger.error({ error: err }, 'Redis subscriber error');
    });

    await this.client.ping();
    logger.info('Redis connected');
  }

  getClient(): Redis | null {
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    logger.info('Redis disconnected');
  }

  async get(key: string): Promise<string | null> {
    return this.client?.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;

    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client?.del(key);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client?.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client?.hget(key, field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client?.hgetall(key) ?? {};
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client?.hdel(key, field);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client?.publish(channel, message);
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    await this.subscriber?.subscribe(channel);
    this.subscriber?.on('message', (ch: string, message: string) => {
      if (ch === channel) {
        handler(message);
      }
    });
  }

  // Node registration for SFU cluster
  async registerNode(nodeId: string, info: Record<string, unknown>): Promise<void> {
    await this.hset('sfu:nodes', nodeId, JSON.stringify(info));
    await this.set(`sfu:node:${nodeId}:heartbeat`, Date.now().toString(), 30);
  }

  async deregisterNode(nodeId: string): Promise<void> {
    await this.hdel('sfu:nodes', nodeId);
    await this.del(`sfu:node:${nodeId}:heartbeat`);
  }

  async updateNodeHealth(nodeId: string, stats: Record<string, unknown>): Promise<void> {
    await this.set(`sfu:node:${nodeId}:stats`, JSON.stringify(stats), 60);
    await this.set(`sfu:node:${nodeId}:heartbeat`, Date.now().toString(), 30);
  }

  async setRoomRouter(roomId: string, info: { nodeId: string; routerId: string }): Promise<void> {
    await this.hset('room:routers', roomId, JSON.stringify(info));
  }

  async getRoomRouter(roomId: string): Promise<{ nodeId: string; routerId: string } | null> {
    const data = await this.hget('room:routers', roomId);
    return data ? JSON.parse(data) : null;
  }

  async deleteRoomRouter(roomId: string): Promise<void> {
    await this.hdel('room:routers', roomId);
  }
}
