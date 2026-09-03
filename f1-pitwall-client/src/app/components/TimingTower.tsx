"use client";

import Link from "next/link";
import type { DriverStanding } from "../types/f1";

interface TimingTowerProps {
  standings: DriverStanding[];
  loading: boolean;
}

const MEDAL_COLORS = ["#FFD200", "#E2E8F0", "#CD7F32"];

export default function TimingTower({ standings, loading }: TimingTowerProps) {
  return (
    <section
      className="lg:col-span-2 rise relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl transition-all hover:border-white/20"
      style={{ background: "linear-gradient(145deg, rgba(20,21,26,0.85) 0%, rgba(10,11,14,0.95) 100%)", animationDelay: "120ms" }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-gradient-to-r from-transparent via-[#E10600] to-transparent shadow-[0_0_10px_#E10600]" />

      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-5 bg-[#E10600] rounded-full shadow-[0_0_8px_#E10600]" />
          <h3 className="f-cond font-black text-lg tracking-wide uppercase text-white">
            CHAMPIONSHIP TIMING TOWER
          </h3>
          <span className="f-mono text-[10px] font-bold text-zinc-400 border border-white/10 rounded-md px-2 py-0.5 bg-black/40">
            TOP 6 WDC
          </span>
        </div>
        <Link
          href="/standings"
          className="f-mono text-[11px] font-bold text-[#E10600] hover:text-[#ff4f3b] transition-colors flex items-center gap-1 group"
        >
          FULL TABLE
          <span className="inline-block group-hover:translate-x-1 transition-transform">
            →
          </span>
        </Link>
      </div>

      <div className="relative">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <div className="py-16 text-center f-mono text-xs text-zinc-500 font-bold uppercase tracking-widest">
            Awaiting championship results · Sync a race to populate
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {standings.map((s, i) => {
              const col = s.teamColor || "#666";
              const isTop3 = i < 3;
              const medalCol = isTop3 ? MEDAL_COLORS[i] : "#71717a";

              return (
                <div
                  key={s.driverId}
                  className="tower-row relative flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-3.5 transition-all duration-200 hover:bg-white/[0.03] group"
                >
                  {/* Position number */}
                  <span
                    className="pos f-orbitron font-black text-2xl sm:text-3xl w-8 text-center tabular-nums transition-colors"
                    style={{ color: medalCol }}
                  >
                    {s.position}
                  </span>

                  {/* Team livery vertical stripe */}
                  <span
                    className="w-1.5 h-10 rounded-full flex-shrink-0 transition-all group-hover:scale-y-110"
                    style={{
                      background: col,
                      boxShadow: `0 0 10px ${col}80`,
                    }}
                  />

                  {/* Driver Name & Team */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="f-cond font-bold text-base sm:text-lg text-white truncate uppercase tracking-wide group-hover:text-white transition-colors">
                        {s.driverName}
                      </span>
                      {s.wins > 0 && (
                        <span className="f-mono text-[10px] font-bold text-[#FFD200] flex-shrink-0 px-1.5 py-0.2 rounded bg-amber-950/40 border border-amber-500/30">
                          🏆 {s.wins}
                        </span>
                      )}
                    </div>
                    <span className="f-mono text-[11px] font-semibold" style={{ color: col }}>
                      {s.teamName}
                    </span>
                  </div>

                  {/* Points & Gap */}
                  <div className="text-right flex-shrink-0">
                    <div
                      className="f-orbitron font-black text-xl sm:text-2xl tabular-nums leading-none"
                      style={{ color: i === 0 ? "#E10600" : "#ffffff" }}
                    >
                      {Math.round(s.totalPoints)}
                    </div>
                    <div className="f-mono text-[10px] font-bold text-zinc-500 mt-1">
                      {i === 0
                        ? "LEADER"
                        : `-${Math.round(s.gapToLeader)} PTS`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
