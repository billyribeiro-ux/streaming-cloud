/**
 * Auth context store (Svelte 5 runes).
 *
 * Request-scoped via Svelte context — never module-level mutable state — so it
 * is safe under SSR (no cross-request leakage). The root layout seeds and keeps
 * it in sync with server-provided page data.
 */

import { getContext, setContext } from 'svelte';
import type { SessionUser } from '$lib/types';

const AUTH_KEY = Symbol('auth');

export class AuthState {
  readonly #user: () => SessionUser | null;

  /**
   * @param user A getter that reads the current user from reactive source
   *   (e.g. layout data), so the context stays live across navigations.
   */
  constructor(user: () => SessionUser | null) {
    this.#user = user;
  }

  get user(): SessionUser | null {
    return this.#user();
  }

  get isAuthenticated(): boolean {
    return this.#user() !== null;
  }
}

export function setAuthContext(user: () => SessionUser | null): AuthState {
  return setContext(AUTH_KEY, new AuthState(user));
}

export function getAuthContext(): AuthState {
  return getContext<AuthState>(AUTH_KEY);
}
