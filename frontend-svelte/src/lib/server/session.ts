/**
 * Server-only session cookie helpers.
 *
 * The API bearer token is kept in an httpOnly, SameSite=Lax cookie so it is
 * never exposed to client-side JavaScript (a deliberate security upgrade over
 * the previous localStorage-token approach).
 */

import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const SESSION_COOKIE = 'tr_session';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function setSession(cookies: Cookies, token: string): void {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !dev,
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
