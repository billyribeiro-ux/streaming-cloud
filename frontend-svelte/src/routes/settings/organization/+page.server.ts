/** Organization settings — org overview and workspace management. */

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { createWorkspace, listOrganizations, listWorkspaces } from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';

  const organizations = await listOrganizations(token);
  const organization = organizations[0] ?? null;
  const workspaces = organization ? await listWorkspaces(token) : [];

  return { organization, workspaces };
};

const schema = z.object({
  organization_id: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const actions: Actions = {
  createWorkspace: async ({ request, cookies, locals }) => {
    if (!locals.user) redirect(303, '/login');
    const token = cookies.get(SESSION_COOKIE) ?? '';
    const form = await request.formData();
    const parsed = schema.safeParse({
      organization_id: form.get('organization_id'),
      name: form.get('name'),
      description: (form.get('description') as string) || undefined,
    });

    if (!parsed.success) {
      return fail(422, { error: 'Enter a workspace name.' });
    }

    try {
      await createWorkspace(token, parsed.data);
    } catch {
      return fail(502, { error: 'Could not create the workspace.' });
    }

    return { success: true };
  },
};
