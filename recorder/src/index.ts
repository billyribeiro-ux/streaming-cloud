/**
 * Trading Room SaaS - Recording Service
 *
 * HTTP API that manages recording sessions.  For each room it creates
 * PlainRtpTransports on the SFU to receive raw RTP, then pipes the
 * streams through ffmpeg to produce MP4 files.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { RecordingPipeline, type RecordingInfo } from './services/RecordingPipeline.js';

const PORT = parseInt(process.env.RECORDER_PORT || '5000', 10);

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------
// In-memory recording registry
// ----------------------------------------------------------------

const recordings = new Map<string, RecordingPipeline>();

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------

/**
 * POST /api/recordings/start
 *
 * Body: { roomId: string, sfuOrigin: string, routerId: string }
 *
 * Creates a new RecordingPipeline, starts it, and returns the
 * recording metadata.
 */
app.post('/api/recordings/start', async (req, res) => {
  try {
    const { roomId, sfuOrigin, routerId } = req.body as {
      roomId?: string;
      sfuOrigin?: string;
      routerId?: string;
    };

    if (!roomId || !sfuOrigin || !routerId) {
      res.status(400).json({
        error: 'Missing required fields: roomId, sfuOrigin, routerId',
      });
      return;
    }

    const pipeline = new RecordingPipeline();
    recordings.set(pipeline.id, pipeline);

    await pipeline.start(roomId, sfuOrigin, routerId);

    res.status(201).json(pipeline.getInfo());
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to start recording',
    });
  }
});

/**
 * POST /api/recordings/stop
 *
 * Body: { recordingId: string }
 *
 * Stops an active recording, triggering ffmpeg finalization and
 * upload to storage.
 */
app.post('/api/recordings/stop', async (req, res) => {
  try {
    const { recordingId } = req.body as { recordingId?: string };

    if (!recordingId) {
      res.status(400).json({ error: 'Missing required field: recordingId' });
      return;
    }

    const pipeline = recordings.get(recordingId);
    if (!pipeline) {
      res.status(404).json({ error: `Recording not found: ${recordingId}` });
      return;
    }

    await pipeline.stop();

    res.json(pipeline.getInfo());
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to stop recording',
    });
  }
});

/**
 * GET /api/recordings/:id/status
 *
 * Returns the current state and metadata for a recording.
 */
app.get('/api/recordings/:id/status', (req, res) => {
  const id = req.params.id;
  const pipeline = recordings.get(id);

  if (!pipeline) {
    res.status(404).json({ error: `Recording not found: ${id}` });
    return;
  }

  res.json(pipeline.getInfo());
});

/**
 * GET /health
 *
 * Simple health check endpoint.
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    activeRecordings: Array.from(recordings.values()).filter(
      (r) => r.state === 'recording'
    ).length,
    totalRecordings: recordings.size,
  });
});

// ----------------------------------------------------------------
// Start server
// ----------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[Recorder] Recording service listening on port ${PORT}`);
  console.log(`[Recorder] Health check: http://localhost:${PORT}/health`);
});
