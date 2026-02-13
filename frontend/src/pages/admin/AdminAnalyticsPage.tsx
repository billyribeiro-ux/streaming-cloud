/**
 * AdminAnalyticsPage - Platform analytics overview
 *
 * Features:
 * - Key metrics display
 * - Time range selector
 * - Metric cards with trends
 * - Placeholder for charts
 * - Dark theme
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  BarChart3,
  Users,
  Video,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';
import { cn } from '../../utils/cn';

type TimeRange = '7d' | '30d' | '90d' | '1y';

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
];

const metrics = [
  {
    label: 'Total Sessions',
    value: '8,432',
    change: 12.5,
    icon: Video,
    color: 'text-blue-400 bg-blue-500/10',
  },
  {
    label: 'Active Users',
    value: '1,234',
    change: 8.3,
    icon: Users,
    color: 'text-green-400 bg-green-500/10',
  },
  {
    label: 'Avg Session Duration',
    value: '42m',
    change: -2.1,
    icon: Clock,
    color: 'text-purple-400 bg-purple-500/10',
  },
  {
    label: 'Peak Concurrent Users',
    value: '312',
    change: 18.7,
    icon: Activity,
    color: 'text-yellow-400 bg-yellow-500/10',
  },
  {
    label: 'Bandwidth Used',
    value: '2.4 TB',
    change: 15.2,
    icon: BarChart3,
    color: 'text-pink-400 bg-pink-500/10',
  },
  {
    label: 'Revenue',
    value: '$12,450',
    change: 22.1,
    icon: TrendingUp,
    color: 'text-emerald-400 bg-emerald-500/10',
  },
];

function AdminAnalyticsPage() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('30d');

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" />
                <h1 className="text-xl font-semibold text-white">Analytics</h1>
              </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setSelectedRange(range.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    selectedRange === range.value
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-gray-800 rounded-xl p-5 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-400">{metric.label}</p>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${metric.color}`}
                >
                  <metric.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white mb-2">
                {metric.value}
              </p>
              <div className="flex items-center gap-1">
                {metric.change > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span
                  className={cn(
                    'text-sm font-medium',
                    metric.change > 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {metric.change > 0 ? '+' : ''}
                  {metric.change}%
                </span>
                <span className="text-sm text-gray-500">
                  vs previous period
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Sessions Over Time
            </h3>
            <div className="h-64 flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
              <div className="text-center">
                <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  Chart visualization coming soon
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              User Growth
            </h3>
            <div className="h-64 flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  Chart visualization coming soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;
