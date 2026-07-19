"use client";

import Link from "next/link";
import type { DriverStanding } from "../types/f1";

interface TimingTowerProps {
  standings: DriverStanding[];
  loading: boolean;
}

export default function TimingTower({ standings, loading }: TimingTowerProps) {
  return (
    <section
      className="lg:col-span-2 rise relative overflow-hidden rounded-2xl border border-white/5"
      style={{ background: "rgba(18,18,21,.7)", animationDelay: "120ms" }}
    >
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
        <div
          className="h-full w-1/3 shimmer"
          style={{
            background: "linear-gradient(90deg,transparent,rgba(225,6,0,.6),transparent)",
          }}
        />
      </div>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 bg-[#E10600] rounded-full" />
          <h3 className="f-cond font-bold text-lg tracking-wide">
            CHAMPIONSHIP STANDINGS
          </h3>
          <span className="f-mono text-[10px] text-zinc-600 border border-white/10 rounded px-1.5 py-0.5">
            TOP 6
          </span>
        </div>
        <Link
          href="/standings"
          className="f-mono text-[11px] text-[#E10600] hover:text-[#ff5a3c] transition-colors group"
        >
          FULL TABLE{" "}
          <span className="inline-block group-hover:translate-x-1 transition-transform">
            →
          </span>
        </Link>
      </div>
      <div className="relative">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <div className="py-12 text-center f-mono text-sm text-zinc-600">
            No standings yet · sync a race first
          </div>
        ) : (
          <>
            <div
              className="absolute left-0 right-0 h-12 pointer-events-none"
              style={{
                background: "linear-gradient(180deg,rgba(225,6,0,.07),transparent)",
                animation: "scan 7s linear infinite",
              }}
            />
            {standings.map((s, i) => {
              const col = s.teamColor || "#666";
              return (
                <div
                  key={s.driverId}
                  className="tower-row relative flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 border-b border-white/[0.04] transition-colors"
                >
                  <span
                    className="pos f-cond font-black italic text-3xl sm:text-4xl w-9 text-center tabular-nums transition-colors"
                    style={{ color: i === 0 ? "#E10600" : "#3f3f46" }}
                  >
                    {s.position}
                  </span>
                  <span
                    className="w-1 h-9 rounded-full flex-shrink-0"
                    style={{
                      background: col,
                      boxShadow: `0 0 10px ${col}80`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="f-cond font-bold text-base sm:text-lg text-white truncate uppercase tracking-wide">
                        {s.driverName}
                      </span>
                      {s.wins > 0 && (
                        <span className="f-mono text-[10px] text-[#FFD200] flex-shrink-0">
                          🏆{s.wins}
                        </span>
                      )}
                    </div>
                    <span className="f-mono text-[11px]" style={{ color: col }}>
                      {s.teamName}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className="f-cond font-black text-2xl tabular-nums leading-none"
                      style={{ color: i === 0 ? "#E10600" : "#fff" }}
                    >
                      {Math.round(s.totalPoints)}
                    </div>
                    <div className="f-mono text-[10px] text-zinc-600">
                      {i === 0
                        ? "PTS · LEADER"
                        : `-${Math.round(s.gapToLeader)} PTS`}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
