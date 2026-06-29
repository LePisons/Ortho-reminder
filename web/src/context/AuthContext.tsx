'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'ADMIN' | 'STAFF';
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Prevents a flood of concurrent 401s from each firing a redirect.
  const redirectingRef = useRef(false);

  // Global 401 handler: when any same-origin /api call returns 401 (expired or
  // missing session), clear local auth state and bounce to the login page so the
  // user gets a clean "log in again" instead of silent failures. Wrapping fetch
  // here covers every existing call site without touching each one.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        const input = args[0];
        const url =
          typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : String(input);
        const isApiCall = url.includes('/api/');
        // Login/profile legitimately 401 (bad creds / logged out) — handled locally.
        const isAuthCheck =
          url.includes('/auth/login') || url.includes('/auth/profile');
        const onLoginPage = window.location.pathname === '/login';
        if (isApiCall && !isAuthCheck && !onLoginPage && !redirectingRef.current) {
          redirectingRef.current = true;
          setUser(null);
          router.push('/login');
        }
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        credentials: 'include',
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        // A fresh valid session re-arms the 401 redirect for the next expiry.
        redirectingRef.current = false;
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async () => {
    await checkAuth();
    router.push('/');
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Even if the call fails, clear local state
    }
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        credentials: 'include',
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch {
      // silently fail
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
