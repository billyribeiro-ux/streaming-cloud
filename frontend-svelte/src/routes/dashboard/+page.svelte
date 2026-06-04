<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Dashboard · Trading Room</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-4xl">
    <header class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <p class="text-sm text-slate-400">
          Signed in as {data.user?.displayName ?? data.user?.name} ({data.user?.email})
        </p>
      </div>

      <form method="POST" action="?/logout" use:enhance>
        <button
          type="submit"
          class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Sign out
        </button>
      </form>
    </header>

    <div class="rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <p class="text-slate-400">
        Your rooms, workspaces, and analytics will appear here as the migration
        progresses (phases F2–F3).
      </p>
    </div>
  </div>
</div>
