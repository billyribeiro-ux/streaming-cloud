<!--
  ControlsBar Component
  Toggle buttons for microphone, camera, screen share, and leave room.
-->

<script lang="ts">
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
    class="flex h-12 w-12 items-center justify-center rounded-full transition-colors {isAudioEnabled
      ? 'bg-slate-600 hover:bg-slate-500 text-white'
      : 'bg-red-600 hover:bg-red-500 text-white'}"
    title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
  >
    {#if isAudioEnabled}
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
      </svg>
    {:else}
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
    {/if}
  </button>

  <!-- Camera toggle -->
  <button
    onclick={onToggleVideo}
    class="flex h-12 w-12 items-center justify-center rounded-full transition-colors {isVideoEnabled
      ? 'bg-slate-600 hover:bg-slate-500 text-white'
      : 'bg-red-600 hover:bg-red-500 text-white'}"
    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
  >
    {#if isVideoEnabled}
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    {:else}
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    {/if}
  </button>

  <!-- Screen share toggle -->
  <button
    onclick={onToggleScreen}
    class="flex h-12 w-12 items-center justify-center rounded-full transition-colors {isScreenSharing
      ? 'bg-brand-600 hover:bg-brand-500 text-white'
      : 'bg-slate-600 hover:bg-slate-500 text-white'}"
    title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
  >
    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  </button>

  <!-- Divider -->
  <div class="mx-1 h-8 w-px bg-slate-600"></div>

  <!-- Leave room -->
  <button
    onclick={onLeave}
    class="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-500"
  >
    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
    Leave
  </button>
</div>
