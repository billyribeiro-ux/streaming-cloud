<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let creating = $state(false);
</script>

<svelte:head>
  <title>Organization · Settings</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-3xl">
    <a href="/dashboard" class="text-sm text-slate-400 hover:text-slate-300">← Dashboard</a>
    <h1 class="mb-6 mt-2 text-2xl font-bold text-white">Organization</h1>

    {#if !data.organization}
      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-400">
        You don't belong to an organization yet.
      </div>
    {:else}
      <div class="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p class="text-sm text-slate-400">Name</p>
        <p class="mb-3 text-lg font-semibold text-white">{data.organization.name}</p>
        <p class="text-sm text-slate-400">Slug</p>
        <p class="font-mono text-sm text-slate-300">{data.organization.slug}</p>
      </div>

      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">Workspaces</h2>
        <span class="text-sm text-slate-500">{data.workspaces.length} total</span>
      </div>

      {#if data.workspaces.length > 0}
        <ul class="mb-8 space-y-2">
          {#each data.workspaces as workspace (workspace.id)}
            <li class="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p class="font-medium text-white">{workspace.name}</p>
              {#if workspace.description}
                <p class="text-sm text-slate-400">{workspace.description}</p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      {#if form?.success}
        <p class="mb-4 rounded-lg bg-success-500/10 px-4 py-3 text-sm text-success-400" role="status">
          Workspace created.
        </p>
      {:else if form?.error}
        <p class="mb-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-400" role="alert">
          {form.error}
        </p>
      {/if}

      <form
        method="POST"
        action="?/createWorkspace"
        use:enhance={() => {
          creating = true;
          return async ({ update }) => {
            await update();
            creating = false;
          };
        }}
        class="rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <h3 class="mb-4 font-semibold text-white">New workspace</h3>
        <input type="hidden" name="organization_id" value={data.organization.id} />

        <label for="name" class="mb-2 block text-sm font-medium text-slate-300">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
        />

        <label for="description" class="mb-2 block text-sm font-medium text-slate-300">
          Description <span class="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows="2"
          class="mb-6 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
        ></textarea>

        <button
          type="submit"
          disabled={creating}
          class="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
    {/if}
  </div>
</div>
