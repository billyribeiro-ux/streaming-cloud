<!--
  VideoTile Component
  Displays a participant's video/audio with overlays for name, role, quality, and state.
-->

<script lang="ts">
  import type { Participant } from '../stores/room.svelte';

  let {
    participant,
    videoTrack = null,
    audioTrack = null,
    isActiveSpeaker = false,
    isLocal = false,
  }: {
    participant: Participant;
    videoTrack?: MediaStreamTrack | null;
    audioTrack?: MediaStreamTrack | null;
    isActiveSpeaker?: boolean;
    isLocal?: boolean;
  } = $props();

  let videoEl: HTMLVideoElement | undefined = $state();
  let audioEl: HTMLAudioElement | undefined = $state();

  // Bind video track to <video> element
  $effect(() => {
    if (videoEl) {
      if (videoTrack) {
        const stream = new MediaStream([videoTrack]);
        videoEl.srcObject = stream;
      } else {
        videoEl.srcObject = null;
      }
    }
  });

  // Bind audio track to <audio> element (not for local participant)
  $effect(() => {
    if (audioEl && !isLocal) {
      if (audioTrack) {
        const stream = new MediaStream([audioTrack]);
        audioEl.srcObject = stream;
      } else {
        audioEl.srcObject = null;
      }
    }
  });

  const qualityColor = $derived.by(() => {
    switch (participant.connectionQuality) {
      case 'good':
        return 'bg-green-400';
      case 'medium':
        return 'bg-yellow-400';
      case 'poor':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  });

  const roleBadge = $derived.by(() => {
    switch (participant.role) {
      case 'host':
        return 'Host';
      case 'co_host':
        return 'Co-Host';
      case 'moderator':
        return 'Mod';
      default:
        return null;
    }
  });
</script>

<div
  class="relative overflow-hidden rounded-lg bg-slate-800 {isActiveSpeaker
    ? 'ring-2 ring-brand-500 active-speaker'
    : 'ring-1 ring-slate-700'}"
>
  {#if videoTrack && participant.isVideoEnabled}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      bind:this={videoEl}
      autoplay
      playsinline
      muted={isLocal}
      class="h-full w-full object-cover"
    ></video>
  {:else}
    <!-- No video - show avatar placeholder -->
    <div class="flex h-full w-full items-center justify-center bg-slate-800">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-600 text-2xl font-semibold text-slate-300"
      >
        {participant.displayName.charAt(0).toUpperCase()}
      </div>
    </div>
  {/if}

  <!-- Audio element for remote participants -->
  {#if audioTrack && !isLocal}
    <audio bind:this={audioEl} autoplay></audio>
  {/if}

  <!-- Bottom overlay: name + role -->
  <div
    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2"
  >
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-white truncate">
        {participant.displayName}
        {#if isLocal}
          <span class="text-slate-400">(You)</span>
        {/if}
      </span>

      {#if roleBadge}
        <span
          class="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white"
        >
          {roleBadge}
        </span>
      {/if}
    </div>
  </div>

  <!-- Top-right: connection quality -->
  <div class="absolute right-2 top-2 flex items-center gap-1.5">
    <span class="h-2 w-2 rounded-full {qualityColor}" title="Connection: {participant.connectionQuality}"></span>
  </div>

  <!-- Top-left: muted / video-off indicators -->
  <div class="absolute left-2 top-2 flex items-center gap-1.5">
    {#if !participant.isAudioEnabled}
      <span
        class="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80"
        title="Muted"
      >
        <svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      </span>
    {/if}

    {#if !participant.isVideoEnabled}
      <span
        class="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80"
        title="Camera off"
      >
        <svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 9.5v5M18.364 5.636a9 9 0 010 12.728M3 3l18 18" />
        </svg>
      </span>
    {/if}
  </div>
</div>
