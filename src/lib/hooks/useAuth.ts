'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setState({ user: data.user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initializeAuthState = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (!cancelled) {
          setState({ user: data.user, loading: false });
        }
      } catch {
        if (!cancelled) {
          setState({ user: null, loading: false });
        }
      }
    };

    void initializeAuthState();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch user data when window gains focus (handles login in same tab)
  useEffect(() => {
    let lastFetch = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFetch > 30000) {
        lastFetch = now;
        void fetchUser();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ user: null, loading: false });
    router.push('/login');
  }, [router]);

  return { ...state, logout, refetch: fetchUser };
}
