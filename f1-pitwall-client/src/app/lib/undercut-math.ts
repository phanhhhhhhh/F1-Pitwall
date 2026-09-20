export type PitLossMode = "GREEN" | "VSC" | "SC";

export const PIT_LOSS_BY_MODE: Record<PitLossMode, number> = { GREEN: 22.0, VSC: 12.0, SC: 9.5 };

export interface UndercutInput {
  initialGap: number;
  freshTyreAdvantage: number;
  wornTyreDeg: number;
  leaderResponseLaps: number;
  pitLossMode: PitLossMode;
}

/** Chaser pits first; each lap the leader stays out the chaser gains fresh-tyre pace plus the leader's wear. */
export function calcUndercut(i: UndercutInput) {
  const pitLossSec = PIT_LOSS_BY_MODE[i.pitLossMode];
  const totalPaceGained = (i.freshTyreAdvantage + i.wornTyreDeg) * i.leaderResponseLaps;
  const netDelta = totalPaceGained - i.initialGap;
  return { netDelta: Math.abs(netDelta), isSuccessful: netDelta > 0, totalPaceGained, pitLossSec };
}
