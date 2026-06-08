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
const PUBLIC_PATHS = ["/login", "/register", "/oauth2", "/forgot-password"];

async function fetchUserWithRetry(retries = 2): Promise<User | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await authFetch(`${API_URL}/api/auth/me`);
      if (res.ok) {
        const data = await res.json();
        // Cache avatar + displayName in localStorage
        if (typeof window !== "undefined") {
          if (data.avatarUrl) localStorage.setItem("pitwall_avatar", data.avatarUrl);
          if (data.displayName) localStorage.setItem("pitwall_displayname", data.displayName);
        }
        return data;
      }
      if (res.status === 401) return null;
    } catch (e) {
      if (i < retries) await new Promise(r => setTimeout(r, 3000));
    }
  }
  // Fallback to localStorage when backend sleeping
  if (typeof window !== "undefined") {
    const username = localStorage.getItem("pitwall_username");
    const role = localStorage.getItem("pitwall_role");
    const avatarUrl = localStorage.getItem("pitwall_avatar") || "";
    const displayName = localStorage.getItem("pitwall_displayname") || "";
    if (username) return { id: 0, username, email: "", role: role || "VIEWER", createdAt: "", avatarUrl, displayName };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("pitwall_access");
    const username = localStorage.getItem("pitwall_username");
    const role = localStorage.getItem("pitwall_role");
    const avatarUrl = localStorage.getItem("pitwall_avatar") || "";
    const displayName = localStorage.getItem("pitwall_displayname") || "";
    if (token && username) {
      return { id: 0, username, email: "", role: role || "VIEWER", createdAt: "", avatarUrl, displayName };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return Boolean(localStorage.getItem("pitwall_access"));
  });

  useEffect(() => {
    const token = getAccessToken();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!token) { setIsLoading(false); return; }

    fetchUserWithRetry(2)
      .then((data) => {
        if (data) {
          setUser(data);
        } else {
          if (!getAccessToken()) return;
          const path = window.location.pathname;
          const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p));
          if (!isPublic) { clearTokens(); window.location.href = "/login"; }
          else { clearTokens(); }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loginSuccess = (data: AuthResponse) => {
    setUser({ id: 0, username: data.username, email: "", role: data.role, createdAt: new Date().toISOString() });
  };

  const logout = () => { clearTokens(); setUser(null); window.location.href = "/login"; };

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