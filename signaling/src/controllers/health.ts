/**
 * Health Check Controller
 */

import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'signaling-server',
  });
});

healthRouter.get('/ready', (_req: Request, res: Response) => {
  // Add readiness checks here (Redis connection, etc.)
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});
