/**
 * Configuration Module
 * Loads environment variables and provides typed configuration
 */

import 'dotenv/config';

export interface DatabaseConfig {
  connectionString: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
}

export interface SFUConfig {
  nodes: string[];
  secret: string;
}

export interface CorsConfig {
  origins: string[];
}

export interface Config {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  sfu: SFUConfig;
  cors: CorsConfig;
  jwtSecret: string;
  /** Laravel SIGNALING_SERVER_SECRET — Bearer for /api/rooms/* control routes */
  signalingControlSecret: string;
}

function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    connectionString: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'tradingroom',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  sfu: {
    nodes: parseArray(process.env.SFU_NODES, ['localhost:4000']),
    secret: process.env.SFU_SECRET || 'dev-secret',
  },

  cors: {
    origins: parseArray(process.env.CORS_ORIGINS, ['http://localhost:5173']),
  },

  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',

  signalingControlSecret:
    process.env.SIGNALING_SERVER_SECRET ||
    process.env.SFU_SECRET ||
    'dev-secret',
};
