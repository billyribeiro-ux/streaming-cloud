/**
 * RoomDetailPage - Room information and management
 *
 * Features:
 * - Room info: name, description, status, scheduled times
 * - Participant list preview
 * - Go Live / Join Room button depending on role/status
 * - Settings panel for hosts
 * - Uses useParams() for roomId
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Users,
  Clock,
  Calendar,
  Settings,
  Copy,
  Check,
  Radio,
  MessageSquare,
  Monitor,
  MicOff,
  ShieldCheck,
  Edit,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';

interface RoomDetail {
  id: string;
  name: string;
  description: string;
  status: 'live' | 'scheduled' | 'ended';
  participantCount: number;
  maxParticipants: number;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  hostId: string;
  settings: {
    allowChat: boolean;
    allowScreenShare: boolean;
    muteOnEntry: boolean;
    waitingRoom: boolean;
  };
  participants: {
    id: string;
    displayName: string;
    role: string;
    isOnline: boolean;
  }[];
  createdAt: string;
}

// Mock data for initial rendering
const mockRoom: RoomDetail = {
  id: '1',
  name: 'Morning Market Analysis',
  description:
    'Daily pre-market analysis and trade setups. Join us for live charting, market discussion, and actionable trade ideas.',
  status: 'scheduled',
  participantCount: 0,
  maxParticipants: 100,
  scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
  scheduledEndTime: new Date(Date.now() + 7200000).toISOString(),
  hostId: 'user-1',
  settings: {
    allowChat: true,
    allowScreenShare: true,
    muteOnEntry: true,
    waitingRoom: false,
  },
  participants: [
    { id: '1', displayName: 'John Doe', role: 'host', isOnline: false },
    { id: '2', displayName: 'Jane Smith', role: 'co_host', isOnline: false },
  ],
  createdAt: new Date().toISOString(),
};

function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [room, setRoom] = useState<RoomDetail>(mockRoom);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const fetchRoom = async () => {
      setIsLoading(true);
      try {
        const data = await api.get<RoomDetail>(`/v1/rooms/${roomId}`);
        setRoom(data);
      } catch {
        // Fall back to mock data
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  const isHost = user?.id === room.hostId;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/rooms/${roomId}/live`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoLive = async () => {
    if (isHost && room.status === 'scheduled') {
      try {
        await api.post(`/v1/rooms/${roomId}/start`);
      } catch {
        // Continue to navigate even if API fails
      }
    }
    navigate(`/rooms/${roomId}/live`);
  };

  const statusConfig = {
    live: {
      label: 'Live Now',
      color: 'bg-green-500/10 text-green-400 border-green-500/20',
      dot: 'bg-green-500 animate-pulse',
    },
    scheduled: {
      label: 'Scheduled',
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      dot: 'bg-yellow-500',
    },
    ended: {
      label: 'Ended',
      color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      dot: 'bg-gray-500',
    },
  };

  const status = statusConfig[room.status];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/rooms"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-xl font-semibold text-white truncate">
                {room.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isHost && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    showSettings
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleGoLive}
                disabled={room.status === 'ended'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {room.status === 'live' ? (
                  <>
                    <Radio className="w-4 h-4" />
                    Join Room
                  </>
                ) : room.status === 'scheduled' && isHost ? (
                  <>
                    <Play className="w-4 h-4" />
                    Go Live
                  </>
                ) : room.status === 'scheduled' ? (
                  <>
                    <Play className="w-4 h-4" />
                    Join When Live
                  </>
                ) : (
                  'Room Ended'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Info Card */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
                    status.color
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                  {status.label}
                </span>
              </div>

              <p className="text-gray-300 mb-6">{room.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Participants</p>
                  <p className="text-sm text-white font-medium flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400" />
                    {room.participantCount}/{room.maxParticipants}
                  </p>
                </div>
                {room.scheduledStartTime && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Start Time</p>
                    <p className="text-sm text-white font-medium flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {new Date(room.scheduledStartTime).toLocaleTimeString(
                        [],
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                    </p>
                  </div>
                )}
                {room.scheduledEndTime && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">End Time</p>
                    <p className="text-sm text-white font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {new Date(room.scheduledEndTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Created</p>
                  <p className="text-sm text-white font-medium">
                    {new Date(room.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Share Link */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">Room Link</p>
                  <p className="text-sm text-gray-300 truncate">
                    {window.location.origin}/rooms/{roomId}/live
                  </p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Settings Panel (Host only) */}
            {showSettings && isHost && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Room Settings
                  </h3>
                  <Link
                    to={`/rooms/${roomId}/edit`}
                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Link>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      icon: MessageSquare,
                      label: 'Chat',
                      enabled: room.settings.allowChat,
                    },
                    {
                      icon: Monitor,
                      label: 'Screen Share',
                      enabled: room.settings.allowScreenShare,
                    },
                    {
                      icon: MicOff,
                      label: 'Mute on Entry',
                      enabled: room.settings.muteOnEntry,
                    },
                    {
                      icon: ShieldCheck,
                      label: 'Waiting Room',
                      enabled: room.settings.waitingRoom,
                    },
                  ].map((setting) => (
                    <div
                      key={setting.label}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <setting.icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-300">
                          {setting.label}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          setting.enabled
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-gray-700 text-gray-500'
                        )}
                      >
                        {setting.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Participants */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Participants
                </h3>
                <span className="text-xs text-gray-400">
                  {room.participants.length}
                </span>
              </div>

              <div className="space-y-3">
                {room.participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-xs font-medium text-white">
                          {participant.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {participant.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {participant.displayName}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {participant.role.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {room.participants.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No participants yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomDetailPage;
