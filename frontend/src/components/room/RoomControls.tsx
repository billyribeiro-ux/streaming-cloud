/**
 * RoomControls Component - Bottom toolbar for room controls
 *
 * Features:
 * - Mic toggle, Camera toggle, Screen Share toggle
 * - Chat toggle, Participants toggle, Settings (gear)
 * - Leave button (red)
 * - Active state styling (on = white, off = red)
 * - Uses useWebRTC for media actions
 * - Uses roomStore for UI toggles
 */

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useRoomStore } from '../../stores/roomStore';

interface RoomControlsProps {
  mediaState: {
    video: boolean;
    audio: boolean;
    screen: boolean;
  };
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
}

function ControlButton({
  icon: Icon,
  label,
  isActive,
  isDanger,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  isDanger?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'relative flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
        isDanger
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : isActive === false
            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
            : 'bg-gray-700 hover:bg-gray-600 text-white'
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium hidden sm:block">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function RoomControls({
  mediaState,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onLeave,
}: RoomControlsProps) {
  const toggleChat = useRoomStore((state) => state.toggleChat);
  const toggleParticipantList = useRoomStore(
    (state) => state.toggleParticipantList
  );
  const isChatOpen = useRoomStore((state) => state.isChatOpen);
  const isParticipantListOpen = useRoomStore(
    (state) => state.isParticipantListOpen
  );
  const unreadMessageCount = useRoomStore(
    (state) => state.unreadMessageCount
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 px-4 py-3 bg-gray-900/90 backdrop-blur border-t border-gray-800">
      {/* Media Controls */}
      <div className="flex items-center gap-2">
        <ControlButton
          icon={mediaState.audio ? Mic : MicOff}
          label={mediaState.audio ? 'Mute' : 'Unmute'}
          isActive={mediaState.audio}
          onClick={onToggleAudio}
        />
        <ControlButton
          icon={mediaState.video ? Video : VideoOff}
          label={mediaState.video ? 'Stop Video' : 'Start Video'}
          isActive={mediaState.video}
          onClick={onToggleVideo}
        />
        <ControlButton
          icon={mediaState.screen ? MonitorOff : Monitor}
          label={mediaState.screen ? 'Stop Share' : 'Share Screen'}
          isActive={mediaState.screen ? undefined : undefined}
          onClick={onToggleScreen}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-gray-700 mx-1 hidden sm:block" />

      {/* UI Controls */}
      <div className="flex items-center gap-2">
        <ControlButton
          icon={MessageSquare}
          label="Chat"
          isActive={isChatOpen ? undefined : undefined}
          badge={unreadMessageCount}
          onClick={toggleChat}
        />
        <ControlButton
          icon={Users}
          label="People"
          isActive={isParticipantListOpen ? undefined : undefined}
          onClick={toggleParticipantList}
        />
        <ControlButton
          icon={Settings}
          label="Settings"
          onClick={() => {
            // Settings modal can be added later
          }}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-gray-700 mx-1 hidden sm:block" />

      {/* Leave */}
      <ControlButton
        icon={LogOut}
        label="Leave"
        isDanger
        onClick={onLeave}
      />
    </div>
  );
}

export default RoomControls;
