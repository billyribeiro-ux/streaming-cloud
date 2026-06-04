<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Users · Admin</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-4xl">
    <a href="/admin" class="text-sm text-slate-400 hover:text-slate-300">← Admin</a>
    <h1 class="mb-1 mt-2 text-2xl font-bold text-white">Users</h1>
    <p class="mb-6 text-sm text-slate-400">{data.meta.total} total</p>

    <div class="overflow-hidden rounded-2xl border border-slate-800">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-900 text-slate-400">
          <tr>
            <th class="px-4 py-3 font-medium">Name</th>
            <th class="px-4 py-3 font-medium">Email</th>
            <th class="px-4 py-3 font-medium">Role</th>
            <th class="px-4 py-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800 bg-slate-950">
          {#each data.users as user (user.id)}
            <tr>
              <td class="px-4 py-3 text-white">{user.name}</td>
              <td class="px-4 py-3 text-slate-300">{user.email}</td>
              <td class="px-4 py-3">
                {#if user.is_admin}
                  <span class="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs text-brand-400">admin</span>
                {:else}
                  <span class="text-slate-500">member</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-slate-400">{formatDate(user.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
