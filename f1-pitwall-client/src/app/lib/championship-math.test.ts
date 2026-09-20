import { describe, expect, it } from "vitest";
import { F1_POINTS_MAP, simulateStandings } from "./championship-math";
import type { DriverStanding } from "../types/f1";

const d = (driverId: number, position: number, totalPoints: number) =>
  ({ driverId, position, totalPoints } as unknown as DriverStanding);

const base = [d(1, 1, 100), d(2, 2, 95), d(3, 3, 50)];

describe("simulateStandings", () => {
  it("leaves order unchanged with no scenarios", () => {
    const r = simulateStandings(base, {});
    expect(r.map((x) => x.driverId)).toEqual([1, 2, 3]);
    expect(r.every((x) => x.addedPts === 0 && x.positionDelta === 0)).toBe(true);
  });
  it("awards finish points plus a fastest-lap bonus and re-sorts", () => {
    const r = simulateStandings(base, { 2: { finish: "P1", fastestLap: true } });
    expect(r[0]).toMatchObject({ driverId: 2, simulatedPoints: 121, addedPts: 26, simulatedPosition: 1, positionDelta: 1 });
    expect(r[1]).toMatchObject({ driverId: 1, positionDelta: -1 });
  });
  it("treats DNF/unknown finishes as zero points", () => {
    expect(simulateStandings(base, { 3: { finish: "DNF", fastestLap: false } })[2].addedPts).toBe(0);
    expect(simulateStandings(base, { 3: { finish: "P99", fastestLap: false } })[2].addedPts).toBe(0);
  });
  it("does not mutate its input", () => {
    simulateStandings(base, { 3: { finish: "P1", fastestLap: false } });
    expect(base.map((x) => x.driverId)).toEqual([1, 2, 3]);
  });
  it("uses the standard points table", () => {
    expect(F1_POINTS_MAP.P1).toBe(25);
    expect(F1_POINTS_MAP.P10).toBe(1);
  });
});
