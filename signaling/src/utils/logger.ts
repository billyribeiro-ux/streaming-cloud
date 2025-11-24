/**
 * Logger Module
 * Structured logging with Pino
 */

import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'signaling-server',
    version: process.env.npm_package_version || '1.0.0',
  },
});

export default logger;
