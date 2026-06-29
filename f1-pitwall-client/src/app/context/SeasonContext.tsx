"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

const STORAGE_KEY = "pitwall_season";
const DEFAULT_SEASON = 2026;

interface SeasonContextType {
  season: number;
  setSeason: (year: number) => void;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [season, setSeasonState] = useState(DEFAULT_SEASON);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 1950 && parsed <= 2030) {
        setSeasonState(parsed);
      }
    }
  }, []);

  const setSeason = useCallback((year: number) => {
    setSeasonState(year);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(year));
    }
  }, []);

  return (
    <SeasonContext.Provider value={{ season, setSeason }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error("useSeason must be used within a SeasonProvider");
  return ctx;
}
