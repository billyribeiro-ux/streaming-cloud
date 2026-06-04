<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let period = $state<'monthly' | 'yearly'>('monthly');

  const status = page.url.searchParams.get('status');

  function price(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
  }
</script>

<svelte:head>
  <title>Billing · Settings</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 px-6 py-10">
  <div class="mx-auto max-w-4xl">
    <a href="/dashboard" class="text-sm text-slate-400 hover:text-slate-300">← Dashboard</a>
    <h1 class="mb-6 mt-2 text-2xl font-bold text-white">Billing</h1>

    {#if status === 'success'}
      <p class="mb-4 rounded-lg bg-success-500/10 px-4 py-3 text-sm text-success-400" role="status">
        Subscription updated. Thank you!
      </p>
    {:else if status === 'cancelled'}
      <p class="mb-4 rounded-lg bg-slate-700/30 px-4 py-3 text-sm text-slate-300" role="status">
        Checkout cancelled.
      </p>
    {/if}

    {#if form?.error}
      <p class="mb-4 rounded-lg bg-danger-500/10 px-4 py-3 text-sm text-danger-400" role="alert">
        {form.error}
      </p>
    {/if}

    {#if !data.organization}
      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-400">
        You don't belong to an organization yet.
      </div>
    {:else}
      <!-- Current subscription -->
      <div class="mb-8 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <p class="text-sm text-slate-400">Current plan</p>
          <p class="text-lg font-semibold text-white">
            {data.subscription?.plan?.display_name ?? 'Free'}
            {#if data.subscription?.has_active_subscription}
              <span class="ml-2 rounded-full bg-success-500/15 px-2 py-0.5 text-xs text-success-400">
                {data.subscription.subscription?.status}
              </span>
            {/if}
          </p>
        </div>
        {#if data.subscription?.has_active_subscription}
          <form method="POST" action="?/portal" use:enhance>
            <input type="hidden" name="organization_id" value={data.organization.id} />
            <button
              type="submit"
              class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Manage billing
            </button>
          </form>
        {/if}
      </div>

      <!-- Billing period toggle -->
      <div class="mb-6 inline-flex rounded-lg border border-slate-700 p-1 text-sm">
        <button
          class={`rounded-md px-4 py-1.5 ${period === 'monthly' ? 'bg-brand-600 text-white' : 'text-slate-300'}`}
          onclick={() => (period = 'monthly')}
        >
          Monthly
        </button>
        <button
          class={`rounded-md px-4 py-1.5 ${period === 'yearly' ? 'bg-brand-600 text-white' : 'text-slate-300'}`}
          onclick={() => (period = 'yearly')}
        >
          Yearly
        </button>
      </div>

      <!-- Plans -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.plans as plan (plan.id)}
          <div class="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 class="text-lg font-semibold text-white">{plan.display_name}</h2>
            <p class="mb-4 mt-1 text-2xl font-bold text-white">
              {period === 'yearly' ? price(plan.price_yearly_cents) : price(plan.price_monthly_cents)}
              <span class="text-sm font-normal text-slate-400">/{period === 'yearly' ? 'yr' : 'mo'}</span>
            </p>
            <ul class="mb-6 flex-1 space-y-1 text-sm text-slate-400">
              <li>{plan.max_rooms < 0 ? 'Unlimited' : plan.max_rooms} rooms</li>
              <li>{plan.max_viewers_per_room} viewers / room</li>
              <li>{plan.max_storage_gb} GB storage</li>
            </ul>
            <form method="POST" action="?/subscribe" use:enhance>
              <input type="hidden" name="organization_id" value={data.organization.id} />
              <input type="hidden" name="plan_id" value={plan.id} />
              <input type="hidden" name="billing_period" value={period} />
              <button
                type="submit"
                class="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-500"
              >
                Choose {plan.display_name}
              </button>
            </form>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
