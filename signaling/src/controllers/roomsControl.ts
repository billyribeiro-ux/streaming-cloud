/**
 * HTTP API for Laravel → signaling control plane (Bearer SIGNALING_SERVER_SECRET).
 * Matches backend/app/Services/SignalingService.php routes.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { SFUManager } from '../services/SFUManager.js';
import type { RoomManager } from '../services/RoomManager.js';
import type { SignalingServer } from '../services/SignalingServer.js';

function pathParam(req: Request, name: string): string {
  const v = req.params[name];
  if (v === undefined) return '';
  return Array.isArray(v) ? String(v[0] ?? '') : String(v);
}

export function createRoomsControlRouter(opts: {
  controlSecret: string;
  sfuManager: SFUManager;
  roomManager: RoomManager;
  signalingServer: SignalingServer;
}): Router {
  const { controlSecret, sfuManager, roomManager, signalingServer } = opts;
  const r = Router();

  const auth = (req: Request, res: Response, next: NextFunction): void => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ') || h.slice(7) !== controlSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  r.use(auth);

  /**
   * POST /api/rooms/allocate
   * Body: { room_id, organization_id?, settings? }
   */
  r.post('/rooms/allocate', async (req: Request, res: Response) => {
    try {
      const roomId = String(req.body.room_id ?? '');
      if (!roomId) {
        res.status(400).json({ error: 'room_id required' });
        return;
      }

      const alloc = await sfuManager.allocateRoom(roomId);
      res.json({
        node: alloc.node,
        routerId: alloc.routerId,
        iceServers: alloc.iceServers,
        rtpCapabilities: alloc.rtpCapabilities,
      });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'allocate failed',
      });
    }
  });

  /** POST /api/rooms/:roomId/close */
  r.post('/rooms/:roomId/close', async (req: Request, res: Response) => {
    try {
      const roomId = pathParam(req, 'roomId');
      await signalingServer.disconnectClientsInRoom(roomId);
      await roomManager.destroyRoom(roomId);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : 'close failed',
      });
    }
  });

  /** POST /api/rooms/:roomId/participants/:userId/remove */
  r.post(
    '/rooms/:roomId/participants/:userId/remove',
    async (req: Request, res: Response) => {
      try {
        const roomId = pathParam(req, 'roomId');
        const userId = pathParam(req, 'userId');
        await signalingServer.disconnectUserInRoom(roomId, userId);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'remove failed',
        });
      }
    }
  );

  /** POST /api/rooms/:roomId/participants/:userId/mute */
  r.post(
    '/rooms/:roomId/participants/:userId/mute',
    async (req: Request, res: Response) => {
      try {
        const roomId = pathParam(req, 'roomId');
        const userId = pathParam(req, 'userId');
        const mediaType = String(
          (req.body as { media_type?: string }).media_type || 'audio'
        );
        signalingServer.broadcastMuteRequest(roomId, userId, mediaType);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({
          error: e instanceof Error ? e.message : 'mute failed',
        });
      }
    }
  );

  return r;
}
