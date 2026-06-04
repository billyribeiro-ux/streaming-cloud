/** Admin — users list (admins only; API enforces 403). */

import { error, redirect } from '@sveltejs/kit';
import { adminUsers, ApiError } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';
  const pageNumber = Number(url.searchParams.get('page') ?? '1') || 1;
  try {
    const result = await adminUsers(token, pageNumber);
    return { users: result.data, meta: result.meta };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      error(403, 'Administrators only');
    }
    throw err;
  }
};
