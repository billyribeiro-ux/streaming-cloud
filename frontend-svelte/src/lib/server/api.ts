/**
 * Server-only Backend-for-Frontend (BFF) client.
 *
 * All calls to the Rust API run on the SvelteKit server, attaching the bearer
 * token from the session cookie. The browser never sees the token or talks to
 * the API directly for authenticated data.
 */

import { env } from '$env/dynamic/private';
import type { SessionUser } from '$lib/types';

const API_URL = env.API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API request to ${path} failed (${response.status})`);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/** Raw user shape returned by the API, mapped into a `SessionUser`. */
interface ApiUser {
  id: string;
  email: string;
  name: string;
  display_name?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
  role?: SessionUser['role'];
  is_admin?: boolean;
}

function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.display_name ?? null,
    avatarUrl: user.avatar_url ?? null,
    timezone: user.timezone ?? null,
    role: user.role ?? 'member',
    isAdmin: user.is_admin ?? false,
  };
}

export interface AdminStats {
  users: number;
  organizations: number;
  rooms: number;
  live_rooms: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  created_at: string;
}

export function adminStats(token: string): Promise<AdminStats> {
  return request<AdminStats>('/v1/admin/stats', { token });
}

export function adminUsers(token: string, pageNumber = 1): Promise<Page<AdminUserRow>> {
  return request<Page<AdminUserRow>>(`/v1/admin/users?page=${pageNumber}`, { token });
}

/** Updates the current user's profile. */
export function updateProfile(
  token: string,
  body: { name?: string; display_name?: string; avatar_url?: string; timezone?: string }
): Promise<{ user: ApiUser }> {
  return request<{ user: ApiUser }>('/v1/auth/profile', { method: 'PUT', token, body });
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: SessionUser }> {
  const data = await request<{ token: string; user: ApiUser }>('/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return { token: data.token, user: toSessionUser(data.user) };
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<{ token: string; user: SessionUser }> {
  const data = await request<{ token: string; user: ApiUser }>('/v1/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
  return { token: data.token, user: toSessionUser(data.user) };
}

// ---------------------------------------------------------------------------
// Rooms / workspaces / organizations
// ---------------------------------------------------------------------------

export type RoomStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface Room {
  id: string;
  workspace_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  slug: string;
  status: RoomStatus;
  scheduled_start: string | null;
  recording_enabled: boolean;
  is_public: boolean;
  created_at: string;
}

export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  slug: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number };
}

export function listRooms(
  token: string,
  params: { page?: number; status?: RoomStatus } = {}
): Promise<Page<Room>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<Page<Room>>(`/v1/rooms${suffix}`, { token });
}

export function listWorkspaces(token: string): Promise<Workspace[]> {
  return request<Workspace[]>('/v1/workspaces', { token });
}

export function listOrganizations(token: string): Promise<Organization[]> {
  return request<Organization[]>('/v1/organizations', { token });
}

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  max_workspaces: number;
  max_rooms: number;
  max_hosts_per_room: number;
  max_viewers_per_room: number;
  max_storage_gb: number;
  features: Record<string, unknown>;
}

export interface SubscriptionInfo {
  subscription: { status: string; current_period_end: string | null } | null;
  plan: Plan | null;
  has_active_subscription: boolean;
}

export function listPlans(token: string): Promise<Plan[]> {
  return request<Plan[]>('/v1/plans', { token });
}

export function getSubscription(token: string, organizationId: string): Promise<SubscriptionInfo> {
  return request<SubscriptionInfo>(
    `/v1/billing/subscription?organization_id=${encodeURIComponent(organizationId)}`,
    { token }
  );
}

export function startCheckout(
  token: string,
  body: { organization_id: string; plan_id: string; billing_period: 'monthly' | 'yearly' }
): Promise<{ checkout_url: string }> {
  return request<{ checkout_url: string }>('/v1/billing/subscribe', { method: 'POST', token, body });
}

export function billingPortal(
  token: string,
  body: { organization_id: string }
): Promise<{ portal_url: string }> {
  return request<{ portal_url: string }>('/v1/billing/portal', { method: 'POST', token, body });
}

export function createWorkspace(
  token: string,
  body: { organization_id: string; name: string; description?: string }
): Promise<Workspace> {
  return request<Workspace>('/v1/workspaces', { method: 'POST', token, body });
}

export function createRoom(
  token: string,
  body: {
    workspace_id: string;
    name: string;
    description?: string;
    is_public?: boolean;
    recording_enabled?: boolean;
  }
): Promise<Room> {
  return request<Room>('/v1/rooms', { method: 'POST', token, body });
}

export function getRoom(token: string, id: string): Promise<Room> {
  return request<Room>(`/v1/rooms/${id}`, { token });
}

export interface JoinResult {
  token: string;
  signaling_url: string;
  participant: {
    id: string;
    user_id: string;
    role: string;
    display_name: string | null;
  };
  room: Room;
}

/** Goes live / joins a room, returning the participant's signaling token. */
export function joinRoom(
  token: string,
  id: string,
  body: { display_name?: string } = {}
): Promise<JoinResult> {
  return request<JoinResult>(`/v1/rooms/${id}/join`, { method: 'POST', token, body });
}

export function leaveRoom(token: string, id: string): Promise<void> {
  return request<void>(`/v1/rooms/${id}/leave`, { method: 'POST', token });
}

/** Resolves the current user for a token, or `null` if the token is invalid. */
export async function fetchCurrentUser(token: string): Promise<SessionUser | null> {
  try {
    const data = await request<{ user: ApiUser }>('/v1/auth/me', { token });
    return toSessionUser(data.user);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
