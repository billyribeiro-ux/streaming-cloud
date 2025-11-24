/**
 * Trading Room SaaS - WebRTC Signaling Server
 *
 * Enterprise-grade signaling server for WebRTC connections
 * Handles authentication, room management, and SFU coordination
 */

import { createServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { SignalingServer } from './services/SignalingServer.js';
import { SFUManager } from './services/SFUManager.js';
import { RedisService } from './services/RedisService.js';
import { AuthService } from './services/AuthService.js';
import { RateLimiterService, DEFAULT_RATE_LIMIT_CONFIG } from './services/RateLimiterService.js';
import { healthRouter } from './controllers/health.js';

async function main(): Promise<void> {
  logger.info('Starting Trading Room Signaling Server...');

  // Initialize Express app for health checks and HTTP endpoints
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.cors.origins }));
  app.use(express.json());

  // Health check endpoints
  app.use('/health', healthRouter);

  // Create HTTP server
  const server = createServer(app);

  // Initialize services
  const redisService = new RedisService(config.redis);
  await redisService.connect();
  logger.info('Redis connected');

  const authService = new AuthService(config.supabase);
  logger.info('Auth service initialized');

  const sfuManager = new SFUManager(config.sfu, redisService);
  await sfuManager.initialize();
  logger.info('SFU Manager initialized');

  // Initialize rate limiter
  const rateLimiter = new RateLimiterService(
    redisService.getClient(),
    DEFAULT_RATE_LIMIT_CONFIG
  );
  logger.info('Rate limiter initialized');

  // Create WebSocket server
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 64 * 1024, // 64KB max message size
  });

  // Initialize signaling server
  const signalingServer = new SignalingServer(
    wss,
    authService,
    sfuManager,
    redisService,
    rateLimiter
  );

  signalingServer.start();
  logger.info('WebSocket signaling server started');

  // Start HTTP server
  server.listen(config.port, () => {
    logger.info(`Signaling server listening on port ${config.port}`);
    logger.info(`WebSocket endpoint: ws://localhost:${config.port}/ws`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new connections
    wss.close();

    // Close all active connections
    await signalingServer.shutdown();

    // Close Redis
    await redisService.disconnect();

    // Close SFU connections
    await sfuManager.shutdown();

    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Unhandled errors
  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
