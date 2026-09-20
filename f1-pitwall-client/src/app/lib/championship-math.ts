import type { DriverStanding } from "../types/f1";

export const F1_POINTS_MAP: Record<string, number> = {
  P1: 25, P2: 18, P3: 15, P4: 12, P5: 10, P6: 8, P7: 6, P8: 4, P9: 2, P10: 1,
  OUT: 0, DNF: 0,
};

export interface Scenario { finish: string; fastestLap: boolean; }

export function simulateStandings(
  standings: DriverStanding[],
  scenarios: Record<number, Scenario>,
) {
  return standings
    .map((d) => {
      const scen = scenarios[d.driverId];
      const addedPts = scen ? (F1_POINTS_MAP[scen.finish] ?? 0) + (scen.fastestLap ? 1 : 0) : 0;
      return {
        ...d,
        simulatedPoints: Math.round(d.totalPoints) + addedPts,
        addedPts,
        finishChoice: scen?.finish || "—",
        hasFL: scen?.fastestLap || false,
      };
    })
    .sort((a, b) => b.simulatedPoints - a.simulatedPoints)
    .map((d, index) => ({
      ...d,
      simulatedPosition: index + 1,
      positionDelta: d.position - (index + 1),
    }));
}
