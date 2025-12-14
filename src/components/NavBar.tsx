'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { LogoFull } from '@/components/Logo';

export default function NavBar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="glass-strong sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="group">
              <LogoFull className="group-hover:opacity-80 transition-opacity" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-sm text-gray-400">Loading...</span>
            ) : user ? (
              <>
                <span className="text-sm text-gray-300">{user.email}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="btn-primary px-4 py-2 text-sm text-white rounded-lg"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
