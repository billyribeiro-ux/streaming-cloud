/**
 * ParticipantList Component - Room participant sidebar
 *
 * Features:
 * - List of participants with avatar, name, role badge, audio/video status
 * - Grouped by role (hosts first, then viewers)
 * - Participant count in header
 * - Uses roomStore.participants
 */

import { useMemo } from 'react';
import { Mic, MicOff, Video, VideoOff, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useRoomStore, selectHosts, selectViewers } from '../../stores/roomStore';

const roleColors: Record<string, string> = {
  host: 'bg-red-500/10 text-red-400',
  co_host: 'bg-orange-500/10 text-orange-400',
  moderator: 'bg-blue-500/10 text-blue-400',
  viewer: 'bg-gray-500/10 text-gray-400',
};

const roleLabels: Record<string, string> = {
  host: 'Host',
  co_host: 'Co-Host',
  moderator: 'Moderator',
  viewer: 'Viewer',
};

function ParticipantList() {
  const participants = useRoomStore((state) => state.participants);
  const hosts = useRoomStore(selectHosts);
  const viewers = useRoomStore(selectViewers);

  const moderators = useMemo(
    () =>
      Array.from(participants.values()).filter(
        (p) => p.role === 'moderator'
      ),
    [participants]
  );

  const connectionIcon = (quality: string) => {
    switch (quality) {
      case 'good':
        return <Wifi className="w-3.5 h-3.5 text-green-500" />;
      case 'medium':
        return <Wifi className="w-3.5 h-3.5 text-yellow-500" />;
      case 'poor':
        return <WifiOff className="w-3.5 h-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  const renderParticipant = (participant: (typeof hosts)[0]) => (
    <div
      key={participant.id}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700/50 transition-colors"
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-white">
          {participant.displayName.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-white truncate">
            {participant.displayName}
          </p>
          {participant.role !== 'viewer' && (
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                roleColors[participant.role] || roleColors.viewer
              )}
            >
              {roleLabels[participant.role] || participant.role}
            </span>
          )}
        </div>
      </div>

      {/* Status Icons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {connectionIcon(participant.connectionQuality)}

        {participant.isAudioEnabled ? (
          <Mic className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-red-500" />
        )}

        {participant.isVideoEnabled ? (
          <Video className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <VideoOff className="w-3.5 h-3.5 text-red-500" />
        )}
      </div>
    </div>
  );

  const renderGroup = (
    title: string,
    members: typeof hosts,
    count?: number
  ) => {
    if (members.length === 0) return null;

    return (
      <div>
        <div className="px-4 py-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title} ({count ?? members.length})
          </p>
        </div>
        {members.map(renderParticipant)}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">Participants</h3>
        <p className="text-xs text-gray-500">
          {participants.size} in this room
        </p>
      </div>

      {/* Participant Groups */}
      <div className="flex-1 overflow-y-auto py-2 space-y-2">
        {renderGroup('Hosts', hosts)}
        {renderGroup('Moderators', moderators)}
        {renderGroup('Viewers', viewers)}

        {participants.size === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No participants yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipantList;
