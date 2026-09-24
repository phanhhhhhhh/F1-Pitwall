import { F1 } from "../lib/f1-theme";

// ─── local tyre data (lap-time penalty + degradation model) ──────────────────
// `lapTime` (fresh-tyre pace offset) has no backend equivalent, so it stays a
// static estimate. `degradation` is overridden from /api/tyrecompounds once it
// loads (see the tyrePerf effect in StrategyPage) — these values are only the
// pre-fetch/fallback defaults, kept close to real Pirelli compound behaviour.
export const TYRE_PERF_DEFAULTS: Record<string, { lapTime: number; degradation: number }> = {
  SOFT:         { lapTime: 0,   degradation: 0.8 },
  MEDIUM:       { lapTime: 0.5, degradation: 0.5 },
  HARD:         { lapTime: 1.2, degradation: 0.3 },
  INTERMEDIATE: { lapTime: 3.0, degradation: 0.6 },
  WET:          { lapTime: 6.0, degradation: 0.4 },
};
export type TyreType = keyof typeof TYRE_PERF_DEFAULTS;
export type TyrePerfTable = typeof TYRE_PERF_DEFAULTS;

export interface TyreCompoundApi {
  type: string;
  degradationRate: number;
}

export const STRATEGY_COLORS = [F1.red, "#3b82f6", F1.green, F1.gold, "#a855f7"];
export const STRATEGY_NAMES = ["Strategy A", "Strategy B", "Strategy C", "Strategy D", "Strategy E"];

export interface Stint    { id: string; tyre: TyreType; laps: number; }
export interface Strategy { id: string; name: string; color: string; stints: Stint[]; }

/** A strategy plan saved on the backend for a circuit's most recent race — see StrategyPlanController. */
export interface SavedPlan {
  id: number;
  planName: string;
  plannedStops: number;
  plannedCompounds: string;
  stints: { tyre: string; laps: number }[];
  raceName: string;
}
