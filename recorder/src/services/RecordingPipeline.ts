/**
 * RecordingPipeline - Manages a single recording session
 *
 * Lifecycle:
 *   1. start()  - Requests PlainRtpTransports from the SFU for each
 *                 producer in the room, receives RTP, pipes to ffmpeg
 *                 for muxing into MP4.
 *   2. stop()   - Gracefully stops ffmpeg, uploads the file to storage.
 *
 * States: idle -> recording -> processing -> completed | failed
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type RecordingState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'completed'
  | 'failed';

export interface RecordingInfo {
  id: string;
  roomId: string;
  sfuOrigin: string;
  routerId: string;
  state: RecordingState;
  startedAt: Date | null;
  stoppedAt: Date | null;
  outputPath: string | null;
  error: string | null;
}

interface PlainRtpTransportInfo {
  transportId: string;
  ip: string;
  port: number;
  rtcpPort: number;
}

// ----------------------------------------------------------------
// RecordingPipeline
// ----------------------------------------------------------------

export class RecordingPipeline extends EventEmitter {
  public readonly id: string;
  private _state: RecordingState = 'idle';
  private roomId: string = '';
  private sfuOrigin: string = '';
  private routerId: string = '';
  private startedAt: Date | null = null;
  private stoppedAt: Date | null = null;
  private outputPath: string | null = null;
  private errorMessage: string | null = null;

  // Placeholder for ffmpeg process handle
  private ffmpegProcess: any = null;

  // Transport IDs created on the SFU side for this recording
  private plainTransportIds: string[] = [];

  constructor() {
    super();
    this.id = uuidv4();
  }

  get state(): RecordingState {
    return this._state;
  }

  private setState(newState: RecordingState): void {
    const prev = this._state;
    this._state = newState;
    this.emit('statechange', { prev, current: newState });
  }

  /**
   * Return a snapshot of the current recording metadata.
   */
  getInfo(): RecordingInfo {
    return {
      id: this.id,
      roomId: this.roomId,
      sfuOrigin: this.sfuOrigin,
      routerId: this.routerId,
      state: this._state,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      outputPath: this.outputPath,
      error: this.errorMessage,
    };
  }

  // ----------------------------------------------------------------
  // start
  // ----------------------------------------------------------------

  /**
   * Begin recording a room.
   *
   * High-level flow:
   *   1. Call SFU API to list producers in the room.
   *   2. For each producer, create a PlainRtpTransport on the SFU.
   *   3. The SFU will forward RTP to us on the allocated ports.
   *   4. Spawn ffmpeg to receive RTP and mux to MP4.
   */
  async start(
    roomId: string,
    sfuOrigin: string,
    routerId: string
  ): Promise<void> {
    if (this._state !== 'idle') {
      throw new Error(
        `Cannot start recording: current state is "${this._state}"`
      );
    }

    this.roomId = roomId;
    this.sfuOrigin = sfuOrigin;
    this.routerId = routerId;
    this.startedAt = new Date();
    this.setState('recording');

    try {
      // Step 1: Fetch the list of producers from the SFU
      const producers = await this.fetchProducers();

      if (producers.length === 0) {
        console.warn(
          `[Recorder] No producers found in room ${roomId}, nothing to record`
        );
      }

      // Step 2: For each producer, request a PlainRtpTransport from the SFU
      const transports: PlainRtpTransportInfo[] = [];
      for (const producer of producers) {
        const transport = await this.createPlainTransport(producer.id);
        transports.push(transport);
        this.plainTransportIds.push(transport.transportId);
      }

      // Step 3: Build the output path
      const timestamp = this.startedAt.toISOString().replace(/[:.]/g, '-');
      this.outputPath = `/recordings/${roomId}/${timestamp}.mp4`;

      // Step 4: Spawn ffmpeg (stubbed)
      this.spawnFfmpeg(transports);

      console.log(
        `[Recorder] Recording started: ${this.id} for room ${roomId}`
      );
    } catch (err) {
      this.errorMessage =
        err instanceof Error ? err.message : 'Unknown error during start';
      this.setState('failed');
      throw err;
    }
  }

  // ----------------------------------------------------------------
  // stop
  // ----------------------------------------------------------------

  /**
   * Gracefully stop the recording.
   *
   * 1. Signal ffmpeg to finish (send 'q' or SIGINT).
   * 2. Wait for ffmpeg to flush and close the MP4 file.
   * 3. Upload the finished file to object storage.
   * 4. Clean up PlainRtpTransports on the SFU.
   */
  async stop(): Promise<void> {
    if (this._state !== 'recording') {
      throw new Error(
        `Cannot stop recording: current state is "${this._state}"`
      );
    }

    this.setState('processing');
    this.stoppedAt = new Date();

    try {
      // Stop ffmpeg (stubbed)
      this.stopFfmpeg();

      // Clean up SFU transports
      for (const transportId of this.plainTransportIds) {
        await this.closePlainTransport(transportId);
      }
      this.plainTransportIds = [];

      // Upload to storage (stubbed)
      await this.uploadToStorage();

      this.setState('completed');
      console.log(`[Recorder] Recording completed: ${this.id}`);
    } catch (err) {
      this.errorMessage =
        err instanceof Error ? err.message : 'Unknown error during stop';
      this.setState('failed');
      throw err;
    }
  }

  // ----------------------------------------------------------------
  // SFU API helpers (stubs - real implementation would use fetch/axios)
  // ----------------------------------------------------------------

  private async fetchProducers(): Promise<
    { id: string; kind: string }[]
  > {
    // TODO: GET {sfuOrigin}/api/routers/{routerId}/producers
    console.log(
      `[Recorder] Fetching producers from ${this.sfuOrigin} router ${this.routerId}`
    );
    return [];
  }

  private async createPlainTransport(
    _producerId: string
  ): Promise<PlainRtpTransportInfo> {
    // TODO: POST {sfuOrigin}/api/routers/{routerId}/plain-transports
    // Body: { producerId }
    // Returns: { transportId, ip, port, rtcpPort }
    console.log(
      `[Recorder] Creating PlainRtpTransport for producer ${_producerId}`
    );
    return {
      transportId: uuidv4(),
      ip: '127.0.0.1',
      port: 0,
      rtcpPort: 0,
    };
  }

  private async closePlainTransport(transportId: string): Promise<void> {
    // TODO: DELETE {sfuOrigin}/api/routers/{routerId}/plain-transports/{transportId}
    console.log(`[Recorder] Closing PlainRtpTransport ${transportId}`);
  }

  // ----------------------------------------------------------------
  // ffmpeg helpers (stubs)
  // ----------------------------------------------------------------

  /**
   * Spawn an ffmpeg process that receives RTP on the given ports
   * and muxes the streams into a single MP4 file.
   *
   * A real implementation would use fluent-ffmpeg or child_process.spawn.
   */
  private spawnFfmpeg(
    _transports: PlainRtpTransportInfo[]
  ): void {
    // Example ffmpeg command (for reference):
    //
    // ffmpeg \
    //   -protocol_whitelist rtp,udp \
    //   -i rtp://127.0.0.1:{audioPort} \
    //   -i rtp://127.0.0.1:{videoPort} \
    //   -c:a aac -c:v libx264 \
    //   -f mp4 output.mp4
    //
    console.log(
      `[Recorder] ffmpeg spawn (stub): would record to ${this.outputPath}`
    );
    this.ffmpegProcess = { pid: -1 }; // placeholder
  }

  private stopFfmpeg(): void {
    if (this.ffmpegProcess) {
      console.log('[Recorder] ffmpeg stop (stub)');
      this.ffmpegProcess = null;
    }
  }

  // ----------------------------------------------------------------
  // Storage helpers (stubs)
  // ----------------------------------------------------------------

  private async uploadToStorage(): Promise<void> {
    // TODO: Upload this.outputPath to S3 / GCS / MinIO
    console.log(
      `[Recorder] Upload to storage (stub): ${this.outputPath}`
    );
  }
}
