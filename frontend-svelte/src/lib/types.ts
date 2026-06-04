/**
 * Shared domain types for the SvelteKit frontend.
 */

export type OrganizationRole = 'owner' | 'admin' | 'member';

/** The authenticated user as carried in the server session and page data. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  role: OrganizationRole;
  isAdmin: boolean;
}
