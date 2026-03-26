import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  created_at: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<string>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use the same API_BASE strategy as use-api.ts: empty string means all calls go
// through the Vite dev-server proxy (which forwards /api/* to :8001).
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

function resolveUrl(path: string): string {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      verifyToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Listen for session-expired events fired by the request() helper in use-api.ts
  // so we can clear auth state gracefully without a hard page reload.
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const verifyToken = async (authToken: string) => {
    try {
      const response = await fetch(resolveUrl('/api/v1/auth/me'), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setToken(authToken);
      } else {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Login: authenticate, fetch profile, land on dashboard ── */
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(resolveUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || 'Incorrect username or password');
      }
      const data = await response.json();
      const accessToken = data.access_token;

      localStorage.setItem('auth_token', accessToken);
      setToken(accessToken);

      // Fetch full user profile
      const meRes = await fetch(resolveUrl('/api/v1/auth/me'), {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        setUser(await meRes.json());
      } else {
        setUser({ id: '', username, created_at: new Date().toISOString(), is_active: true });
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Register: create account on server but do NOT log in.
       Returns the created username so the UI can show a success
       message and redirect the user to the sign-in form. ───── */
  const register = async (username: string, password: string): Promise<string> => {
    try {
      const response = await fetch(resolveUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || 'Registration failed');
      }
      const data = await response.json();
      // Auto-login: backend returns access_token on register
      if (data.access_token) {
        const accessToken = data.access_token;
        localStorage.setItem('auth_token', accessToken);
        setToken(accessToken);
        const meRes = await fetch(resolveUrl('/api/v1/auth/me'), {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (meRes.ok) {
          setUser(await meRes.json());
        } else {
          setUser({ id: data.user?.id ?? '', username, created_at: new Date().toISOString(), is_active: true });
        }
      }
      return data.user?.username ?? username;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}