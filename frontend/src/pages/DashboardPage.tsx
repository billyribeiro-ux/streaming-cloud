/**
 * DashboardPage - Main landing page after login
 *
 * Features:
 * - Welcome header with user's name
 * - Quick stats cards (Active Rooms, Total Participants, Upcoming Events)
 * - Recent rooms list
 * - Quick action buttons
 * - Dark theme, responsive grid
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Video,
  Users,
  Calendar,
  Plus,
  ArrowRight,
  Radio,
  Clock,
  Settings,
  LogOut,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { cn } from '../utils/cn';

interface RoomSummary {
  id: string;
  name: string;
  status: 'live' | 'scheduled' | 'ended';
  participantCount: number;
  scheduledAt: string;
}

// Mock data for initial UI
const mockStats = {
  activeRooms: 3,
  totalParticipants: 47,
  upcomingEvents: 5,
};

const mockRecentRooms: RoomSummary[] = [
  {
    id: '1',
    name: 'Morning Market Analysis',
    status: 'live',
    participantCount: 24,
    scheduledAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Crypto Trading Session',
    status: 'live',
    participantCount: 18,
    scheduledAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Options Strategy Workshop',
    status: 'scheduled',
    participantCount: 0,
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  },
  {
    id: '4',
    name: 'Weekly Portfolio Review',
    status: 'scheduled',
    participantCount: 0,
    scheduledAt: new Date(Date.now() + 7200000).toISOString(),
  },
  {
    id: '5',
    name: 'Forex Fundamentals',
    status: 'ended',
    participantCount: 32,
    scheduledAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const statusColors = {
  live: 'bg-green-500',
  scheduled: 'bg-yellow-500',
  ended: 'bg-gray-500',
};

const statusLabels = {
  live: 'Live',
  scheduled: 'Scheduled',
  ended: 'Ended',
};

function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, loadUser } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recentRooms] = useState<RoomSummary[]>(mockRecentRooms);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/', active: true },
    { icon: Video, label: 'Rooms', href: '/rooms' },
    { icon: Calendar, label: 'Schedule', href: '/rooms?filter=scheduled' },
    { icon: TrendingUp, label: 'Analytics', href: '/admin/analytics' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">TradingRoom</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  item.active
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Section */}
          <div className="px-3 py-4 border-t border-gray-700">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors mt-1"
            >
              <LogOut className="w-5 h-5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-400 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            </div>
            <button
              onClick={() => navigate('/rooms/create')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Room</span>
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Welcome */}
          <div>
            <h2 className="text-2xl font-bold text-white">
              Welcome back, {user?.displayName || user?.name || 'there'}
            </h2>
            <p className="text-gray-400 mt-1">
              Here's what's happening in your trading rooms.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active Rooms</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {mockStats.activeRooms}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <Video className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm">
                <span className="text-green-400">2 live now</span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">1 starting soon</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Participants</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {mockStats.totalParticipants}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm">
                <span className="text-blue-400">+12% from last week</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Upcoming Events</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {mockStats.upcomingEvents}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm">
                <span className="text-yellow-400">Next in 1 hour</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/rooms/create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </button>
            <button
              onClick={() => navigate('/rooms')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Video className="w-4 h-4" />
              View Rooms
            </button>
          </div>

          {/* Recent Rooms */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Recent Rooms
              </h3>
              <Link
                to="/rooms"
                className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-1 transition-colors"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentRooms.map((room) => (
                <Link
                  key={room.id}
                  to={
                    room.status === 'live'
                      ? `/rooms/${room.id}/live`
                      : `/rooms/${room.id}`
                  }
                  className="block bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full flex-shrink-0',
                          statusColors[room.status],
                          room.status === 'live' && 'animate-pulse'
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {room.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {room.participantCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(room.scheduledAt).toLocaleTimeString(
                              [],
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-full',
                          room.status === 'live' &&
                            'bg-green-500/10 text-green-400',
                          room.status === 'scheduled' &&
                            'bg-yellow-500/10 text-yellow-400',
                          room.status === 'ended' &&
                            'bg-gray-500/10 text-gray-400'
                        )}
                      >
                        {statusLabels[room.status]}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
