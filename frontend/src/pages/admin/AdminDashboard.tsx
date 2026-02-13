/**
 * AdminDashboard - Admin overview with platform stats
 *
 * Features:
 * - Platform-wide statistics
 * - Recent activity
 * - System health indicators
 * - Dark theme, responsive grid
 */

import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Video,
  Activity,
  Server,
  TrendingUp,
  Clock,
  Shield,
} from 'lucide-react';

const stats = [
  {
    label: 'Total Users',
    value: '1,234',
    change: '+12%',
    icon: Users,
    color: 'text-blue-400 bg-blue-500/10',
  },
  {
    label: 'Active Rooms',
    value: '47',
    change: '+5%',
    icon: Video,
    color: 'text-green-400 bg-green-500/10',
  },
  {
    label: 'Peak Concurrent',
    value: '312',
    change: '+18%',
    icon: TrendingUp,
    color: 'text-purple-400 bg-purple-500/10',
  },
  {
    label: 'Uptime',
    value: '99.9%',
    change: '',
    icon: Activity,
    color: 'text-yellow-400 bg-yellow-500/10',
  },
];

const systemHealth = [
  { name: 'API Server', status: 'healthy', latency: '12ms' },
  { name: 'WebSocket Server', status: 'healthy', latency: '8ms' },
  { name: 'Media Server', status: 'healthy', latency: '15ms' },
  { name: 'Database', status: 'healthy', latency: '5ms' },
  { name: 'Redis Cache', status: 'healthy', latency: '2ms' },
];

const recentActivity = [
  { action: 'New user registered', user: 'jane@example.com', time: '2 minutes ago' },
  { action: 'Room created', user: 'john@example.com', time: '15 minutes ago' },
  { action: 'Subscription upgraded', user: 'bob@example.com', time: '1 hour ago' },
  { action: 'Room ended', user: 'alice@example.com', time: '2 hours ago' },
];

function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" />
                <h1 className="text-xl font-semibold text-white">
                  Admin Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/admin/users"
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Users
              </Link>
              <Link
                to="/admin/analytics"
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-gray-800 rounded-xl p-5 border border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              {stat.change && (
                <p className="text-green-400 text-sm mt-2">{stat.change} from last month</p>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Health */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-white">
                System Health
              </h3>
            </div>
            <div className="space-y-3">
              {systemHealth.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-white">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {service.latency}
                    </span>
                    <span className="text-xs text-green-400 capitalize">
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-white">
                Recent Activity
              </h3>
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 py-2 border-b border-gray-700 last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white">{activity.action}</p>
                    <p className="text-xs text-gray-400">
                      {activity.user} - {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
