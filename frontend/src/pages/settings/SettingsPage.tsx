/**
 * SettingsPage - Settings layout with sidebar navigation
 *
 * Features:
 * - Sidebar navigation for settings sections
 * - Links to Profile, Organization, Billing
 * - Dark theme layout
 */

import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Building, CreditCard } from 'lucide-react';
import { cn } from '../../utils/cn';

const settingsNav = [
  { icon: User, label: 'Profile', href: '/settings/profile' },
  { icon: Building, label: 'Organization', href: '/settings/organization' },
  { icon: CreditCard, label: 'Billing', href: '/settings/billing' },
];

function SettingsPage() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-semibold text-white">Settings</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar Nav */}
          <nav className="w-full sm:w-56 flex-shrink-0">
            <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
              {settingsNav.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {location.pathname === '/settings' ? (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-2">
                  Account Settings
                </h2>
                <p className="text-gray-400 text-sm">
                  Select a category from the sidebar to manage your settings.
                </p>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
