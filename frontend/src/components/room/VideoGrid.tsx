/**
 * VideoGrid Component - Video grid layout for live rooms
 *
 * Features:
 * - Grid layout: CSS grid adapting columns based on participant count
 * - Spotlight layout: one large video + smaller thumbnails
 * - Sidebar layout: main video + right sidebar with small tiles
 * - Renders VideoTile for each participant
 */

import { useMemo } from 'react';
import { VideoTile } from './VideoTile';
import { cn } from '../../utils/cn';

interface Participant {
  id: string;
  userId: string;
  displayName: string;
  role: string;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  connectionQuality: 'good' | 'medium' | 'poor' | 'unknown';
}

interface ConsumerInfo {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  track: MediaStreamTrack;
  participantId: string;
}

interface VideoGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  consumers: Map<string, ConsumerInfo>;
  layoutMode?: 'grid' | 'spotlight' | 'sidebar';
  spotlightedId?: string | null;
  localParticipantId?: string;
  onSpotlight?: (participantId: string) => void;
  className?: string;
}

function getGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 2) return 'grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

function getParticipantStream(
  participantId: string,
  consumers: Map<string, ConsumerInfo>
): MediaStream | null {
  const videoConsumer = Array.from(consumers.values()).find(
    (c) => c.participantId === participantId && c.kind === 'video'
  );

  if (!videoConsumer) return null;

  const stream = new MediaStream();
  stream.addTrack(videoConsumer.track);

  // Also attach audio track if available
  const audioConsumer = Array.from(consumers.values()).find(
    (c) => c.participantId === participantId && c.kind === 'audio'
  );
  if (audioConsumer) {
    stream.addTrack(audioConsumer.track);
  }

  return stream;
}

// ============================================================================
// GRID LAYOUT
// ============================================================================

function GridLayout({
  participants,
  localStream,
  consumers,
  localParticipantId: _localParticipantId,
  onSpotlight,
}: Omit<VideoGridProps, 'layoutMode'>) {
  const totalCount = participants.length + (localStream ? 1 : 0);
  const gridCols = getGridCols(totalCount);

  return (
    <div className={cn('grid gap-2 p-2 h-full auto-rows-fr', gridCols)}>
      {/* Local participant */}
      {localStream && (
        <VideoTile
          stream={localStream}
          displayName="You"
          isLocal
          isVideoEnabled={localStream.getVideoTracks().length > 0}
          isMuted={localStream.getAudioTracks().length === 0}
        />
      )}

      {/* Remote participants */}
      {participants.map((participant) => {
        const stream = getParticipantStream(participant.id, consumers);

        return (
          <VideoTile
            key={participant.id}
            stream={stream}
            displayName={participant.displayName}
            isVideoEnabled={participant.isVideoEnabled}
            isMuted={!participant.isAudioEnabled}
            isScreenShare={participant.isScreenSharing}
            connectionQuality={participant.connectionQuality}
            role={participant.role}
            onSpotlight={onSpotlight ? () => onSpotlight(participant.id) : undefined}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// SPOTLIGHT LAYOUT
// ============================================================================

function SpotlightLayout({
  participants,
  localStream,
  consumers,
  spotlightedId,
  localParticipantId: _localParticipantId,
  onSpotlight,
}: Omit<VideoGridProps, 'layoutMode'>) {
  const spotlighted = useMemo(() => {
    if (spotlightedId) {
      return participants.find((p) => p.id === spotlightedId) || null;
    }
    // Default to first host or first participant
    return (
      participants.find((p) => p.role === 'host' || p.role === 'co_host') ||
      participants[0] ||
      null
    );
  }, [participants, spotlightedId]);

  const others = participants.filter((p) => p.id !== spotlighted?.id);

  const spotlightStream = spotlighted
    ? getParticipantStream(spotlighted.id, consumers)
    : null;

  const isLocalSpotlighted = !spotlighted && localStream;

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* Main spotlight video */}
      <div className="flex-1 min-h-0">
        {isLocalSpotlighted ? (
          <VideoTile
            stream={localStream}
            displayName="You"
            isLocal
            isVideoEnabled={localStream!.getVideoTracks().length > 0}
            isMuted={localStream!.getAudioTracks().length === 0}
            className="h-full"
          />
        ) : spotlighted ? (
          <VideoTile
            stream={spotlightStream}
            displayName={spotlighted.displayName}
            isVideoEnabled={spotlighted.isVideoEnabled}
            isMuted={!spotlighted.isAudioEnabled}
            isScreenShare={spotlighted.isScreenSharing}
            isSpotlighted
            connectionQuality={spotlighted.connectionQuality}
            role={spotlighted.role}
            className="h-full"
          />
        ) : null}
      </div>

      {/* Thumbnail strip */}
      {(others.length > 0 || (localStream && spotlighted)) && (
        <div className="flex gap-2 overflow-x-auto h-28 flex-shrink-0">
          {/* Local thumbnail */}
          {localStream && spotlighted && (
            <div className="w-44 flex-shrink-0">
              <VideoTile
                stream={localStream}
                displayName="You"
                isLocal
                isVideoEnabled={localStream.getVideoTracks().length > 0}
                isMuted={localStream.getAudioTracks().length === 0}
                className="h-full"
              />
            </div>
          )}

          {/* Other participants */}
          {others.map((participant) => {
            const stream = getParticipantStream(participant.id, consumers);

            return (
              <div key={participant.id} className="w-44 flex-shrink-0">
                <VideoTile
                  stream={stream}
                  displayName={participant.displayName}
                  isVideoEnabled={participant.isVideoEnabled}
                  isMuted={!participant.isAudioEnabled}
                  connectionQuality={participant.connectionQuality}
                  role={participant.role}
                  onSpotlight={
                    onSpotlight ? () => onSpotlight(participant.id) : undefined
                  }
                  className="h-full"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SIDEBAR LAYOUT
// ============================================================================

function SidebarLayout({
  participants,
  localStream,
  consumers,
  spotlightedId,
  localParticipantId: _localParticipantId,
  onSpotlight,
}: Omit<VideoGridProps, 'layoutMode'>) {
  const spotlighted = useMemo(() => {
    if (spotlightedId) {
      return participants.find((p) => p.id === spotlightedId) || null;
    }
    return (
      participants.find((p) => p.role === 'host' || p.role === 'co_host') ||
      participants[0] ||
      null
    );
  }, [participants, spotlightedId]);

  const others = participants.filter((p) => p.id !== spotlighted?.id);

  const spotlightStream = spotlighted
    ? getParticipantStream(spotlighted.id, consumers)
    : null;

  const isLocalSpotlighted = !spotlighted && localStream;

  return (
    <div className="flex h-full gap-2 p-2">
      {/* Main video */}
      <div className="flex-1 min-w-0">
        {isLocalSpotlighted ? (
          <VideoTile
            stream={localStream}
            displayName="You"
            isLocal
            isVideoEnabled={localStream!.getVideoTracks().length > 0}
            isMuted={localStream!.getAudioTracks().length === 0}
            className="h-full"
          />
        ) : spotlighted ? (
          <VideoTile
            stream={spotlightStream}
            displayName={spotlighted.displayName}
            isVideoEnabled={spotlighted.isVideoEnabled}
            isMuted={!spotlighted.isAudioEnabled}
            isScreenShare={spotlighted.isScreenSharing}
            isSpotlighted
            connectionQuality={spotlighted.connectionQuality}
            role={spotlighted.role}
            className="h-full"
          />
        ) : null}
      </div>

      {/* Right sidebar with tiles */}
      {(others.length > 0 || (localStream && spotlighted)) && (
        <div className="w-48 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          {/* Local thumbnail */}
          {localStream && spotlighted && (
            <VideoTile
              stream={localStream}
              displayName="You"
              isLocal
              isVideoEnabled={localStream.getVideoTracks().length > 0}
              isMuted={localStream.getAudioTracks().length === 0}
            />
          )}

          {/* Other participants */}
          {others.map((participant) => {
            const stream = getParticipantStream(participant.id, consumers);

            return (
              <VideoTile
                key={participant.id}
                stream={stream}
                displayName={participant.displayName}
                isVideoEnabled={participant.isVideoEnabled}
                isMuted={!participant.isAudioEnabled}
                connectionQuality={participant.connectionQuality}
                role={participant.role}
                onSpotlight={
                  onSpotlight ? () => onSpotlight(participant.id) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default function VideoGrid({
  participants,
  localStream,
  consumers,
  layoutMode = 'grid',
  spotlightedId,
  localParticipantId,
  onSpotlight,
  className,
}: VideoGridProps) {
  const sharedProps = {
    participants,
    localStream,
    consumers,
    spotlightedId,
    localParticipantId,
    onSpotlight,
  };

  return (
    <div className={cn('w-full h-full', className)}>
      {layoutMode === 'grid' && <GridLayout {...sharedProps} />}
      {layoutMode === 'spotlight' && <SpotlightLayout {...sharedProps} />}
      {layoutMode === 'sidebar' && <SidebarLayout {...sharedProps} />}
    </div>
  );
}
