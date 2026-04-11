<!--
  Home page - simple landing that redirects or provides room entry.
-->

<script lang="ts">
  let roomId = $state('');

  function joinRoom() {
    if (roomId.trim()) {
      window.location.href = `/rooms/${encodeURIComponent(roomId.trim())}`;
    }
  }
</script>

<svelte:head>
  <title>Trading Room</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-950">
  <div class="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-xl">
    <h1 class="mb-2 text-2xl font-bold text-white">Trading Room</h1>
    <p class="mb-6 text-sm text-slate-400">
      Enter a room ID to join a live trading session.
    </p>

    <form onsubmit={(e) => { e.preventDefault(); joinRoom(); }}>
      <label for="room-id" class="mb-2 block text-sm font-medium text-slate-300">
        Room ID
      </label>
      <input
        id="room-id"
        type="text"
        bind:value={roomId}
        placeholder="Enter room ID"
        class="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <button
        type="submit"
        disabled={!roomId.trim()}
        class="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Join Room
      </button>
    </form>
  </div>
</div>
