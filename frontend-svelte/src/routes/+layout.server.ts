/**
 * Root server load: surfaces the authenticated user (resolved in
 * `hooks.server.ts`) to every page via layout data.
 */

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
  return { user: locals.user };
};
