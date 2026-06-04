/** Admin dashboard — platform-wide stats (admins only; API enforces 403). */

import { error, redirect } from '@sveltejs/kit';
import { adminStats, ApiError } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';
  try {
    return { stats: await adminStats(token) };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      error(403, 'Administrators only');
    }
    throw err;
  }
};
