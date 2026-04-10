<!--
  Room Live Page - Main WebRTC room view

  Connects to signaling server, joins room, manages media streams,
  renders video grid, controls bar, and participant sidebar.
-->

<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';
  import { SignalingClient } from '$lib/signaling';
  import { MediaClient } from '$lib/media-client';
  import { roomStore, type Participant } from '$lib/stores/room.svelte';
  import VideoTile from '$lib/components/VideoTile.svelte';
  import ControlsBar from '$lib/components/ControlsBar.svelte';

  const roomId = $page.params.roomId;
  const signalingUrl =
    import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:8000/ws';
  const token = ''; // Provided by auth flow in production
  const organizationId = ''; // Provided by auth flow in production

  const signaling = new SignalingClient(signalingUrl);
  const media = new MediaClient(signaling);

  // Helper: map server participant data to our Participant shape
  function mapServerParticipant(
    p: Partial<Participant> & { id: string },
  ): Participant {
    return {
      id: p.id,
      userId: p.userId ?? '',
      displayName: p.displayName ?? 'Unknown',
      role: p.role ?? 'viewer',
      isVideoEnabled: p.isVideoEnabled ?? false,
      isAudioEnabled: p.isAudioEnabled ?? false,
      isScreenSharing: p.isScreenSharing ?? false,
      connectionQuality: p.connectionQuality ?? 'unknown',
      joinedAt:
        p.joinedAt instanceof Date ? p.joinedAt : new Date(p.joinedAt ?? Date.now()),
      producers: p.producers ?? [],
    };
  }

  // ---- Signaling event handlers ----

  function handleMessage(message: any) {
    switch (message.event) {
      case 'authenticated':
        console.log('Authenticated with signaling server');
        break;

      case 'room-joined':
        handleRoomJoined(message.data);
        break;

      case 'transport-created':
        handleTransportCreated(message.data);
        break;

      case 'transport-connected':
        console.log('Transport connected:', message.data.transportId);
        break;

      case 'produced':
        console.log('Producer created:', message.data.producerId);
        break;

      case 'consumer-created':
        handleConsumerCreated(message.data);
        break;

      case 'new-producer':
        handleNewProducer(message.data);
        break;

      case 'participant-joined':
        roomStore.addParticipant(message.data);
        break;

      case 'participant-left':
        roomStore.removeParticipant(message.data.participantId);
        break;

      case 'producer-paused':
      case 'producer-resumed':
      case 'producer-closed':
        console.log('Producer state change:', message.event, message.data.producerId);
        break;

      case 'error':
        roomStore.setError(message.data.message);
        break;
    }
  }

  async function handleRoomJoined(data: {
    roomId: string;
    participantId: string;
    routerRtpCapabilities: any;
    participants: (Partial<Participant> & { id: string })[];
  }) {
    try {
      await media.initDevice(data.routerRtpCapabilities);
      roomStore.setJoined(true);

      const normalized = data.participants.map(mapServerParticipant);
      roomStore.setParticipants(normalized);

      // Request both transports
      media.requestTransport('send');
      media.requestTransport('recv');

      // Consume existing producers
      for (const participant of normalized) {
        for (const producer of participant.producers) {
          media.requestConsume(producer.id);
        }
      }
    } catch (err) {
      console.error('Error handling room joined:', err);
      roomStore.setError('Failed to initialize WebRTC');
    }
  }

  async function handleTransportCreated(data: {
    transportId: string;
    direction: 'send' | 'recv';
    iceParameters: any;
    iceCandidates: any[];
    dtlsParameters: any;
    sctpParameters?: any;
  }) {
    const options = {
      transportId: data.transportId,
      iceParameters: data.iceParameters,
      iceCandidates: data.iceCandidates,
      dtlsParameters: data.dtlsParameters,
      sctpParameters: data.sctpParameters,
    };

    if (data.direction === 'send') {
      await media.createSendTransport(options);
    } else {
      await media.createRecvTransport(options);
    }
  }

  async function handleConsumerCreated(data: {
    consumerId: string;
    producerId: string;
    kind: 'audio' | 'video';
    rtpParameters: any;
    appData: any;
  }) {
    try {
      const consumer = await media.consume({
        consumerId: data.consumerId,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters,
        appData: data.appData,
      });

      roomStore.addConsumer({
        consumerId: data.consumerId,
        producerId: data.producerId,
        kind: data.kind,
        track: consumer.track,
        participantId: data.appData?.participantId || '',
      });
    } catch (err) {
      console.error('Failed to consume:', err);
    }
  }

  async function handleNewProducer(data: {
    producerId: string;
    producerUserId: string;
    participantId: string;
    kind: 'audio' | 'video';
    appData: any;
  }) {
    media.requestConsume(data.producerId);
  }

  // ---- Room lifecycle ----

  function connectAndJoin() {
    signaling.on('message', handleMessage);

    signaling.on('open', () => {
      roomStore.setConnected(true);
      roomStore.setReconnecting(false);

      // Authenticate then join
      signaling.send({
        event: 'authenticate',
        data: { token, organizationId },
      });

      setTimeout(() => {
        signaling.send({
          event: 'join-room',
          data: {
            roomId,
            role: 'viewer',
            displayName: 'User',
            rtpCapabilities: media.rtpCapabilities,
          },
        });
      }, 500);
    });

    signaling.on('close', () => {
      roomStore.setConnected(false);
      roomStore.setJoined(false);
    });

    signaling.on('error', () => {
      roomStore.setError('WebSocket connection error');
    });

    signaling.connect();
  }

  async function leaveRoom() {
    // Stop local streams
    roomStore.localStream?.getTracks().forEach((t) => t.stop());
    roomStore.screenStream?.getTracks().forEach((t) => t.stop());
    roomStore.setLocalStream(null);
    roomStore.setScreenStream(null);

    // Close media client (producers, consumers, transports)
    media.close();
    roomStore.clearConsumers();

    // Signal leave
    signaling.send({ event: 'leave-room', data: {} });

    roomStore.setJoined(false);
    roomStore.setVideoEnabled(false);
    roomStore.setAudioEnabled(false);
    roomStore.setScreenSharing(false);
  }

  // ---- Media controls ----

  async function toggleVideo() {
    if (roomStore.isVideoEnabled) {
      media.closeProducer('camera');
      roomStore.setVideoEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });

        const track = stream.getVideoTracks()[0];
        await media.produce(
          track,
          [
            { maxBitrate: 100000, scaleResolutionDownBy: 4 },
            { maxBitrate: 300000, scaleResolutionDownBy: 2 },
            { maxBitrate: 900000 },
          ],
          { videoGoogleStartBitrate: 1000 },
          { source: 'camera' } as any,
        );

        const existing = roomStore.localStream;
        const newStream = existing || new MediaStream();
        newStream.addTrack(track);
        roomStore.setLocalStream(newStream);
        roomStore.setVideoEnabled(true);
      } catch (err) {
        console.error('Failed to get video:', err);
        roomStore.setError('Failed to access camera');
      }
    }
  }

  async function toggleAudio() {
    if (roomStore.isAudioEnabled) {
      media.closeProducer('microphone');
      roomStore.setAudioEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const track = stream.getAudioTracks()[0];
        await media.produce(
          track,
          undefined,
          { opusStereo: false, opusDtx: true },
          { source: 'microphone' } as any,
        );

        const existing = roomStore.localStream;
        const newStream = existing || new MediaStream();
        newStream.addTrack(track);
        roomStore.setLocalStream(newStream);
        roomStore.setAudioEnabled(true);
      } catch (err) {
        console.error('Failed to get audio:', err);
        roomStore.setError('Failed to access microphone');
      }
    }
  }

  async function toggleScreen() {
    if (roomStore.isScreenSharing) {
      media.closeProducer('screen');
      roomStore.screenStream?.getTracks().forEach((t) => t.stop());
      roomStore.setScreenStream(null);
      roomStore.setScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });

        const videoTrack = stream.getVideoTracks()[0];

        // Handle user stopping via browser UI
        videoTrack.onended = () => {
          toggleScreen();
        };

        await media.produce(
          videoTrack,
          [
            { maxBitrate: 1500000, scaleResolutionDownBy: 2 },
            { maxBitrate: 4000000 },
          ],
          { videoGoogleStartBitrate: 1000 },
          { source: 'screen' } as any,
        );

        roomStore.setScreenStream(stream);
        roomStore.setScreenSharing(true);
      } catch (err) {
        console.error('Failed to get screen:', err);
        if ((err as Error).name !== 'NotAllowedError') {
          roomStore.setError('Failed to share screen');
        }
      }
    }
  }

  // ---- Helpers for video grid ----

  function getVideoTrackForParticipant(
    participantId: string,
  ): MediaStreamTrack | null {
    for (const c of roomStore.consumerList) {
      if (c.participantId === participantId && c.kind === 'video') {
        return c.track;
      }
    }
    return null;
  }

  function getAudioTrackForParticipant(
    participantId: string,
  ): MediaStreamTrack | null {
    for (const c of roomStore.consumerList) {
      if (c.participantId === participantId && c.kind === 'audio') {
        return c.track;
      }
    }
    return null;
  }

  // Grid column class based on participant count
  let gridClass = $derived.by(() => {
    const count = roomStore.participantCount;
    if (count <= 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  });

  // ---- Connect on mount ----

  connectAndJoin();

  onDestroy(() => {
    leaveRoom();
    signaling.disconnect();
    roomStore.reset();
  });
</script>

<svelte:head>
  <title>Room {roomId} - Trading Room</title>
</svelte:head>

<div class="flex h-screen flex-col bg-slate-950">
  <!-- Error banner -->
  {#if roomStore.error}
    <div
      class="flex items-center justify-between bg-red-900/80 px-4 py-2 text-sm text-red-200"
    >
      <span>{roomStore.error}</span>
      <button
        onclick={() => roomStore.clearError()}
        class="ml-4 text-red-300 hover:text-white"
      >
        Dismiss
      </button>
    </div>
  {/if}

  <!-- Connection status bar -->
  {#if !roomStore.isConnected}
    <div class="bg-yellow-900/80 px-4 py-2 text-center text-sm text-yellow-200">
      {#if roomStore.isReconnecting}
        Reconnecting to server...
      {:else}
        Disconnected from server
      {/if}
    </div>
  {/if}

  <!-- Main content area -->
  <div class="flex flex-1 overflow-hidden">
    <!-- Video grid -->
    <div class="flex flex-1 flex-col">
      <div class="flex-1 p-4">
        <div class="grid h-full gap-3 {gridClass}">
          {#each roomStore.participantList as participant (participant.id)}
            <VideoTile
              {participant}
              videoTrack={getVideoTrackForParticipant(participant.id)}
              audioTrack={getAudioTrackForParticipant(participant.id)}
              isActiveSpeaker={roomStore.activeSpeakerId === participant.id}
            />
          {/each}
        </div>
      </div>

      <!-- Controls bar -->
      <div class="flex justify-center pb-4">
        <ControlsBar
          isAudioEnabled={roomStore.isAudioEnabled}
          isVideoEnabled={roomStore.isVideoEnabled}
          isScreenSharing={roomStore.isScreenSharing}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreen={toggleScreen}
          onLeave={leaveRoom}
        />
      </div>
    </div>

    <!-- Participant list sidebar -->
    {#if roomStore.isParticipantListOpen}
      <aside class="flex w-72 flex-col border-l border-slate-700 bg-slate-900">
        <div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 class="text-sm font-semibold text-slate-200">
            Participants ({roomStore.participantCount})
          </h2>
          <button
            onclick={() => roomStore.toggleParticipantList()}
            class="text-slate-400 hover:text-white"
            title="Close participant list"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          {#each roomStore.participantList as participant (participant.id)}
            <div
              class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800"
            >
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-slate-300"
              >
                {participant.displayName.charAt(0).toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                <div class="truncate text-sm text-slate-200">
                  {participant.displayName}
                </div>
                <div class="text-xs text-slate-500 capitalize">
                  {participant.role.replace('_', ' ')}
                </div>
              </div>
              <div class="flex items-center gap-1">
                {#if !participant.isAudioEnabled}
                  <span class="text-red-400" title="Muted">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </aside>
    {/if}
  </div>
</div>
