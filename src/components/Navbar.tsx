'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-amber-400">
              AuctionHub
            </Link>
            <Link
              href="/auctions"
              className="text-gray-300 hover:text-white transition"
            >
              Auctions
            </Link>
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-300 hover:text-white transition"
                >
                  Dashboard
                </Link>
                <Link
                  href="/products/new"
                  className="text-gray-300 hover:text-white transition"
                >
                  Add Product
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="h-8 w-20 bg-gray-700 animate-pulse rounded" />
            ) : user ? (
              <>
                <span className="text-gray-300 text-sm">
                  Hi, {user.name}
                </span>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-gray-300 hover:text-white transition"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-amber-500 hover:bg-amber-600 text-black text-sm px-4 py-2 rounded font-medium transition"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
