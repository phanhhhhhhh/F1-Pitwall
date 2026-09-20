import { describe, expect, it } from "vitest";
import { calcUndercut, PIT_LOSS_BY_MODE } from "./undercut-math";

const input = { initialGap: 1.8, freshTyreAdvantage: 1.4, wornTyreDeg: 0.5, leaderResponseLaps: 1, pitLossMode: "GREEN" as const };

describe("calcUndercut", () => {
  it("succeeds when pace gained exceeds the gap", () => {
    const r = calcUndercut({ ...input, leaderResponseLaps: 2 });
    expect(r.isSuccessful).toBe(true);
    expect(r.totalPaceGained).toBeCloseTo(3.8);
    expect(r.netDelta).toBeCloseTo(2.0);
  });
  it("fails and reports the shortfall when the leader responds quickly", () => {
    const r = calcUndercut({ ...input, initialGap: 2.5 });
    expect(r.isSuccessful).toBe(false);
    expect(r.netDelta).toBeCloseTo(0.6);
  });
  it("is not a success on an exact tie", () => {
    expect(calcUndercut({ ...input, freshTyreAdvantage: 1, wornTyreDeg: 1, initialGap: 2 }).isSuccessful).toBe(false);
  });
  it("maps pit loss to the flag condition", () => {
    expect(calcUndercut({ ...input, pitLossMode: "VSC" }).pitLossSec).toBe(PIT_LOSS_BY_MODE.VSC);
    expect(calcUndercut({ ...input, pitLossMode: "SC" }).pitLossSec).toBe(9.5);
  });
});
