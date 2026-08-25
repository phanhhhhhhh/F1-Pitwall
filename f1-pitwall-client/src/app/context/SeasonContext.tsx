"use client";

import { createContext, useContext, useSyncExternalStore, useCallback, ReactNode } from "react";

const STORAGE_KEY = "pitwall_season";
const DEFAULT_SEASON = 2026;

interface SeasonContextType {
  season: number;
  setSeason: (year: number) => void;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

// localStorage-backed external store. useSyncExternalStore hydrates the stored
// value AFTER the server/client handoff (getServerSnapshot keeps the first
// client render identical to the server HTML), avoiding both a hydration
// mismatch and a synchronous setState in an effect.
const listeners = new Set<() => void>();
function emitChange() { listeners.forEach(l => l()); }
function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => { listeners.delete(onStoreChange); };
}
function getSnapshot(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 1950 && parsed <= 2030) return parsed;
  }
  return DEFAULT_SEASON;
}
function getServerSnapshot(): number { return DEFAULT_SEASON; }

export function SeasonProvider({ children }: { children: ReactNode }) {
  const season = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSeason = useCallback((year: number) => {
    localStorage.setItem(STORAGE_KEY, String(year));
    emitChange();
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
