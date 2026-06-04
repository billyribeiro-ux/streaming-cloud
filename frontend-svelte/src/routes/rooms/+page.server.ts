/** Rooms list — authenticated server load via the BFF. */

import { redirect } from '@sveltejs/kit';
import { listRooms } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';
  const rooms = await listRooms(token);
  return { rooms: rooms.data };
};
