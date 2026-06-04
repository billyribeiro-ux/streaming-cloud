<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let loading = $state(false);
</script>

<svelte:head>
  <title>Create account · Trading Room</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-950 px-4">
  <div class="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-xl">
    <h1 class="mb-2 text-2xl font-bold text-white">Create your account</h1>
    <p class="mb-6 text-sm text-slate-400">Start hosting trading rooms in minutes.</p>

    {#if form?.error}
      <p class="mb-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-400" role="alert">
        {form.error}
      </p>
    {/if}

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          await update();
          loading = false;
        };
      }}
    >
      <label for="name" class="mb-2 block text-sm font-medium text-slate-300">Name</label>
      <input
        id="name"
        name="name"
        type="text"
        autocomplete="name"
        required
        value={form?.name ?? ''}
        class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <label for="email" class="mb-2 block text-sm font-medium text-slate-300">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        required
        value={form?.email ?? ''}
        class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <label for="password" class="mb-2 block text-sm font-medium text-slate-300">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="new-password"
        required
        minlength="8"
        class="mb-6 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <p class="mt-4 text-center text-sm text-slate-400">
        Already have an account?
        <a href="/login" class="text-brand-400 hover:text-brand-300">Sign in</a>
      </p>
    </form>
  </div>
</div>
