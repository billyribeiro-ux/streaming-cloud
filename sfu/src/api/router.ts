/**
 * SFU HTTP API (minimal — extend for control plane integration)
 */

import { Router, type Request, type Response } from 'express';
import type { RouterManager } from '../routers/RouterManager.js';

export function apiRouter(routerManager: RouterManager): Router {
  const r = Router();

  r.get('/stats', (_req: Request, res: Response) => {
    res.json({
      routers: routerManager.getRouterCount(),
    });
  });

  return r;
}
