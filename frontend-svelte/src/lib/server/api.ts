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

  return (await response.json()) as T;
}

/** Raw user shape returned by the API, mapped into a `SessionUser`. */
interface ApiUser {
  id: string;
  email: string;
  name: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: SessionUser['role'];
}

function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.display_name ?? null,
    avatarUrl: user.avatar_url ?? null,
    role: user.role ?? 'member',
  };
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
