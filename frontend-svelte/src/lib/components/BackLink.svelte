<script lang="ts">
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';

  let { href, label }: { href: string; label: string } = $props();
</script>

<a
  {href}
  class="inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-300"
>
  <ArrowLeft size={16} />
  {label}
</a>
