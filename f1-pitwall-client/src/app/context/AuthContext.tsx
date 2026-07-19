"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthResponse, User, clearTokens, getAccessToken, authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API_URL } from "../lib/api-client";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginSuccess: (data: AuthResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PUBLIC_PATHS = ["/login", "/register", "/oauth2", "/forgot-password"];

async function fetchUserWithRetry(retries = 2): Promise<User | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await authFetch(`${API_URL}/api/auth/me`);
      if (res.ok) {
        const data = await res.json();
        // Cache avatar + displayName in localStorage (clear when removed server-side)
        if (typeof window !== "undefined") {
          localStorage.setItem("pitwall_avatar", data.avatarUrl || "");
          localStorage.setItem("pitwall_displayname", data.displayName || "");
        }
        return data;
      }
      if (res.status === 401) return null;
    } catch {
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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setIsLoading(false); return; }

    // Populate from cache immediately so UI doesn't flash logged-out state
    const username = localStorage.getItem("pitwall_username");
    const role = localStorage.getItem("pitwall_role");
    const avatarUrl = localStorage.getItem("pitwall_avatar") || "";
    const displayName = localStorage.getItem("pitwall_displayname") || "";
    if (username) {
      setUser({ id: 0, username, email: "", role: role || "VIEWER", createdAt: "", avatarUrl, displayName });
    }

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

  // Re-fetch /me so Navbar etc. pick up profile changes without a full reload
  const refreshUser = async () => {
    const data = await fetchUserWithRetry(0);
    if (data) setUser(data);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, loginSuccess, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}