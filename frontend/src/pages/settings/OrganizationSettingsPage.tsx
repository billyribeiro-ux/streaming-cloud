/**
 * OrganizationSettingsPage - Organization settings management
 *
 * Features:
 * - Organization name and details
 * - Member management placeholder
 * - Dark theme
 */

import { Building, Users, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

function OrganizationSettingsPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-purple-600/10 flex items-center justify-center">
            <Building className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Organization</h2>
            <p className="text-sm text-gray-400">
              Manage your organization settings
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              defaultValue="My Trading Organization"
              className="w-full px-3 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Organization ID
            </label>
            <input
              type="text"
              value={user?.organizationId || 'N/A'}
              disabled
              className="w-full px-3 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Members</h2>
              <p className="text-sm text-gray-400">
                Manage team members and roles
              </p>
            </div>
          </div>
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            Invite
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-sm text-white">{user?.name || 'You'}</p>
                <p className="text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-medium rounded-full">
              <Shield className="w-3 h-3" />
              Owner
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganizationSettingsPage;
