/**
 * RoomListPage - Grid of room cards with filtering
 *
 * Features:
 * - Room card grid with status badges
 * - Filter tabs: All, Live, Scheduled, Ended
 * - Search input
 * - Create Room button
 * - Links to room detail/live pages
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Users,
  Clock,
  Video,
  Calendar,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { api } from '../../lib/api';

interface Room {
  id: string;
  name: string;
  description: string;
  status: 'live' | 'scheduled' | 'ended';
  participantCount: number;
  maxParticipants: number;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  createdAt: string;
}

type FilterTab = 'all' | 'live' | 'scheduled' | 'ended';

const filterTabs: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ended', label: 'Ended' },
];

// Mock data for initial rendering
const mockRooms: Room[] = [
  {
    id: '1',
    name: 'Morning Market Analysis',
    description: 'Daily pre-market analysis and trade setups',
    status: 'live',
    participantCount: 24,
    maxParticipants: 100,
    scheduledStartTime: new Date().toISOString(),
    scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Crypto Trading Session',
    description: 'Live crypto market discussion and signals',
    status: 'live',
    participantCount: 18,
    maxParticipants: 50,
    scheduledStartTime: new Date().toISOString(),
    scheduledEndTime: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Options Strategy Workshop',
    description: 'Learn advanced options strategies for consistent income',
    status: 'scheduled',
    participantCount: 0,
    maxParticipants: 200,
    scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
    scheduledEndTime: new Date(Date.now() + 7200000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Weekly Portfolio Review',
    description: 'Review and optimize your trading portfolio',
    status: 'scheduled',
    participantCount: 0,
    maxParticipants: 100,
    scheduledStartTime: new Date(Date.now() + 86400000).toISOString(),
    scheduledEndTime: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Forex Fundamentals',
    description: 'Understanding currency markets and fundamentals',
    status: 'ended',
    participantCount: 32,
    maxParticipants: 100,
    scheduledStartTime: new Date(Date.now() - 7200000).toISOString(),
    scheduledEndTime: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Swing Trading Masterclass',
    description: 'Multi-day trading strategies for busy professionals',
    status: 'ended',
    participantCount: 45,
    maxParticipants: 100,
    scheduledStartTime: new Date(Date.now() - 86400000).toISOString(),
    scheduledEndTime: new Date(Date.now() - 82800000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

function RoomListPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>(mockRooms);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoading(true);
      try {
        const data = await api.get<Room[]>('/v1/rooms');
        setRooms(data);
      } catch {
        // Fall back to mock data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, []);

  const filteredRooms = useMemo(() => {
    let result = rooms;

    if (activeFilter !== 'all') {
      result = result.filter((room) => room.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (room) =>
          room.name.toLowerCase().includes(query) ||
          room.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [rooms, activeFilter, searchQuery]);

  const statusConfig = {
    live: {
      color: 'bg-green-500/10 text-green-400 border-green-500/20',
      dot: 'bg-green-500 animate-pulse',
      icon: Radio,
      label: 'Live',
    },
    scheduled: {
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      dot: 'bg-yellow-500',
      icon: Calendar,
      label: 'Scheduled',
    },
    ended: {
      color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      dot: 'bg-gray-500',
      icon: Clock,
      label: 'Ended',
    },
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </Link>
              <h1 className="text-xl font-semibold text-white">Rooms</h1>
            </div>
            <button
              onClick={() => navigate('/rooms/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Room</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              {filterTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    activeFilter === tab.value
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-xl p-5 border border-gray-700 animate-pulse"
              >
                <div className="h-5 bg-gray-700 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-700 rounded w-full mb-2" />
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-4" />
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-700 rounded-full w-16" />
                  <div className="h-6 bg-gray-700 rounded-full w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              No rooms found
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {searchQuery
                ? 'Try adjusting your search terms.'
                : 'Create your first room to get started.'}
            </p>
            <button
              onClick={() => navigate('/rooms/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => {
              const status = statusConfig[room.status];
              const StatusIcon = status.icon;

              return (
                <Link
                  key={room.id}
                  to={
                    room.status === 'live'
                      ? `/rooms/${room.id}/live`
                      : `/rooms/${room.id}`
                  }
                  className="group bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-white font-semibold group-hover:text-blue-400 transition-colors truncate pr-2">
                      {room.name}
                    </h3>
                    <span
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border flex-shrink-0',
                        status.color
                      )}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                      {status.label}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                    {room.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      {room.participantCount}/{room.maxParticipants}
                    </span>
                    {room.scheduledStartTime && (
                      <span className="flex items-center gap-1.5">
                        <StatusIcon className="w-4 h-4" />
                        {new Date(room.scheduledStartTime).toLocaleDateString(
                          [],
                          { month: 'short', day: 'numeric' }
                        )}{' '}
                        {new Date(room.scheduledStartTime).toLocaleTimeString(
                          [],
                          { hour: '2-digit', minute: '2-digit' }
                        )}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomListPage;
