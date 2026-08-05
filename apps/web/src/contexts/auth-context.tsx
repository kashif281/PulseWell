'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  getStoredToken,
  getStoredRefreshToken,
  storeTokens,
  storeUser,
  clearTokens,
} from '@/lib/api';
import { UserRole } from '@pulseai/types';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  companyId?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedToken = getStoredToken();
      const storedRefresh = getStoredRefreshToken();

      if (!storedToken && !storedRefresh) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const res = await api<User>('/auth/me', { token: storedToken ?? undefined });
        if (!cancelled && res.data) {
          setToken(getStoredToken());
          setUser(res.data);
          storeUser(res.data);
          setIsLoading(false);
          return;
        }
      } catch {
        // api() clears tokens and emits session-expired on unrecoverable 401
      }

      if (!cancelled) {
        setToken(null);
        setUser(null);
        setIsLoading(false);
      }
    }

    restoreSession();

    const onTokensUpdated = (event: Event) => {
      const accessToken = (event as CustomEvent<{ accessToken: string }>).detail?.accessToken;
      if (accessToken) setToken(accessToken);
    };

    const onSessionExpired = () => {
      setToken(null);
      setUser(null);
      router.replace('/login');
    };

    window.addEventListener('pulseai:tokens-updated', onTokensUpdated);
    window.addEventListener('pulseai:session-expired', onSessionExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('pulseai:tokens-updated', onTokensUpdated);
      window.removeEventListener('pulseai:session-expired', onSessionExpired);
    };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.data) {
      storeTokens(res.data.accessToken, res.data.refreshToken);
      storeUser(res.data.user);
      setToken(res.data.accessToken);
      setUser(res.data.user);
      return res.data.user;
    }
    throw new Error('Login failed');
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      companyName?: string;
    }) => {
      const res = await api<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (res.data) {
        storeTokens(res.data.accessToken, res.data.refreshToken);
        storeUser(res.data.user);
        setToken(res.data.accessToken);
        setUser(res.data.user);
      }
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
