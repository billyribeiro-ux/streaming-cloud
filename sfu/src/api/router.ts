/**
 * SFU HTTP control API — called by the signaling server (Bearer auth).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type {
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
  SctpCapabilities,
  SctpStreamParameters,
} from 'mediasoup/types';
import type { RouterManager } from '../routers/RouterManager.js';
import { config } from '../config/index.js';

function pathParam(req: Request, name: string): string {
  const v = req.params[name];
  if (v === undefined) return '';
  return Array.isArray(v) ? String(v[0] ?? '') : String(v);
}

function requireControlAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = auth.slice(7);
  if (token !== config.controlPlaneSecret) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function apiRouter(routerManager: RouterManager): Router {
  const r = Router();

  r.use(requireControlAuth);

  /** Create mediasoup router for a room */
  r.post('/rooms/:roomId/router', async (req: Request, res: Response) => {
    try {
      const roomId = pathParam(req, 'roomId');
      const { routerId, rtpCapabilities } = await routerManager.createRouter(roomId);
      res.json({ routerId, rtpCapabilities });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'createRouter failed',
      });
    }
  });

  /** Tear down router and transports */
  r.delete('/routers/:routerId', async (req: Request, res: Response) => {
    try {
      await routerManager.closeRouter(pathParam(req, 'routerId'));
      res.status(204).send();
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'closeRouter failed',
      });
    }
  });

  r.post('/routers/:routerId/transports', async (req: Request, res: Response) => {
    try {
      const routerId = pathParam(req, 'routerId');
      const { direction, sctpCapabilities } = req.body as {
        direction: 'send' | 'recv';
        sctpCapabilities?: unknown;
      };
      const t = await routerManager.createTransport(
        routerId,
        direction,
        sctpCapabilities as SctpCapabilities | undefined
      );
      res.json(t);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'createTransport failed',
      });
    }
  });

  r.post(
    '/routers/:routerId/transports/:transportId/connect',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const transportId = pathParam(req, 'transportId');
        const { dtlsParameters } = req.body as { dtlsParameters: unknown };
        await routerManager.connectTransport(
          routerId,
          transportId,
          dtlsParameters as DtlsParameters
        );
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'connectTransport failed',
        });
      }
    }
  );

  r.post(
    '/routers/:routerId/transports/:transportId/restart-ice',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const transportId = pathParam(req, 'transportId');
        const iceParameters = await routerManager.restartIce(routerId, transportId);
        res.json({ iceParameters });
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'restart ICE failed',
        });
      }
    }
  );

  r.post('/routers/:routerId/producers', async (req: Request, res: Response) => {
    try {
      const routerId = pathParam(req, 'routerId');
      const { transportId, kind, rtpParameters, appData } = req.body as {
        transportId: string;
        kind: 'audio' | 'video';
        rtpParameters: unknown;
        appData?: unknown;
      };
      const p = await routerManager.produce(
        routerId,
        transportId,
        kind,
        rtpParameters as RtpParameters,
        appData
      );
      res.json(p);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'produce failed',
      });
    }
  });

  r.post('/routers/:routerId/consumers', async (req: Request, res: Response) => {
    try {
      const routerId = pathParam(req, 'routerId');
      const { transportId, producerId, rtpCapabilities } = req.body as {
        transportId: string;
        producerId: string;
        rtpCapabilities: unknown;
      };
      const c = await routerManager.consume(
        routerId,
        transportId,
        producerId,
        rtpCapabilities as RtpCapabilities
      );
      res.status(200).json(c);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'consume failed',
      });
    }
  });

  r.post('/routers/:routerId/data-producers', async (req: Request, res: Response) => {
    try {
      const routerId = pathParam(req, 'routerId');
      const { transportId, sctpStreamParameters, label, protocol, appData } = req.body as {
        transportId: string;
        sctpStreamParameters: unknown;
        label: string;
        protocol: string;
        appData?: unknown;
      };
      const dp = await routerManager.produceData(
        routerId,
        transportId,
        sctpStreamParameters as SctpStreamParameters,
        label,
        protocol,
        appData
      );
      res.json(dp);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'produceData failed',
      });
    }
  });

  r.post('/routers/:routerId/data-consumers', async (req: Request, res: Response) => {
    try {
      const routerId = pathParam(req, 'routerId');
      const { transportId, dataProducerId } = req.body as {
        transportId: string;
        dataProducerId: string;
      };
      const dc = await routerManager.consumeData(
        routerId,
        transportId,
        dataProducerId
      );
      res.json(dc);
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'consumeData failed',
      });
    }
  });

  r.post(
    '/routers/:routerId/consumers/:consumerId/resume',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const consumerId = pathParam(req, 'consumerId');
        await routerManager.resumeConsumer(routerId, consumerId);
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'resume failed',
        });
      }
    }
  );

  r.delete(
    '/routers/:routerId/producers/:producerId',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const producerId = pathParam(req, 'producerId');
        await routerManager.closeProducer(routerId, producerId);
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'close producer failed',
        });
      }
    }
  );

  r.post(
    '/routers/:routerId/producers/:producerId/pause',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const producerId = pathParam(req, 'producerId');
        await routerManager.pauseProducer(routerId, producerId);
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'pause failed',
        });
      }
    }
  );

  r.post(
    '/routers/:routerId/producers/:producerId/resume',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const producerId = pathParam(req, 'producerId');
        await routerManager.resumeProducer(routerId, producerId);
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'resume failed',
        });
      }
    }
  );

  r.post(
    '/routers/:routerId/consumers/:consumerId/layers',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const consumerId = pathParam(req, 'consumerId');
        const { spatialLayer, temporalLayer } = req.body as {
          spatialLayer: number;
          temporalLayer?: number;
        };
        await routerManager.setPreferredLayers(
          routerId,
          consumerId,
          spatialLayer,
          temporalLayer
        );
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'layers failed',
        });
      }
    }
  );

  r.post(
    '/routers/:routerId/transports/:transportId/max-bitrate',
    async (req: Request, res: Response) => {
      try {
        const routerId = pathParam(req, 'routerId');
        const transportId = pathParam(req, 'transportId');
        const { bitrate } = req.body as { bitrate: number };
        await routerManager.setMaxIncomingBitrate(routerId, transportId, bitrate);
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'setMaxIncomingBitrate failed',
        });
      }
    }
  );

  r.get('/stats', (_req: Request, res: Response) => {
    res.json({ routers: routerManager.getRouterCount() });
  });

  return r;
}
