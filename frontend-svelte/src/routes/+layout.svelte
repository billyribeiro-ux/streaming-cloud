<script lang="ts">
  import '../app.css';
  import { setAuthContext } from '$lib/stores/auth.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

  // Request-scoped auth context backed by a getter, so it stays reactive to
  // server data across navigations (no module-level state, SSR-safe).
  setAuthContext(() => data.user ?? null);
</script>

<div class="min-h-screen bg-slate-950 text-slate-200">
  {@render children()}
</div>
