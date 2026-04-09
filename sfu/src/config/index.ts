/**
 * SFU configuration from environment
 */

import 'dotenv/config';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
}

export interface MediasoupConfig {
  numWorkers?: number;
  logLevel: string;
  logTags: string[];
  rtcMinPort: number;
  rtcMaxPort: number;
  maxRoomsPerNode: number;
}

export interface CorsConfig {
  origins: string[];
}

export interface Config {
  port: number;
  host: string;
  nodeId: string;
  redis: RedisConfig;
  mediasoup: MediasoupConfig;
  cors: CorsConfig;
}

function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config: Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeId: process.env.NODE_ID || `sfu-${process.pid}`,
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  mediasoup: {
    numWorkers: process.env.MEDIASOUP_NUM_WORKERS
      ? parseInt(process.env.MEDIASOUP_NUM_WORKERS, 10)
      : undefined,
    logLevel: process.env.MEDIASOUP_LOG_LEVEL || 'warn',
    logTags: parseArray(process.env.MEDIASOUP_LOG_TAGS, ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']),
    rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '10000', 10),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '10100', 10),
    maxRoomsPerNode: parseInt(process.env.MEDIASOUP_MAX_ROOMS_PER_NODE || '500', 10),
  },
  cors: {
    origins: parseArray(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  },
};
