import { authFetch } from "./pitwall-auth";
import { BASE_URL as API } from "./api-client";
import type {
  CircuitGeometry,
  CircuitInfo,
  PitStopBenchmark,
  TeamLivery,
} from "../types/f1";

/**
 * Typed fetchers for the data the 3D widgets run on.
 *
 * <p>The widgets are rendered on several pages and each of them needs the same few endpoints, so
 * the request shape lives here rather than being re-implemented per component.
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

export function fetchTeamLiveries(): Promise<TeamLivery[]> {
  return getJson<TeamLivery[]>("/api/teams/livery");
}

export function fetchPitStopBenchmark(season: number): Promise<PitStopBenchmark> {
  return getJson<PitStopBenchmark>(`/api/races/pit-stops/benchmark/${season}`);
}

/** Formats a lap time in seconds as `m:ss.mmm`. */
export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = (seconds % 60).toFixed(3);
  return `${minutes}:${rest.padStart(6, "0")}`;
}
