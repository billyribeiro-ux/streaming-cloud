/** Room detail — server-loaded room info with a link into the live session. */

import { error, redirect } from '@sveltejs/kit';
import { getRoom, ApiError } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';
  try {
    const room = await getRoom(token, params.roomId);
    return { room };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
      error(404, 'Room not found');
    }
    throw err;
  }
};
