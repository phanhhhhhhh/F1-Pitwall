import { authFetch } from "./pitwall-auth";
import { BASE_URL as API } from "./api-client";
import type { CircuitGeometry, CircuitInfo } from "../types/f1";

/**
 * Typed fetchers for the circuit data the track map and 3D circuit viewer run on.
 */

async function getJson<T>(path: string): Promise<T> {
  const res = await authFetch(`${API}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function fetchCircuits(): Promise<CircuitInfo[]> {
  return getJson<CircuitInfo[]>("/api/circuits");
}

/**
 * The racing line for one circuit. The backend builds it from external sources on first request,
 * so the first call for a given circuit can take a few seconds — callers should show a loading
 * state rather than blocking the page.
 */
export function fetchCircuitGeometry(circuitId: number): Promise<CircuitGeometry> {
  return getJson<CircuitGeometry>(`/api/circuits/${circuitId}/geometry`);
}

/** Formats a lap time in seconds as `m:ss.mmm`. */
export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds % 60).toFixed(3);
  return `${minutes}:${rest.padStart(6, "0")}`;
}
