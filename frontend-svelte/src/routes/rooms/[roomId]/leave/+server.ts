/** BFF leave proxy: marks the caller's presence in the room as left. */

import { json } from '@sveltejs/kit';
import { leaveRoom } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, cookies, locals }) => {
  if (!locals.user) return json({ ok: false });

  const token = cookies.get(SESSION_COOKIE) ?? '';
  await leaveRoom(token, params.roomId);
  return json({ ok: true });
};
