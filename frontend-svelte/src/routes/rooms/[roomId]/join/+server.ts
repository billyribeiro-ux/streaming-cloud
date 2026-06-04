/**
 * BFF join proxy: exchanges the session cookie for a short-lived signaling
 * token (minted by the API), which the browser presents to the signaling
 * WebSocket. The API token itself never reaches client JavaScript.
 */

import { error, json } from '@sveltejs/kit';
import { joinRoom } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, cookies, locals, request }) => {
  if (!locals.user) error(401, 'Unauthorized');

  const token = cookies.get(SESSION_COOKIE) ?? '';
  const body = (await request.json().catch(() => ({}))) as { display_name?: string };

  const result = await joinRoom(token, params.roomId, {
    display_name: body.display_name,
  });

  return json(result);
};
