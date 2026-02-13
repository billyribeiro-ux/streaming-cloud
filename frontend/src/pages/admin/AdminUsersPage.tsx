/**
 * AdminUsersPage - User management list
 *
 * Features:
 * - User list with search
 * - Role badges
 * - Status indicators
 * - Action buttons
 * - Dark theme
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Shield,
  MoreVertical,
  Mail,
  Calendar,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'suspended';
  joinedAt: string;
  lastActiveAt: string;
}

const mockUsers: AdminUser[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'super_admin',
    status: 'active',
    joinedAt: '2024-01-15',
    lastActiveAt: '2024-12-20',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin',
    status: 'active',
    joinedAt: '2024-03-22',
    lastActiveAt: '2024-12-19',
  },
  {
    id: '3',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    role: 'user',
    status: 'active',
    joinedAt: '2024-06-10',
    lastActiveAt: '2024-12-18',
  },
  {
    id: '4',
    name: 'Alice Brown',
    email: 'alice@example.com',
    role: 'user',
    status: 'inactive',
    joinedAt: '2024-08-05',
    lastActiveAt: '2024-11-30',
  },
  {
    id: '5',
    name: 'Charlie Davis',
    email: 'charlie@example.com',
    role: 'user',
    status: 'suspended',
    joinedAt: '2024-09-12',
    lastActiveAt: '2024-10-15',
  },
];

const roleConfig: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-500/10 text-red-400' },
  admin: { label: 'Admin', color: 'bg-yellow-500/10 text-yellow-400' },
  user: { label: 'User', color: 'bg-gray-500/10 text-gray-400' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/10 text-green-400' },
  inactive: { label: 'Inactive', color: 'bg-gray-500/10 text-gray-400' },
  suspended: { label: 'Suspended', color: 'bg-red-500/10 text-red-400' },
};

function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users] = useState<AdminUser[]>(mockUsers);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-400" />
                <h1 className="text-xl font-semibold text-white">
                  User Management
                </h1>
              </div>
            </div>
            <span className="text-sm text-gray-400">
              {users.length} users
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-900 border-b border-gray-700 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">User</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-2">Last Active</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-700">
            {filteredUsers.map((user) => {
              const role = roleConfig[user.role];
              const status = statusConfig[user.status];

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 hover:bg-gray-700/30 transition-colors"
                >
                  {/* User Info */}
                  <div className="sm:col-span-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="sm:col-span-2 flex items-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        role.color
                      )}
                    >
                      {role.label}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="sm:col-span-2 flex items-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded-full',
                        status.color
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Joined */}
                  <div className="sm:col-span-2 flex items-center text-sm text-gray-400">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 hidden sm:block" />
                    {new Date(user.joinedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>

                  {/* Last Active */}
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      {new Date(user.lastActiveAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <button className="p-1 text-gray-400 hover:text-white transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminUsersPage;
