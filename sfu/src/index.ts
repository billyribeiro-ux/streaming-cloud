/**
 * Trading Room SaaS - Mediasoup SFU Node
 *
 * Enterprise-grade Selective Forwarding Unit for WebRTC media
 * Handles video/audio routing with simulcast support
 */

import { createServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import * as mediasoup from 'mediasoup';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { WorkerManager } from './workers/WorkerManager.js';
import { RouterManager } from './routers/RouterManager.js';
import { healthRouter } from './health/router.js';
import { apiRouter } from './api/router.js';
import { RedisService } from './services/RedisService.js';

async function main(): Promise<void> {
  logger.info('Starting Mediasoup SFU Node...');
  logger.info({
    nodeId: config.nodeId,
    numWorkers: config.mediasoup.numWorkers,
    rtcMinPort: config.mediasoup.rtcMinPort,
    rtcMaxPort: config.mediasoup.rtcMaxPort,
  }, 'SFU Configuration');

  // Initialize Express app
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.cors.origins }));
  app.use(express.json());

  // Initialize Redis for cluster coordination
  const redisService = new RedisService(config.redis);
  await redisService.connect();
  logger.info('Redis connected');

  // Initialize Mediasoup workers
  const workerManager = new WorkerManager(config.mediasoup);
  await workerManager.initialize();
  logger.info(`Initialized ${workerManager.getWorkerCount()} Mediasoup workers`);

  // Initialize Router Manager
  const routerManager = new RouterManager(workerManager, redisService, config.nodeId);
  await routerManager.initialize();
  logger.info('Router manager initialized');

  // Register this node with Redis
  await redisService.registerNode(config.nodeId, {
    host: config.host,
    port: config.port,
    workers: workerManager.getWorkerCount(),
    capacity: config.mediasoup.maxRoomsPerNode,
  });

  // Start periodic health reporting
  const healthInterval = setInterval(async () => {
    const stats = {
      nodeId: config.nodeId,
      workers: workerManager.getWorkerStats(),
      routers: routerManager.getRouterCount(),
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
    await redisService.updateNodeHealth(config.nodeId, stats);
  }, 5000);

  // API routes
  app.use('/health', healthRouter(workerManager, routerManager));
  app.use('/api', apiRouter(routerManager));

  // Create HTTP server
  const server = createServer(app);

  server.listen(config.port, () => {
    logger.info(`SFU Node listening on port ${config.port}`);
    logger.info(`Node ID: ${config.nodeId}`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    clearInterval(healthInterval);

    // Deregister from cluster
    await redisService.deregisterNode(config.nodeId);

    // Close all routers
    await routerManager.shutdown();

    // Close workers
    await workerManager.shutdown();

    // Disconnect Redis
    await redisService.disconnect();

    server.close(() => {
      logger.info('SFU Node closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ error }, 'Failed to start SFU Node');
  process.exit(1);
});
