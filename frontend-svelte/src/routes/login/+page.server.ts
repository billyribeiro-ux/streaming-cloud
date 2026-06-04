/**
 * Login route — server-side form action (progressive enhancement).
 *
 * Validates credentials with zod, exchanges them for an API token via the BFF,
 * stores the token in an httpOnly session cookie, and redirects to the app.
 */

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { login, ApiError } from '$lib/server/api';
import { setSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) redirect(303, '/dashboard');
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '');
    const parsed = credentials.safeParse({ email, password: form.get('password') });

    if (!parsed.success) {
      return fail(422, { email, error: 'Enter a valid email and an 8+ character password.' });
    }

    try {
      const { token } = await login(parsed.data.email, parsed.data.password);
      setSession(cookies, token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return fail(401, { email, error: 'Invalid email or password.' });
      }
      return fail(502, { email, error: 'Sign-in is temporarily unavailable. Please try again.' });
    }

    redirect(303, '/dashboard');
  },
};
