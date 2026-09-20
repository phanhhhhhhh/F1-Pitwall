import { describe, expect, it } from "vitest";
import { PIT_LOSS, calcRaceTime, calcStintTime, formatLapTime, formatTime } from "./strategy-math";

const perf = {
  SOFT: { lapTime: 0, degradation: 1 },
  HARD: { lapTime: 1, degradation: 0.5 },
};

describe("calcStintTime", () => {
  it("sums base + offset + degradation*lap for each lap", () => {
    // laps 1..3: (90+0+1)+(90+0+2)+(90+0+3) = 276
    expect(calcStintTime({ tyre: "SOFT", laps: 3 }, 90, perf)).toBe(276);
  });
  it("falls back to HARD for unknown compounds", () => {
    expect(calcStintTime({ tyre: "???", laps: 1 }, 90, perf)).toBe(91.5);
  });
  it("is zero for a zero-lap stint", () => {
    expect(calcStintTime({ tyre: "SOFT", laps: 0 }, 90, perf)).toBe(0);
  });
});

describe("calcRaceTime", () => {
  it("adds one pit loss per stop", () => {
    const stints = [{ tyre: "SOFT", laps: 2 }, { tyre: "HARD", laps: 2 }];
    // SOFT 2 laps = 183, HARD 2 laps = 183.0 → 91.5 + 92 = 183.5; total 366.5 + 22
    expect(calcRaceTime(stints, 90, perf)).toBe(366.5 + PIT_LOSS);
  });
  it("scales pit loss with the number of stops", () => {
    const stints = [{ tyre: "SOFT", laps: 1 }, { tyre: "SOFT", laps: 1 }, { tyre: "SOFT", laps: 1 }];
    expect(calcRaceTime(stints, 90, perf)).toBe(91 * 3 + 2 * PIT_LOSS);
  });
  it("charges nothing for a single stint or no stints", () => {
    expect(calcRaceTime([{ tyre: "SOFT", laps: 1 }], 90, perf)).toBe(91);
    expect(calcRaceTime([], 90, perf)).toBe(0);
  });
});

describe("formatters", () => {
  it("formats race time with and without hours", () => {
    expect(formatTime(5432.16)).toBe("1h 30m 32.2s");
    expect(formatTime(75.5)).toBe("1m 15.5s");
  });
  it("formats lap time as m:ss.mmm", () => {
    expect(formatLapTime(83.4567)).toBe("1:23.457");
    expect(formatLapTime(59.1)).toBe("0:59.100");
  });
  it("never renders 60 seconds", () => {
    expect(formatTime(119.98)).toBe("2m 0.0s");
    expect(formatLapTime(119.9996)).toBe("2:00.000");
  });
});
