/**
 * Create room — loads the caller's organizations and workspaces, and exposes
 * actions to create a workspace (if none exists yet) and to create a room.
 */

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
  createRoom,
  createWorkspace,
  listOrganizations,
  listWorkspaces,
} from '$lib/server/api';
import { SESSION_COOKIE } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (!locals.user) redirect(303, '/login');
  const token = cookies.get(SESSION_COOKIE) ?? '';
  const [organizations, workspaces] = await Promise.all([
    listOrganizations(token),
    listWorkspaces(token),
  ]);
  return { organizations, workspaces };
};

const workspaceSchema = z.object({
  organization_id: z.string().min(1),
  name: z.string().min(1).max(255),
});

const roomSchema = z.object({
  workspace_id: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  is_public: z.boolean().optional(),
});

export const actions: Actions = {
  createWorkspace: async ({ request, cookies, locals }) => {
    if (!locals.user) redirect(303, '/login');
    const token = cookies.get(SESSION_COOKIE) ?? '';
    const data = await request.formData();
    const parsed = workspaceSchema.safeParse({
      organization_id: data.get('organization_id'),
      name: data.get('workspace_name'),
    });
    if (!parsed.success) {
      return fail(422, { error: 'Choose an organization and a workspace name.' });
    }
    try {
      await createWorkspace(token, parsed.data);
    } catch {
      return fail(502, { error: 'Could not create the workspace. Please try again.' });
    }
    redirect(303, '/rooms/new');
  },

  createRoom: async ({ request, cookies, locals }) => {
    if (!locals.user) redirect(303, '/login');
    const token = cookies.get(SESSION_COOKIE) ?? '';
    const data = await request.formData();
    const parsed = roomSchema.safeParse({
      workspace_id: data.get('workspace_id'),
      name: data.get('name'),
      description: (data.get('description') as string) || undefined,
      is_public: data.get('is_public') === 'on',
    });
    if (!parsed.success) {
      return fail(422, { error: 'Pick a workspace and enter a room name.' });
    }
    try {
      await createRoom(token, parsed.data);
    } catch {
      return fail(502, { error: 'Could not create the room. Please try again.' });
    }
    redirect(303, '/rooms');
  },
};
