export interface TyrePerf { lapTime: number; degradation: number; }
export type TyrePerfTable = Record<string, TyrePerf>;
export interface StintLike { tyre: string; laps: number; }

export const PIT_LOSS = 22;

export function calcStintTime(stint: StintLike, base: number, perf: TyrePerfTable): number {
  const p = perf[stint.tyre] ?? perf.HARD;
  let total = 0;
  for (let lap = 1; lap <= stint.laps; lap++) total += base + p.lapTime + p.degradation * lap;
  return total;
}

export function calcRaceTime(stints: StintLike[], base: number, perf: TyrePerfTable): number {
  const laps = stints.reduce((sum, s) => sum + calcStintTime(s, base, perf), 0);
  return laps + Math.max(0, stints.length - 1) * PIT_LOSS;
}

export function formatTime(sec: number): string {
  const t = Math.round(sec * 10) / 10;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(1);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

export function formatLapTime(sec: number): string {
  const t = Math.round(sec * 1000) / 1000;
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}
