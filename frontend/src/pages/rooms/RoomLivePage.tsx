/**
 * RoomLivePage - Live room view (MOST CRITICAL PAGE)
 *
 * Features:
 * - Full-screen dark layout
 * - Video grid area using VideoTile components
 * - Bottom toolbar with RoomControls
 * - Collapsible right sidebar for chat (ChatPanel)
 * - Collapsible right sidebar for participant list (ParticipantList)
 * - Uses useWebRTC hook for media
 * - Uses roomStore for state
 * - Layout adapts: grid view vs spotlight view
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Maximize2, Grid, Focus, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useWebRTC } from '../../hooks/useWebRTC';
import {
  useRoomStore,
  selectSpotlightedParticipant,
} from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { VideoTile } from '../../components/room/VideoTile';
import RoomControls from '../../components/room/RoomControls';
import ChatPanel from '../../components/room/ChatPanel';
import ParticipantList from '../../components/room/ParticipantList';

function RoomLivePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  // Room store state
  const roomName = useRoomStore((state) => state.roomName);
  const status = useRoomStore((state) => state.status);
  const participants = useRoomStore((state) => state.participants);
  const isChatOpen = useRoomStore((state) => state.isChatOpen);
  const isParticipantListOpen = useRoomStore(
    (state) => state.isParticipantListOpen
  );
  const layoutMode = useRoomStore((state) => state.layoutMode);
  const setLayoutMode = useRoomStore((state) => state.setLayoutMode);
  const spotlightedParticipant = useRoomStore(selectSpotlightedParticipant);
  const setSpotlight = useRoomStore((state) => state.setSpotlight);
  const reset = useRoomStore((state) => state.reset);

  // WebRTC
  const signalingUrl =
    import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:3001';

  const webrtc = useWebRTC({
    signalingUrl,
    token: token || '',
    roomId: roomId || '',
    organizationId: user?.organizationId || '',
  });

  // Connect on mount
  useEffect(() => {
    if (roomId && token) {
      webrtc.connect();
    }

    return () => {
      reset();
    };
  }, [roomId, token]);

  // Join room once connected
  useEffect(() => {
    if (webrtc.isConnected && !webrtc.isJoined && user) {
      webrtc.joinRoom(user.displayName || user.name, 'viewer');
    }
  }, [webrtc.isConnected, webrtc.isJoined, user]);

  // Handle leave room
  const handleLeave = useCallback(async () => {
    await webrtc.leaveRoom();
    navigate(`/rooms/${roomId}`);
  }, [webrtc, navigate, roomId]);

  // Build participant video streams from consumers
  const participantStreams = useMemo(() => {
    const streams = new Map<
      string,
      { video: MediaStream | null; audio: MediaStream | null }
    >();

    webrtc.consumers.forEach((consumer) => {
      const existing = streams.get(consumer.participantId) || {
        video: null,
        audio: null,
      };

      if (consumer.kind === 'video') {
        const stream = new MediaStream([consumer.track]);
        existing.video = stream;
      } else {
        const stream = new MediaStream([consumer.track]);
        existing.audio = stream;
      }

      streams.set(consumer.participantId, existing);
    });

    return streams;
  }, [webrtc.consumers]);

  // Build the video tiles array
  const allParticipants = useMemo(
    () => Array.from(participants.values()),
    [participants]
  );

  // Determine sidebar state
  const sidebarOpen = isChatOpen || isParticipantListOpen;

  // Calculate grid columns based on participant count
  const getGridCols = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3';
    if (count <= 9) return 'grid-cols-3';
    return 'grid-cols-3 sm:grid-cols-4';
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-none">
            {roomName || 'Trading Room'}
          </h1>
          {status === 'live' && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/10 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
          <span className="text-xs text-gray-500">
            {participants.size} participant
            {participants.size !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Toggle */}
          <div className="hidden sm:flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-700">
            <button
              onClick={() => setLayoutMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                layoutMode === 'grid'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode('spotlight')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                layoutMode === 'spotlight'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
              title="Spotlight View"
            >
              <Focus className="w-4 h-4" />
            </button>
          </div>

          {/* Fullscreen */}
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="p-1.5 text-gray-400 hover:text-white transition-colors hidden sm:block"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Error Banner */}
          {webrtc.error && (
            <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-sm">{webrtc.error}</p>
              </div>
              <button
                onClick={webrtc.clearError}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Video Grid */}
          <div className="flex-1 p-4 overflow-auto">
            {layoutMode === 'spotlight' && spotlightedParticipant ? (
              /* Spotlight Layout */
              <div className="h-full flex flex-col gap-4">
                {/* Main spotlight */}
                <div className="flex-1 min-h-0">
                  <VideoTile
                    stream={
                      participantStreams.get(spotlightedParticipant.id)
                        ?.video || null
                    }
                    displayName={spotlightedParticipant.displayName}
                    isVideoEnabled={spotlightedParticipant.isVideoEnabled}
                    isMuted={!spotlightedParticipant.isAudioEnabled}
                    isScreenShare={spotlightedParticipant.isScreenSharing}
                    isSpotlighted
                    connectionQuality={
                      spotlightedParticipant.connectionQuality
                    }
                    role={spotlightedParticipant.role}
                    onSpotlight={() => setSpotlight(null)}
                    className="h-full"
                  />
                </div>

                {/* Thumbnail strip */}
                <div className="flex gap-2 overflow-x-auto py-1">
                  {/* Local */}
                  <div className="w-40 flex-shrink-0">
                    <VideoTile
                      stream={webrtc.localStream}
                      displayName={
                        user?.displayName || user?.name || 'You'
                      }
                      isLocal
                      isVideoEnabled={webrtc.mediaState.video}
                      isMuted={!webrtc.mediaState.audio}
                      className="w-full"
                    />
                  </div>

                  {allParticipants
                    .filter(
                      (p) => p.id !== spotlightedParticipant.id
                    )
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="w-40 flex-shrink-0"
                      >
                        <VideoTile
                          stream={
                            participantStreams.get(participant.id)?.video ||
                            null
                          }
                          displayName={participant.displayName}
                          isVideoEnabled={participant.isVideoEnabled}
                          isMuted={!participant.isAudioEnabled}
                          connectionQuality={participant.connectionQuality}
                          role={participant.role}
                          onSpotlight={() =>
                            setSpotlight(participant.id)
                          }
                          className="w-full"
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              /* Grid Layout */
              <div
                className={cn(
                  'grid gap-3 h-full auto-rows-fr',
                  getGridCols(allParticipants.length + 1)
                )}
              >
                {/* Local Video */}
                <VideoTile
                  stream={webrtc.localStream}
                  displayName={
                    user?.displayName || user?.name || 'You'
                  }
                  isLocal
                  isVideoEnabled={webrtc.mediaState.video}
                  isMuted={!webrtc.mediaState.audio}
                />

                {/* Screen Share (if active) */}
                {webrtc.screenStream && (
                  <VideoTile
                    stream={webrtc.screenStream}
                    displayName={
                      user?.displayName || user?.name || 'You'
                    }
                    isLocal
                    isVideoEnabled
                    isScreenShare
                    className="col-span-2 row-span-2"
                  />
                )}

                {/* Remote Participants */}
                {allParticipants.map((participant) => (
                  <VideoTile
                    key={participant.id}
                    stream={
                      participantStreams.get(participant.id)?.video || null
                    }
                    displayName={participant.displayName}
                    isVideoEnabled={participant.isVideoEnabled}
                    isMuted={!participant.isAudioEnabled}
                    isScreenShare={participant.isScreenSharing}
                    isSpotlighted={
                      participant.id ===
                      useRoomStore.getState().spotlightedParticipantId
                    }
                    connectionQuality={participant.connectionQuality}
                    role={participant.role}
                    onSpotlight={() => {
                      setSpotlight(
                        participant.id ===
                          useRoomStore.getState()
                            .spotlightedParticipantId
                          ? null
                          : participant.id
                      );
                      if (
                        participant.id !==
                        useRoomStore.getState().spotlightedParticipantId
                      ) {
                        setLayoutMode('spotlight');
                      }
                    }}
                  />
                ))}

                {/* Empty state */}
                {allParticipants.length === 0 && (
                  <div className="flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800 col-span-full aspect-video">
                    <div className="text-center">
                      <p className="text-gray-400 text-sm">
                        Waiting for others to join...
                      </p>
                      <p className="text-gray-600 text-xs mt-1">
                        Share the room link to invite participants
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <RoomControls
            mediaState={webrtc.mediaState}
            onToggleAudio={webrtc.toggleAudio}
            onToggleVideo={webrtc.toggleVideo}
            onToggleScreen={webrtc.toggleScreen}
            onLeave={handleLeave}
          />
        </div>

        {/* Right Sidebar */}
        {sidebarOpen && (
          <div className="w-80 border-l border-gray-800 flex-shrink-0 hidden md:flex flex-col">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-gray-700">
              {isChatOpen && (
                <button
                  onClick={() => useRoomStore.getState().toggleChat()}
                  className="flex-1 px-4 py-2.5 text-xs font-medium text-white bg-gray-800 border-b-2 border-blue-500 flex items-center justify-center gap-1"
                >
                  Chat
                  <X className="w-3 h-3 ml-1 text-gray-400 hover:text-white" />
                </button>
              )}
              {isParticipantListOpen && (
                <button
                  onClick={() =>
                    useRoomStore.getState().toggleParticipantList()
                  }
                  className="flex-1 px-4 py-2.5 text-xs font-medium text-white bg-gray-800 border-b-2 border-blue-500 flex items-center justify-center gap-1"
                >
                  Participants
                  <X className="w-3 h-3 ml-1 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-hidden">
              {isChatOpen && <ChatPanel />}
              {isParticipantListOpen && !isChatOpen && <ParticipantList />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomLivePage;
