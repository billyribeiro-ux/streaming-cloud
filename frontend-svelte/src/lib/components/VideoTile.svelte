<!--
  VideoTile Component
  Displays a participant's video/audio with overlays for name, role, quality, and state.
  Icons: Phosphor (bundled Svelte components — no external SVG fetch).
-->

<script lang="ts">
  import MicrophoneSlash from 'phosphor-svelte/lib/MicrophoneSlash';
  import VideoCameraSlash from 'phosphor-svelte/lib/VideoCameraSlash';
  import type { Attachment } from 'svelte/attachments';
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

  // Attachments bind the (reactive) media tracks to the element; they re-run
  // when the referenced track changes and clean up on teardown.
  const bindVideo: Attachment<HTMLVideoElement> = (node) => {
    node.srcObject = videoTrack ? new MediaStream([videoTrack]) : null;
    return () => {
      node.srcObject = null;
    };
  };

  const bindAudio: Attachment<HTMLAudioElement> = (node) => {
    node.srcObject = !isLocal && audioTrack ? new MediaStream([audioTrack]) : null;
    return () => {
      node.srcObject = null;
    };
  };

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
    <video {@attach bindVideo} autoplay playsinline muted={isLocal} class="h-full w-full object-cover"
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
    <audio {@attach bindAudio} autoplay></audio>
  {/if}

  <!-- Bottom overlay: name + role -->
  <div
    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2"
  >
    <div class="flex items-center gap-2">
      <span class="truncate text-sm font-medium text-white">
        {participant.displayName}
        {#if isLocal}
          <span class="text-slate-400">(You)</span>
        {/if}
      </span>

      {#if roleBadge}
        <span class="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
          {roleBadge}
        </span>
      {/if}
    </div>
  </div>

  <!-- Top-right: connection quality -->
  <div class="absolute right-2 top-2 flex items-center gap-1.5">
    <span
      class="h-2 w-2 rounded-full {qualityColor}"
      title="Connection: {participant.connectionQuality}"
    ></span>
  </div>

  <!-- Top-left: muted / video-off indicators -->
  <div class="absolute left-2 top-2 flex items-center gap-1.5">
    {#if !participant.isAudioEnabled}
      <span
        class="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80 text-white"
        title="Muted"
      >
        <MicrophoneSlash size={14} weight="bold" />
      </span>
    {/if}

    {#if !participant.isVideoEnabled}
      <span
        class="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/80 text-white"
        title="Camera off"
      >
        <VideoCameraSlash size={14} weight="bold" />
      </span>
    {/if}
  </div>
</div>
