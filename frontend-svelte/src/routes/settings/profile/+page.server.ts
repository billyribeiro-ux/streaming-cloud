/** Profile settings — edit the current user's profile via the BFF. */

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { updateProfile } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) redirect(303, '/login');
  return { user: locals.user };
};

const schema = z.object({
  name: z.string().min(1).max(255),
  display_name: z.string().max(255).optional(),
  timezone: z.string().max(64).optional(),
  avatar_url: z.string().max(2048).optional(),
});

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    if (!locals.user) redirect(303, '/login');
    const token = cookies.get(SESSION_COOKIE) ?? '';
    const form = await request.formData();
    const parsed = schema.safeParse({
      name: form.get('name'),
      display_name: (form.get('display_name') as string) || undefined,
      timezone: (form.get('timezone') as string) || undefined,
      avatar_url: (form.get('avatar_url') as string) || undefined,
    });

    if (!parsed.success) {
      return fail(422, { error: 'Please check the form fields and try again.' });
    }

    try {
      await updateProfile(token, parsed.data);
    } catch {
      return fail(502, { error: 'Could not save your profile. Please try again.' });
    }

    return { success: true };
  },
};
