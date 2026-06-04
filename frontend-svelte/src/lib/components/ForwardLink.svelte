<script lang="ts">
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';

  let { href, label }: { href: string; label: string } = $props();
</script>

<a
  {href}
  class="inline-flex items-center gap-1 text-brand-400 transition-colors hover:text-brand-300"
>
  {label}
  <ArrowRight size={14} />
</a>
