'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { UserData } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setUser(json.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch user on every route change (catches login/logout navigations)
  useEffect(() => {
    fetchUser();
  }, [fetchUser, pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, logout, refetch: fetchUser };
}
