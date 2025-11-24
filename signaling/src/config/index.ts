/**
 * Configuration Module
 * Loads environment variables and provides typed configuration
 */

import 'dotenv/config';

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
  jwtSecret: string;
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
  supabase: SupabaseConfig;
  redis: RedisConfig;
  sfu: SFUConfig;
  cors: CorsConfig;
  jwtSecret: string;
}

function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
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
};
