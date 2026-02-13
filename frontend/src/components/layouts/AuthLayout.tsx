/**
 * AuthLayout - Layout for authentication pages (login, register, forgot-password)
 *
 * Features:
 * - Centered card layout with dark background
 * - Logo/brand name at top
 * - Card container for children
 * - Footer link to homepage
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">TR</span>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">
            Trading Room
          </span>
        </Link>
      </div>

      {/* Card */}
      <div className="bg-gray-900 rounded-xl shadow-2xl p-8 max-w-md mx-auto w-full">
        {title && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
            )}
          </div>
        )}

        {children}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link
          to="/"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
