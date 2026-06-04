<!--
  ControlsBar Component
  Toggle buttons for microphone, camera, screen share, and leave room.
  Icons: Phosphor (bundled Svelte components — no external SVG fetch).
-->

<script lang="ts">
  import Microphone from 'phosphor-svelte/lib/Microphone';
  import MicrophoneSlash from 'phosphor-svelte/lib/MicrophoneSlash';
  import VideoCamera from 'phosphor-svelte/lib/VideoCamera';
  import VideoCameraSlash from 'phosphor-svelte/lib/VideoCameraSlash';
  import Monitor from 'phosphor-svelte/lib/Monitor';
  import SignOut from 'phosphor-svelte/lib/SignOut';

  let {
    isAudioEnabled = false,
    isVideoEnabled = false,
    isScreenSharing = false,
    onToggleAudio,
    onToggleVideo,
    onToggleScreen,
    onLeave,
  }: {
    isAudioEnabled?: boolean;
    isVideoEnabled?: boolean;
    isScreenSharing?: boolean;
    onToggleAudio: () => void;
    onToggleVideo: () => void;
    onToggleScreen: () => void;
    onLeave: () => void;
  } = $props();
</script>

<div
  class="flex items-center justify-center gap-3 rounded-xl bg-slate-800/90 px-6 py-3 backdrop-blur-sm"
>
  <!-- Microphone toggle -->
  <button
    onclick={onToggleAudio}
    class="flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors {isAudioEnabled
      ? 'bg-slate-600 hover:bg-slate-500'
      : 'bg-red-600 hover:bg-red-500'}"
    title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
    aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
  >
    {#if isAudioEnabled}
      <Microphone size={20} weight="bold" />
    {:else}
      <MicrophoneSlash size={20} weight="bold" />
    {/if}
  </button>

  <!-- Camera toggle -->
  <button
    onclick={onToggleVideo}
    class="flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors {isVideoEnabled
      ? 'bg-slate-600 hover:bg-slate-500'
      : 'bg-red-600 hover:bg-red-500'}"
    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
    aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
  >
    {#if isVideoEnabled}
      <VideoCamera size={20} weight="bold" />
    {:else}
      <VideoCameraSlash size={20} weight="bold" />
    {/if}
  </button>

  <!-- Screen share toggle -->
  <button
    onclick={onToggleScreen}
    class="flex h-12 w-12 items-center justify-center rounded-full text-white transition-colors {isScreenSharing
      ? 'bg-brand-600 hover:bg-brand-500'
      : 'bg-slate-600 hover:bg-slate-500'}"
    title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
    aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
  >
    <Monitor size={20} weight="bold" />
  </button>

  <!-- Divider -->
  <div class="mx-1 h-8 w-px bg-slate-600"></div>

  <!-- Leave room -->
  <button
    onclick={onLeave}
    class="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-500"
  >
    <SignOut size={20} weight="bold" />
    Leave
  </button>
</div>
