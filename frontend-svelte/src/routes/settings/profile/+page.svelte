<script lang="ts">
  import BackLink from '$lib/components/BackLink.svelte';
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let saving = $state(false);
</script>

<svelte:head>
  <title>Profile · Settings</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-xl">
    <BackLink href="/dashboard" label="Dashboard" />
    <h1 class="mb-6 mt-2 text-2xl font-bold text-white">Profile</h1>

    {#if form?.success}
      <p class="mb-4 rounded-lg bg-success-500/10 px-4 py-3 text-sm text-success-400" role="status">
        Profile saved.
      </p>
    {:else if form?.error}
      <p class="mb-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-400" role="alert">
        {form.error}
      </p>
    {/if}

    <form
      method="POST"
      use:enhance={() => {
        saving = true;
        return async ({ update }) => {
          await update();
          saving = false;
        };
      }}
      class="rounded-2xl border border-slate-800 bg-slate-900 p-6"
    >
      <label for="email" class="mb-2 block text-sm font-medium text-slate-300">Email</label>
      <input
        id="email"
        type="email"
        value={data.user?.email ?? ''}
        disabled
        class="mb-4 w-full cursor-not-allowed rounded-lg border border-slate-800 bg-slate-800/50 px-4 py-3 text-slate-400"
      />

      <label for="name" class="mb-2 block text-sm font-medium text-slate-300">Name</label>
      <input
        id="name"
        name="name"
        type="text"
        required
        value={data.user?.name ?? ''}
        class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
      />

      <label for="display_name" class="mb-2 block text-sm font-medium text-slate-300">
        Display name
      </label>
      <input
        id="display_name"
        name="display_name"
        type="text"
        value={data.user?.displayName ?? ''}
        class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
      />

      <label for="avatar_url" class="mb-2 block text-sm font-medium text-slate-300">
        Avatar URL
      </label>
      <input
        id="avatar_url"
        name="avatar_url"
        type="url"
        value={data.user?.avatarUrl ?? ''}
        class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-brand-500 focus:outline-none"
      />

      <label for="timezone" class="mb-2 block text-sm font-medium text-slate-300">Timezone</label>
      <input
        id="timezone"
        name="timezone"
        type="text"
        placeholder="e.g. America/New_York"
        value={data.user?.timezone ?? ''}
        class="mb-6 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
      />

      <button
        type="submit"
        disabled={saving}
        class="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  </div>
</div>
