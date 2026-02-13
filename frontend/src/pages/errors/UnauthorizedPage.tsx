/**
 * UnauthorizedPage - 403 error page
 *
 * Features:
 * - Clear unauthorized messaging
 * - Login and home navigation links
 * - Dark theme, centered layout
 */

import { Link } from 'react-router-dom';
import { Home, LogIn, ShieldX } from 'lucide-react';

function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <ShieldX className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h1 className="text-6xl font-bold text-white mb-2">403</h1>
        <h2 className="text-xl font-semibold text-white mb-3">
          Access Denied
        </h2>
        <p className="text-gray-400 mb-8">
          You don't have permission to access this page.
          Please log in with an authorized account or contact your administrator.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
