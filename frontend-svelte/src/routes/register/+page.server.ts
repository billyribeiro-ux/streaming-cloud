/**
 * Registration route — server-side form action.
 *
 * Validates input with zod, creates the account via the BFF, stores the issued
 * token in the session cookie, and redirects into the app.
 */

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { register, ApiError } from '$lib/server/api';
import { setSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(255),
});

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/dashboard');
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const name = String(data.get('name') ?? '');
    const email = String(data.get('email') ?? '');
    const parsed = schema.safeParse({ name, email, password: data.get('password') });

    if (!parsed.success) {
      return fail(422, {
        name,
        email,
        error: 'Enter your name, a valid email, and an 8+ character password.',
      });
    }

    try {
      const { token } = await register(parsed.data.name, parsed.data.email, parsed.data.password);
      setSession(cookies, token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        return fail(422, { name, email, error: 'That email is already registered.' });
      }
      return fail(502, { name, email, error: 'Sign-up is temporarily unavailable. Please try again.' });
    }

    redirect(303, '/dashboard');
  },
};
