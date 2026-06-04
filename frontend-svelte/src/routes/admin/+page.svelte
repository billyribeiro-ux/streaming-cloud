<script lang="ts">
  import BackLink from '$lib/components/BackLink.svelte';
  import ForwardLink from '$lib/components/ForwardLink.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const cards = $derived([
    { label: 'Users', value: data.stats.users },
    { label: 'Organizations', value: data.stats.organizations },
    { label: 'Rooms', value: data.stats.rooms },
    { label: 'Live now', value: data.stats.live_rooms },
  ]);
</script>

<svelte:head>
  <title>Admin · Trading Room</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-4xl">
    <BackLink href="/dashboard" label="Dashboard" />
    <h1 class="mb-6 mt-2 text-2xl font-bold text-white">Admin</h1>

    <div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {#each cards as card (card.label)}
        <div class="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p class="text-sm text-slate-400">{card.label}</p>
          <p class="mt-1 text-3xl font-bold text-white">{card.value}</p>
        </div>
      {/each}
    </div>

    <ForwardLink href="/admin/users" label="Manage users" />
  </div>
</div>
