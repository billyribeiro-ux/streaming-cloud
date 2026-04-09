/**
 * Health check routes for load balancers and orchestration
 */

import { Router, type Request, type Response } from 'express';
import type { WorkerManager } from '../workers/WorkerManager.js';
import type { RouterManager } from '../routers/RouterManager.js';

export function healthRouter(
  workerManager: WorkerManager,
  routerManager: RouterManager
): Router {
  const r = Router();

  r.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  r.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      workers: workerManager.getWorkerCount(),
      routers: routerManager.getRouterCount(),
    });
  });

  return r;
}
