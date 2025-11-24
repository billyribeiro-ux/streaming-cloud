/**
 * Auth Service - JWT verification and user authentication
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId?: string;
  role?: string;
  permissions: string[];
}

interface SupabaseConfig {
  url: string;
  serviceKey: string;
  jwtSecret: string;
}

export class AuthService {
  private supabase: SupabaseClient;
  private jwtSecret: string;

  constructor(config: SupabaseConfig) {
    this.supabase = createClient(config.url, config.serviceKey);
    this.jwtSecret = config.jwtSecret;
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      // Verify JWT signature
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      // Get user from Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new Error('Invalid token');
      }

      return {
        id: user.id,
        email: user.email || '',
        organizationId: decoded.app_metadata?.organization_id,
        role: decoded.app_metadata?.organization_role,
        permissions: this.getPermissionsForRole(decoded.app_metadata?.organization_role),
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
    const { data, error } = await this.supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
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
}
