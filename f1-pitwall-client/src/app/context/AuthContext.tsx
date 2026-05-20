"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthResponse, User, clearTokens, getAccessToken, authFetch } from "../lib/pitwall-auth";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginSuccess: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const PUBLIC_PATHS = ["/login", "/register", "/oauth2"];

async function fetchUserWithRetry(retries = 2): Promise<User | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await authFetch(`${API_URL}/api/auth/me`);
      if (res.ok) return await res.json();
      if (res.status === 401) return null;
    } catch (e) {
      if (i < retries) await new Promise(r => setTimeout(r, 3000));
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return Boolean(window.sessionStorage.getItem("pitwall_access"));
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setIsLoading(false); return; }

    fetchUserWithRetry(2)
      .then((data) => {
        if (data) {
          setUser(data);
        } else {
          const path = window.location.pathname;
          const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p));
          if (!isPublic) {
            clearTokens();
            window.location.href = "/login";
          } else {
            clearTokens();
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loginSuccess = (data: AuthResponse) => {
    setUser({
      id: 0,
      username: data.username,
      email: "",
      role: data.role,
      createdAt: new Date().toISOString(),
    });
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, loginSuccess, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}