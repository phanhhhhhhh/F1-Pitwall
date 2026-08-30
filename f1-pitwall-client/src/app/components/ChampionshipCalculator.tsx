"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { getTeamColor } from "../lib/f1-theme";
import type { DriverStanding } from "../types/f1";

interface ChampionshipCalculatorProps {
  initialStandings: DriverStanding[];
  season: number;
}

const F1_POINTS_MAP: Record<string, number> = {
  P1: 25,
  P2: 18,
  P3: 15,
  P4: 12,
  P5: 10,
  P6: 8,
  P7: 6,
  P8: 4,
  P9: 2,
  P10: 1,
  OUT: 0,
  DNF: 0,
};

export default function ChampionshipCalculator({
  initialStandings,
  season,
}: ChampionshipCalculatorProps) {
  // Scenario picks for top 6 drivers: { [driverId]: { finish: string, fastestLap: boolean } }
  const [scenarios, setScenarios] = useState<
    Record<number, { finish: string; fastestLap: boolean }>
  >({});

  const topContenders = useMemo(() => initialStandings.slice(0, 8), [initialStandings]);

  const updateFinish = (driverId: number, finish: string) => {
    setScenarios((prev) => ({
      ...prev,
      [driverId]: {
        finish,
        fastestLap: prev[driverId]?.fastestLap ?? false,
      },
    }));
  };

  const toggleFastestLap = (driverId: number) => {
    setScenarios((prev) => ({
      ...prev,
      [driverId]: {
        finish: prev[driverId]?.finish ?? "P1",
        fastestLap: !prev[driverId]?.fastestLap,
      },
    }));
  };

  const resetScenarios = () => setScenarios({});

  // Recalculate standings based on scenario
  const simulatedStandings = useMemo(() => {
    return initialStandings
      .map((d) => {
        const scen = scenarios[d.driverId];
        const addedPts = scen
          ? (F1_POINTS_MAP[scen.finish] ?? 0) + (scen.fastestLap ? 1 : 0)
          : 0;

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
  }, [initialStandings, scenarios]);

  const leader = simulatedStandings[0];
  const second = simulatedStandings[1];
  const gapToP2 = leader && second ? leader.simulatedPoints - second.simulatedPoints : 0;

  return (
    <div className="p-5 rounded-3xl bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#FACC15]" />
            <h3 className="f-cond font-black text-sm uppercase text-white tracking-wider">
              WHAT-IF CHAMPIONSHIP SCENARIO SIMULATOR
            </h3>
          </div>
          <p className="f-mono text-[10px] text-zinc-400">
            Pick finish positions for the next Grand Prix to simulate real-time points swings and title clinches
          </p>
        </div>

        <button
          onClick={resetScenarios}
          className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-black/40 text-xs f-mono font-bold text-zinc-300 hover:text-white hover:border-zinc-500 transition-all"
        >
          ↺ RESET SCENARIOS
        </button>
      </div>

      {/* Simulated Leader Banner */}
      {leader && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-black/60 to-zinc-900 border border-amber-500/40 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <span className="text-[10px] f-mono text-amber-400 font-bold uppercase tracking-wider block">
                PROJECTED CHAMPIONSHIP LEADER
              </span>
              <h4 className="text-xl sm:text-2xl font-black f-cond uppercase text-white">
                {leader.driverName}{" "}
                <span className="text-amber-400">({leader.simulatedPoints} PTS)</span>
              </h4>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] f-mono text-zinc-500 uppercase block">PROJECTED LEAD GAP</span>
            <span className="text-lg f-cond font-black text-emerald-400">
              +{gapToP2} PTS OVER {second?.driverName.split(" ").pop()?.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Simulation Grid */}
      <div className="space-y-3">
        {topContenders.map((driver) => {
          const sim = simulatedStandings.find((s) => s.driverId === driver.driverId);
          const col = getTeamColor(driver.teamName, driver.teamColor);
          const currentChoice = scenarios[driver.driverId]?.finish || "—";
          const hasFL = scenarios[driver.driverId]?.fastestLap || false;

          return (
            <div
              key={driver.driverId}
              className="p-3.5 rounded-2xl bg-black/60 border border-zinc-800/80 hover:border-zinc-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-all"
            >
              {/* Driver info & Position Delta */}
              <div className="flex items-center gap-3 min-w-[220px]">
                <div className="flex flex-col items-center justify-center w-9 text-center">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold">
                    P{driver.position}
                  </span>
                  {sim && sim.positionDelta !== 0 && (
                    <span
                      className={`text-[9px] f-mono font-black ${
                        sim.positionDelta > 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {sim.positionDelta > 0 ? `▲${sim.positionDelta}` : `▼${Math.abs(sim.positionDelta)}`}
                    </span>
                  )}
                </div>

                <span className="w-1.5 h-7 rounded-full" style={{ backgroundColor: col }} />

                <div>
                  <h5 className="f-cond font-black text-base text-white uppercase leading-none">
                    {driver.driverName}
                  </h5>
                  <p className="f-mono text-[10px] text-zinc-400 mt-0.5">
                    {driver.teamName} · Current: {Math.round(driver.totalPoints)} pts
                  </p>
                </div>
              </div>

              {/* Scenario Pickers (P1..P10, DNF, FL) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {["P1", "P2", "P3", "P4", "P5", "P6", "DNF"].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => updateFinish(driver.driverId, pos)}
                    className={`px-2.5 py-1 rounded-xl text-xs f-cond font-bold uppercase transition-all border ${
                      currentChoice === pos
                        ? "bg-red-600 text-white border-red-500 shadow-md scale-105"
                        : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    {pos}
                  </button>
                ))}

                {/* Fastest Lap Button */}
                <button
                  onClick={() => toggleFastestLap(driver.driverId)}
                  className={`px-2.5 py-1 rounded-xl text-xs f-mono font-bold uppercase transition-all border ${
                    hasFL
                      ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                      : "bg-zinc-900/80 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                  }`}
                  title="Fastest Lap (+1 pt)"
                >
                  ⚡ FL
                </button>
              </div>

              {/* Recalculated Points Pill */}
              <div className="flex items-center gap-2 min-w-[120px] justify-end">
                <div className="text-right">
                  <span className="text-sm f-cond font-black text-white block">
                    {sim?.simulatedPoints} PTS
                  </span>
                  <span
                    className={`text-[9px] f-mono font-bold ${
                      (sim?.addedPts ?? 0) > 0 ? "text-emerald-400" : "text-zinc-600"
                    }`}
                  >
                    {(sim?.addedPts ?? 0) > 0 ? `+${sim?.addedPts} pts` : "No change"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
