<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);

  const submit = () => {
    submitting = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      submitting = false;
    };
  };
</script>

<svelte:head>
  <title>New room · Trading Room</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-xl">
    <a href="/rooms" class="text-sm text-slate-400 hover:text-slate-300">← Back to rooms</a>
    <h1 class="mb-6 mt-2 text-2xl font-bold text-white">New room</h1>

    {#if form?.error}
      <p class="mb-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-400" role="alert">
        {form.error}
      </p>
    {/if}

    {#if data.workspaces.length === 0}
      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 class="mb-1 text-lg font-semibold text-white">Create a workspace first</h2>
        <p class="mb-4 text-sm text-slate-400">Rooms live inside a workspace.</p>

        <form method="POST" action="?/createWorkspace" use:enhance={submit}>
          <label for="organization_id" class="mb-2 block text-sm font-medium text-slate-300">
            Organization
          </label>
          <select
            id="organization_id"
            name="organization_id"
            required
            class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
          >
            {#each data.organizations as org (org.id)}
              <option value={org.id}>{org.name}</option>
            {/each}
          </select>

          <label for="workspace_name" class="mb-2 block text-sm font-medium text-slate-300">
            Workspace name
          </label>
          <input
            id="workspace_name"
            name="workspace_name"
            type="text"
            required
            class="mb-6 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
          />

          <button
            type="submit"
            disabled={submitting}
            class="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create workspace'}
          </button>
        </form>
      </div>
    {:else}
      <form
        method="POST"
        action="?/createRoom"
        use:enhance={submit}
        class="rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <label for="workspace_id" class="mb-2 block text-sm font-medium text-slate-300">
          Workspace
        </label>
        <select
          id="workspace_id"
          name="workspace_id"
          required
          class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
        >
          {#each data.workspaces as workspace (workspace.id)}
            <option value={workspace.id}>{workspace.name}</option>
          {/each}
        </select>

        <label for="name" class="mb-2 block text-sm font-medium text-slate-300">Room name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
        />

        <label for="description" class="mb-2 block text-sm font-medium text-slate-300">
          Description <span class="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows="3"
          class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
        ></textarea>

        <label class="mb-6 flex items-center gap-2 text-sm text-slate-300">
          <input name="is_public" type="checkbox" class="rounded border-slate-700 bg-slate-800" />
          Make this room public
        </label>

        <button
          type="submit"
          disabled={submitting}
          class="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create room'}
        </button>
      </form>
    {/if}
  </div>
</div>
