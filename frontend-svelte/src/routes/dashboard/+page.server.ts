/**
 * Dashboard — an authenticated route. Guards on the server (redirecting
 * unauthenticated visitors to login) and exposes a logout action.
 */

import { redirect } from '@sveltejs/kit';
import { clearSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) redirect(303, '/login');
  return { user: locals.user };
};

export const actions: Actions = {
  logout: async ({ cookies }) => {
    clearSession(cookies);
    redirect(303, '/login');
  },
};
