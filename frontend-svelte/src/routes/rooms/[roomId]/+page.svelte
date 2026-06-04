<script lang="ts">
  import BackLink from '$lib/components/BackLink.svelte';
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
  <title>{data.room.name} · Trading Room</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-3xl">
    <BackLink href="/rooms" label="Back to rooms" />

    <div class="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <div class="mb-4 flex items-start justify-between gap-4">
        <h1 class="text-2xl font-bold text-white">{data.room.name}</h1>
        <span
          class={`rounded-full px-3 py-1 text-xs font-medium ${statusStyles[data.room.status] ?? statusStyles.ended}`}
        >
          {data.room.status}
        </span>
      </div>

      {#if data.room.description}
        <p class="mb-6 text-slate-400">{data.room.description}</p>
      {/if}

      <dl class="mb-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt class="text-slate-500">Recording</dt>
          <dd class="text-slate-200">{data.room.recording_enabled ? 'Enabled' : 'Disabled'}</dd>
        </div>
        <div>
          <dt class="text-slate-500">Visibility</dt>
          <dd class="text-slate-200">{data.room.is_public ? 'Public' : 'Private'}</dd>
        </div>
      </dl>

      <a
        href={`/rooms/${data.room.id}/live`}
        class="inline-block rounded-lg bg-brand-600 px-5 py-3 font-medium text-white transition-colors hover:bg-brand-500"
      >
        {data.room.status === 'live' ? 'Join live room' : 'Enter room'}
      </a>
    </div>
  </div>
</div>
