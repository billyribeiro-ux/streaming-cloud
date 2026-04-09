/**
 * Auth Service - JWT verification and user authentication
 * Uses standard PostgreSQL (Neon) instead of Supabase
 */

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { DatabaseConfig } from '../config/index.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId?: string;
  role?: string;
  permissions: string[];
}

interface JWTPayload {
  sub?: string;
  /** Laravel SignalingService token uses user_id */
  user_id?: string;
  email?: string;
  organization_id?: string;
  room_id?: string;
  participant_id?: string;
  role?: string;
  display_name?: string;
  app_metadata?: {
    organization_id?: string;
    organization_role?: string;
  };
  iat?: number;
  exp?: number;
}

export class AuthService {
  private pool: Pool;
  private jwtSecret: string;
  /** Must match Laravel `services.signaling.secret` for participant JWTs */
  private signalingTokenSecret: string;

  constructor(dbConfig: DatabaseConfig, jwtSecret: string) {
    // Use connection string if available, otherwise use individual params
    if (dbConfig.connectionString) {
      this.pool = new Pool({
        connectionString: dbConfig.connectionString,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
      });
    } else {
      this.pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
      });
    }
    this.jwtSecret = jwtSecret;
    this.signalingTokenSecret =
      process.env.SIGNALING_SERVER_SECRET || jwtSecret;

    // Test connection on startup
    this.pool.query('SELECT NOW()').then(() => {
      logger.info('Database connection established');
    }).catch((err) => {
      logger.error({ error: err }, 'Failed to connect to database');
    });
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      // Verify JWT signature
      const decoded = jwt.verify(token, this.signalingTokenSecret) as JWTPayload;

      const userId = decoded.sub || decoded.user_id;
      if (!userId) {
        throw new Error('Invalid token: missing subject / user_id');
      }

      // Get user from database
      const result = await this.pool.query(
        'SELECT id, email FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      const orgRole =
        decoded.app_metadata?.organization_role ||
        (decoded.role as string | undefined);

      return {
        id: user.id,
        email: user.email || decoded.email || '',
        organizationId:
          decoded.app_metadata?.organization_id || decoded.organization_id,
        role: orgRole,
        permissions: this.getPermissionsForRole(orgRole),
      };
    } catch (error) {
      logger.error({ error }, 'Token verification failed');
      throw new Error('Authentication failed');
    }
  }

  async verifyOrganizationMembership(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'SELECT id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
        [userId, organizationId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error({ error }, 'Failed to verify organization membership');
      return false;
    }
  }

  private getPermissionsForRole(role: string | undefined): string[] {
    switch (role) {
      case 'owner':
        return ['manage', 'admin', 'stream', 'moderate', 'view'];
      case 'admin':
        return ['admin', 'stream', 'moderate', 'view'];
      case 'host':
        return ['stream', 'moderate', 'view'];
      case 'co_host':
        return ['stream', 'view'];
      case 'moderator':
        return ['moderate', 'view'];
      default:
        return ['view'];
    }
  }

  /**
   * Gracefully close database connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}
