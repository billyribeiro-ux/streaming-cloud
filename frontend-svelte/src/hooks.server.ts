/**
 * Server hooks: resolve the authenticated user once per request from the
 * session cookie and expose it on `event.locals` for loaders and actions.
 */

import type { Handle } from '@sveltejs/kit';
import { fetchCurrentUser } from '$lib/server/api';
import { clearSession, SESSION_COOKIE } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE);

  if (token) {
    const user = await fetchCurrentUser(token);
    event.locals.user = user;
    // Drop a stale/invalid token so the browser stops sending it.
    if (!user) clearSession(event.cookies);
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
