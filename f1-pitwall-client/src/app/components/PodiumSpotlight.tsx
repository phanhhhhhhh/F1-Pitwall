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
    <div className="w-full bg-gradient-to-b from-[#15161f] via-[#0f1015] to-[#08080a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden mb-6 relative">
      {/* Overhead glowing spotlight */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(255,210,0,0.3) 0%, rgba(225,6,0,0.15) 40%, transparent 80%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFD200] to-transparent shadow-[0_0_12px_#FFD200]" />

      <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08] relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD200] live-pulse" />
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
            CHAMPIONSHIP PODIUM SPOTLIGHT (2026)
          </h3>
        </div>
        <span className="text-xs font-mono text-zinc-400 font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-black/50 border border-white/10">
          WDC TOP 3 BATTLE
        </span>
      </div>

      {/* ── 3D Podium Pedestals ────────────────────────────────────────────── */}
      <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 px-2 relative z-10">
        {podiumSlots.map(({ rank, driver, height, color, label, delay }) => {
          const teamColor = getTeamColor(driver.teamName, driver.teamColor);
          const flag = flagForNationality(driver.nationality);

          return (
            <motion.div
              key={rank}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 max-w-[220px] flex flex-col items-center"
            >
              {/* Driver Badge */}
              <div className="flex flex-col items-center mb-3.5 text-center w-full">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black f-orbitron text-xl sm:text-2xl shadow-2xl border-2 mb-2 relative group hover:scale-105 transition-transform"
                  style={{
                    borderColor: color,
                    background: `linear-gradient(135deg, ${teamColor}40 0%, #08080a 100%)`,
                    color: "#fff",
                    boxShadow: `0 0 20px ${color}40`,
                  }}
                >
                  {driver.carNumber || rank}
                  <span className="absolute -bottom-1 -right-1 text-sm bg-black/80 rounded-full px-1 border border-white/20 shadow">{flag}</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-white uppercase f-cond tracking-wide truncate w-full">
                  {driver.driverName}
                </div>
                <div className="text-[10px] text-zinc-400 font-bold truncate w-full mt-0.5">{driver.teamName}</div>
                <div
                  className="text-xs sm:text-sm font-black f-orbitron mt-1.5"
                  style={{ color }}
                >
                  {Math.round(driver.totalPoints)} <span className="text-[10px] font-bold text-zinc-500">PTS</span>
                </div>
              </div>

              {/* Pedestal Block */}
              <div
                className={`w-full ${height} rounded-t-3xl flex flex-col items-center justify-between p-3.5 relative overflow-hidden border-t-2 shadow-2xl transition-all duration-300 hover:-translate-y-1`}
                style={{
                  borderColor: color,
                  background: `linear-gradient(180deg, ${color}25 0%, rgba(18,19,24,0.95) 100%)`,
                  boxShadow: `0 10px 30px -10px rgba(0,0,0,0.8), inset 0 1px 0 ${color}60`,
                }}
              >
                <span className="text-[10px] font-black f-orbitron tracking-widest uppercase" style={{ color }}>
                  {label}
                </span>

                <span className="text-5xl sm:text-6xl font-black f-orbitron opacity-30 select-none drop-shadow" style={{ color }}>
                  {rank}
                </span>

                <div className="text-[10px] text-zinc-400 f-mono font-bold flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 border border-white/5">
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
