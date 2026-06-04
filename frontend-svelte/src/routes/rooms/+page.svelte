<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const statusStyles: Record<string, string> = {
    live: 'bg-success-500/15 text-success-400',
    scheduled: 'bg-brand-500/15 text-brand-400',
    ended: 'bg-slate-500/15 text-slate-400',
    cancelled: 'bg-danger-500/15 text-danger-400',
  };
</script>

<svelte:head>
  <title>Rooms · Trading Room</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-4xl">
    <header class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Rooms</h1>
        <p class="text-sm text-slate-400">Your trading rooms across all workspaces.</p>
      </div>
      <a
        href="/rooms/new"
        class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
      >
        New room
      </a>
    </header>

    {#if data.rooms.length === 0}
      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
        <p class="text-slate-400">No rooms yet.</p>
        <a href="/rooms/new" class="mt-2 inline-block text-brand-400 hover:text-brand-300">
          Create your first room
        </a>
      </div>
    {:else}
      <ul class="space-y-3">
        {#each data.rooms as room (room.id)}
          <li>
            <a
              href={`/rooms/${room.id}`}
              class="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-700"
            >
              <div>
                <p class="font-medium text-white">{room.name}</p>
                {#if room.description}
                  <p class="text-sm text-slate-400">{room.description}</p>
                {/if}
              </div>
              <span
                class={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[room.status] ?? statusStyles.ended}`}
              >
                {room.status}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
