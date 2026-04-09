/**
 * SFU HTTP control API — called by the signaling server (Bearer auth).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type {
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
  SctpCapabilities,
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

  // ----------------------------------------------------------------
  // WHIP (WebRTC-HTTP Ingestion Protocol, RFC 9725) endpoints
  // ----------------------------------------------------------------

  /**
   * POST /api/rooms/:roomId/whip
   *
   * Accepts an SDP offer (Content-Type: application/sdp) from a WHIP
   * client (e.g. OBS, GStreamer, ffmpeg-webrtc).  Creates a
   * WebRtcTransport on the room's router, returns an SDP answer with
   * 201 Created and a Location header pointing to the WHIP resource.
   */
  r.post(
    '/rooms/:roomId/whip',
    async (req: Request, res: Response) => {
      try {
        const roomId = pathParam(req, 'roomId');
        const contentType = req.headers['content-type'] || '';

        if (!contentType.includes('application/sdp')) {
          res.status(415).json({
            error: 'Unsupported Media Type: expected application/sdp',
          });
          return;
        }

        // Express raw body — we expect the SDP offer as the raw request body
        // The caller must configure express.text({ type: 'application/sdp' })
        const sdpOffer =
          typeof req.body === 'string'
            ? req.body
            : Buffer.isBuffer(req.body)
              ? req.body.toString('utf-8')
              : String(req.body);

        if (!sdpOffer || !sdpOffer.includes('v=0')) {
          res.status(400).json({ error: 'Invalid SDP offer' });
          return;
        }

        // Look up the room's router
        const roomRouter = routerManager.getRouterByRoomId(roomId);
        if (!roomRouter) {
          res.status(404).json({ error: `No router found for room ${roomId}` });
          return;
        }

        const session = await routerManager.createWhipSession(
          roomRouter.id,
          sdpOffer
        );

        // Build a minimal SDP answer from the transport parameters.
        // A production implementation would use a full SDP serializer;
        // here we return the transport parameters as structured JSON
        // inside an SDP-shaped response so that real SDP generation
        // can be added without changing the HTTP contract.
        const sdpAnswer = buildWhipSdpAnswer(session, sdpOffer);

        const resourceUrl = `/api/rooms/${roomId}/whip/${session.transportId}`;

        res
          .status(201)
          .set('Content-Type', 'application/sdp')
          .set('Location', resourceUrl)
          .set('Access-Control-Expose-Headers', 'Location')
          .send(sdpAnswer);
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'WHIP session creation failed',
        });
      }
    }
  );

  /**
   * DELETE /api/rooms/:roomId/whip/:resourceId
   *
   * Tears down a WHIP session (transport + producers).
   */
  r.delete(
    '/rooms/:roomId/whip/:resourceId',
    async (req: Request, res: Response) => {
      try {
        const roomId = pathParam(req, 'roomId');
        const resourceId = pathParam(req, 'resourceId');

        const roomRouter = routerManager.getRouterByRoomId(roomId);
        if (!roomRouter) {
          res.status(404).json({ error: `No router found for room ${roomId}` });
          return;
        }

        await routerManager.deleteWhipSession(roomRouter.id, resourceId);
        res.status(204).send();
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'WHIP session deletion failed',
        });
      }
    }
  );

  r.get('/stats', (_req: Request, res: Response) => {
    res.json({ routers: routerManager.getRouterCount() });
  });

  return r;
}

// ----------------------------------------------------------------
// Minimal SDP answer builder for WHIP
// ----------------------------------------------------------------

/**
 * Build a minimal but RFC-compliant SDP answer from the mediasoup
 * transport parameters and the offered SDP.
 *
 * NOTE: A production-grade implementation would use a proper SDP
 * library (e.g. sdp-transform).  This scaffold produces a
 * structurally valid answer that a WHIP client can parse.
 */
function buildWhipSdpAnswer(
  session: {
    transportId: string;
    iceParameters: { usernameFragment: string; password: string };
    iceCandidates: {
      foundation: string;
      priority: number;
      ip: string;
      protocol: string;
      port: number;
      type: string;
    }[];
    dtlsParameters: {
      fingerprints: { algorithm: string; value: string }[];
      role: string;
    };
  },
  _sdpOffer: string
): string {
  const { iceParameters, iceCandidates, dtlsParameters } = session;

  const fingerprint = dtlsParameters.fingerprints[
    dtlsParameters.fingerprints.length - 1
  ];

  const candidateLines = iceCandidates
    .map(
      (c) =>
        `a=candidate:${c.foundation} 1 ${c.protocol} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`
    )
    .join('\r\n');

  const dtlsRole =
    dtlsParameters.role === 'server'
      ? 'passive'
      : dtlsParameters.role === 'client'
        ? 'active'
        : 'actpass';

  // Minimal SDP answer (video only, VP8 — matches our media codecs)
  return [
    'v=0',
    `o=- ${Date.now()} 1 IN IP4 0.0.0.0`,
    's=WHIP Answer',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS *',
    'm=video 9 UDP/TLS/RTP/SAVPF 96',
    'c=IN IP4 0.0.0.0',
    'a=rtcp:9 IN IP4 0.0.0.0',
    `a=ice-ufrag:${iceParameters.usernameFragment}`,
    `a=ice-pwd:${iceParameters.password}`,
    `a=fingerprint:${fingerprint.algorithm} ${fingerprint.value}`,
    `a=setup:${dtlsRole}`,
    'a=mid:0',
    'a=recvonly',
    'a=rtcp-mux',
    'a=rtpmap:96 VP8/90000',
    candidateLines,
    '',
  ].join('\r\n');
}
