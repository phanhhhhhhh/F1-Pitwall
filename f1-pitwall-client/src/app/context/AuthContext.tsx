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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return Boolean(window.sessionStorage.getItem("pitwall_access"));
  });

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      authFetch(`${API_URL}/api/auth/me`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => setUser(data))
        .catch(() => {
          clearTokens();
          setUser(null);
          window.location.href = "/login";
        })
        .finally(() => setIsLoading(false));
    }
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
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginSuccess,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}