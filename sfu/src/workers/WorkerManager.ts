/**
 * Worker Manager - Manages Mediasoup Workers
 *
 * Handles worker lifecycle, load balancing, and fault tolerance
 * Each worker runs on a separate CPU core for optimal performance
 */

import * as mediasoup from 'mediasoup';
import { types as MediasoupTypes } from 'mediasoup';
import os from 'os';
import { logger } from '../utils/logger.js';
import { MediasoupConfig } from '../config/index.js';

interface WorkerInfo {
  worker: MediasoupTypes.Worker;
  routerCount: number;
  pid: number;
  usage: MediasoupTypes.WorkerResourceUsage | null;
}

export class WorkerManager {
  private workers: WorkerInfo[] = [];
  private nextWorkerIndex = 0;
  onWorkerDeath?: (deadWorker: MediasoupTypes.Worker) => void;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(private config: MediasoupConfig) {}

  async initialize(): Promise<void> {
    const numWorkers = this.config.numWorkers || os.cpus().length;

    logger.info({ numWorkers }, 'Creating Mediasoup workers');

    for (let i = 0; i < numWorkers; i++) {
      const worker = await this.createWorker(i);
      this.workers.push({
        worker,
        routerCount: 0,
        pid: worker.pid,
        usage: null,
      });
    }

    // Start resource usage monitoring
    this.startResourceMonitoring();
  }

  private async createWorker(index: number): Promise<MediasoupTypes.Worker> {
    const worker = await mediasoup.createWorker({
      logLevel: this.config.logLevel as MediasoupTypes.WorkerLogLevel,
      logTags: this.config.logTags as MediasoupTypes.WorkerLogTag[],
      rtcMinPort: this.config.rtcMinPort,
      rtcMaxPort: this.config.rtcMaxPort,
    });

    worker.on('died', (error) => {
      logger.error(
        { error, pid: worker.pid, workerIndex: index },
        'Mediasoup worker died, restarting...'
      );

      // Remove dead worker and create new one
      this.handleWorkerDeath(index).catch((err) =>
        logger.error({ error: err, index }, 'Failed to handle worker death')
      );
    });

    logger.info({ pid: worker.pid, index }, 'Mediasoup worker created');

    return worker;
  }

  private async handleWorkerDeath(index: number): Promise<void> {
    const deadWorker = this.workers[index]?.worker;

    // Notify listener so stale routers can be cleaned up
    if (deadWorker && this.onWorkerDeath) {
      try {
        this.onWorkerDeath(deadWorker);
      } catch (err) {
        logger.error({ error: err, index }, 'onWorkerDeath callback error');
      }
    }

    // Wait a bit before restarting
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const newWorker = await this.createWorker(index);
      this.workers[index] = {
        worker: newWorker,
        routerCount: 0,
        pid: newWorker.pid,
        usage: null,
      };
      logger.info({ index, pid: newWorker.pid }, 'Worker restarted successfully');
    } catch (error) {
      logger.error({ error, index }, 'Failed to restart worker');
    }
  }

  /**
   * Get the least loaded worker using round-robin with load awareness
   */
  getLeastLoadedWorker(): MediasoupTypes.Worker {
    // Find worker with lowest router count
    let minLoad = Infinity;
    let selectedIndex = 0;

    for (let i = 0; i < this.workers.length; i++) {
      const worker = this.workers[i];

      // Skip dead workers
      if (worker.worker.closed) {
        continue;
      }

      // Calculate load score (router count + CPU usage factor)
      const cpuFactor = worker.usage
        ? (worker.usage.ru_utime + worker.usage.ru_stime) / 1000000
        : 0;
      const loadScore = worker.routerCount + cpuFactor;

      if (loadScore < minLoad) {
        minLoad = loadScore;
        selectedIndex = i;
      }
    }

    if (minLoad === Infinity) {
      throw new Error('No available workers');
    }

    return this.workers[selectedIndex].worker;
  }

  /**
   * Round-robin worker selection
   */
  getNextWorker(): MediasoupTypes.Worker {
    const totalWorkers = this.workers.length;
    for (let i = 0; i < totalWorkers; i++) {
      const worker = this.workers[this.nextWorkerIndex];
      this.nextWorkerIndex = (this.nextWorkerIndex + 1) % totalWorkers;
      if (!worker.worker.closed) {
        return worker.worker;
      }
    }
    throw new Error('No available workers');
  }

  /**
   * Increment router count for a worker
   */
  incrementRouterCount(worker: MediasoupTypes.Worker): void {
    const workerInfo = this.workers.find((w) => w.worker === worker);
    if (workerInfo) {
      workerInfo.routerCount++;
    }
  }

  /**
   * Decrement router count for a worker
   */
  decrementRouterCount(worker: MediasoupTypes.Worker): void {
    const workerInfo = this.workers.find((w) => w.worker === worker);
    if (workerInfo && workerInfo.routerCount > 0) {
      workerInfo.routerCount--;
    }
  }

  getWorkerCount(): number {
    return this.workers.length;
  }

  getWorkerStats(): any[] {
    return this.workers.map((w, index) => ({
      index,
      pid: w.pid,
      routerCount: w.routerCount,
      closed: w.worker.closed,
      usage: w.usage,
    }));
  }

  private startResourceMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      for (const workerInfo of this.workers) {
        if (!workerInfo.worker.closed) {
          try {
            workerInfo.usage = await workerInfo.worker.getResourceUsage();
          } catch {
            // Worker might have died
          }
        }
      }
    }, 10000);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down workers...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    for (const workerInfo of this.workers) {
      if (!workerInfo.worker.closed) {
        workerInfo.worker.close();
      }
    }

    this.workers = [];
    logger.info('All workers closed');
  }
}
