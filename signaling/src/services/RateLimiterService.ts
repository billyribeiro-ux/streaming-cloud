/**
 * Rate Limiter Service
 *
 * Protects the signaling server from abuse by limiting:
 * - WebSocket connection rate per IP
 * - Message rate per connection
 * - Messages per user across all connections
 */

import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger.js';
import Redis from 'ioredis';

export interface RateLimiterConfig {
  // Connection rate limiting (per IP)
  connectionPoints: number; // Max connections
  connectionDuration: number; // Time window in seconds
  connectionBlockDuration: number; // How long to block after limit

  // Message rate limiting (per connection)
  messagePoints: number; // Max messages
  messageDuration: number; // Time window in seconds

  // Global message rate (per user ID)
  globalMessagePoints: number;
  globalMessageDuration: number;
}

export class RateLimiterService {
  private connectionLimiter: RateLimiterRedis | RateLimiterMemory;
  private messageLimiter: RateLimiterMemory;
  private globalMessageLimiter: RateLimiterRedis | RateLimiterMemory;

  constructor(
    private redis: Redis | null,
    private config: RateLimiterConfig
  ) {
    // Connection rate limiter (Redis-backed for multi-server deployments)
    if (redis) {
      this.connectionLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl:conn:',
        points: config.connectionPoints,
        duration: config.connectionDuration,
        blockDuration: config.connectionBlockDuration,
      });

      this.globalMessageLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'rl:msg:global:',
        points: config.globalMessagePoints,
        duration: config.globalMessageDuration,
      });
    } else {
      // Fallback to in-memory for development
      this.connectionLimiter = new RateLimiterMemory({
        keyPrefix: 'rl:conn:',
        points: config.connectionPoints,
        duration: config.connectionDuration,
        blockDuration: config.connectionBlockDuration,
      });

      this.globalMessageLimiter = new RateLimiterMemory({
        keyPrefix: 'rl:msg:global:',
        points: config.globalMessagePoints,
        duration: config.globalMessageDuration,
      });
    }

    // Message rate limiter (in-memory, per-connection)
    this.messageLimiter = new RateLimiterMemory({
      keyPrefix: 'rl:msg:',
      points: config.messagePoints,
      duration: config.messageDuration,
    });

    logger.info('Rate limiter service initialized', { config });
  }

  /**
   * Check if a new connection from this IP is allowed
   * @returns true if allowed, false if rate limited
   */
  async checkConnection(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    try {
      await this.connectionLimiter.consume(ip, 1);
      return { allowed: true };
    } catch (rateLimiterRes: any) {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 1;

      logger.warn(
        { ip, retryAfter },
        'Connection rate limit exceeded'
      );

      return {
        allowed: false,
        retryAfter,
      };
    }
  }

  /**
   * Check if a message from this connection is allowed
   * @returns true if allowed, false if rate limited
   */
  async checkMessage(
    connectionId: string,
    userId?: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    try {
      // Check per-connection limit
      await this.messageLimiter.consume(connectionId, 1);

      // Check global per-user limit if user is authenticated
      if (userId) {
        await this.globalMessageLimiter.consume(userId, 1);
      }

      return { allowed: true };
    } catch (rateLimiterRes: any) {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 1;

      logger.warn(
        { connectionId, userId, retryAfter },
        'Message rate limit exceeded'
      );

      return {
        allowed: false,
        retryAfter,
      };
    }
  }

  /**
   * Reset rate limits for a specific key (e.g., on disconnect)
   */
  async reset(key: string): Promise<void> {
    try {
      await this.messageLimiter.delete(key);
      await this.globalMessageLimiter.delete(key);
    } catch (error) {
      logger.error({ error, key }, 'Failed to reset rate limiter');
    }
  }

  /**
   * Get remaining points for a key
   */
  async getRemaining(key: string): Promise<number> {
    try {
      const res = await this.messageLimiter.get(key);
      return res ? res.remainingPoints : this.config.messagePoints;
    } catch (error) {
      return this.config.messagePoints;
    }
  }
}

/**
 * Default rate limiter configuration for production
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimiterConfig = {
  // Connection limits: 20 connections per IP per 60 seconds
  connectionPoints: 20,
  connectionDuration: 60,
  connectionBlockDuration: 300, // Block for 5 minutes

  // Message limits: 100 messages per connection per 10 seconds
  messagePoints: 100,
  messageDuration: 10,

  // Global limits: 500 messages per user per 60 seconds across all connections
  globalMessagePoints: 500,
  globalMessageDuration: 60,
};
