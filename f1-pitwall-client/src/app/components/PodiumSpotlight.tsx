"use client";

import { motion } from "framer-motion";
import { getTeamColor, flagForNationality } from "../lib/f1-theme";
import type { DriverStanding } from "../types/f1";

interface PodiumSpotlightProps {
  standings: DriverStanding[];
}

export default function PodiumSpotlight({ standings }: PodiumSpotlightProps) {
  if (!standings || standings.length < 3) return null;

  const p1 = standings[0];
  const p2 = standings[1];
  const p3 = standings[2];

  const podiumSlots = [
    { rank: 2, driver: p2, height: "h-44", color: "#C0C0C0", label: "P2 SILVER", delay: 0.1 },
    { rank: 1, driver: p1, height: "h-56", color: "#FFD200", label: "P1 GOLD", delay: 0.2 },
    { rank: 3, driver: p3, height: "h-36", color: "#CD7F32", label: "P3 BRONZE", delay: 0.05 },
  ];

  return (
    <div className="w-full bg-gradient-to-b from-[#13141a] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden mb-6">
      <div className="flex items-center justify-between pb-3 mb-6 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 live-pulse" />
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
            CHAMPIONSHIP PODIUM SPOTLIGHT (2026)
          </h3>
        </div>
        <span className="text-xs font-mono text-zinc-500 font-bold uppercase">WDC TOP 3 BATTLE</span>
      </div>

      {/* ── 3D Podium Pedestals ────────────────────────────────────────────── */}
      <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 px-2">
        {podiumSlots.map(({ rank, driver, height, color, label, delay }) => {
          const teamColor = getTeamColor(driver.teamName, driver.teamColor);
          const flag = flagForNationality(driver.nationality);

          return (
            <motion.div
              key={rank}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 max-w-[200px] flex flex-col items-center"
            >
              {/* Driver Badge */}
              <div className="flex flex-col items-center mb-3 text-center w-full">
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black f-orbitron text-xl sm:text-2xl shadow-xl border-2 mb-2 relative"
                  style={{
                    borderColor: color,
                    background: `linear-gradient(135deg, ${teamColor}33 0%, #000 100%)`,
                    color: "#fff",
                  }}
                >
                  {driver.carNumber || rank}
                  <span className="absolute -bottom-1 -right-1 text-sm">{flag}</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white uppercase f-cond truncate w-full">
                  {driver.driverName}
                </div>
                <div className="text-[10px] text-zinc-400 truncate w-full">{driver.teamName}</div>
                <div
                  className="text-xs sm:text-sm font-black f-orbitron mt-1"
                  style={{ color }}
                >
                  {Math.round(driver.totalPoints)} <span className="text-[10px] font-normal text-zinc-500">PTS</span>
                </div>
              </div>

              {/* Pedestal Block */}
              <div
                className={`w-full ${height} rounded-t-2xl flex flex-col items-center justify-between p-3 relative overflow-hidden border-t-2 shadow-2xl transition-transform hover:-translate-y-1`}
                style={{
                  borderColor: color,
                  background: `linear-gradient(180deg, ${color}20 0%, #111216 100%)`,
                }}
              >
                <span className="text-[10px] font-black f-orbitron tracking-widest uppercase" style={{ color }}>
                  {label}
                </span>

                <span className="text-4xl sm:text-5xl font-black f-orbitron opacity-40 select-none" style={{ color }}>
                  {rank}
                </span>

                <div className="text-[10px] text-zinc-400 f-mono flex items-center gap-2">
                  <span>🏆 {driver.wins || 0}W</span>
                  <span>◎ {driver.podiums || 0}P</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
