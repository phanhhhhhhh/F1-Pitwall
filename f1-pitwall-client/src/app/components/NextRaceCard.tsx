"use client";

import { COUNTRY_FLAGS } from "../lib/f1-theme";
import type { RaceInfo } from "../types/f1";

interface NextRaceCardProps {
  nextRace: RaceInfo | null;
  countdown: { d: number; h: number; m: number; s: number; raceDay: boolean };
}

export default function NextRaceCard({ nextRace, countdown }: NextRaceCardProps) {
  return (
    <div
      className="rise relative overflow-hidden rounded-3xl border border-[#E10600]/30 shadow-2xl transition-all duration-300 hover:border-[#E10600]/60"
      style={{
        background: "linear-gradient(145deg, rgba(225,6,0,0.12) 0%, rgba(18,19,24,0.92) 50%, rgba(10,11,14,0.98) 100%)",
        animationDelay: "80ms",
      }}
    >
      {/* Top red laser edge */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, transparent, #E10600, #ff8000, transparent)" }}
      />

      <div className="p-6 sm:p-7 h-full flex flex-col">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header pill */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E10600] live-pulse" />
              <span className="f-mono text-[11px] tracking-[0.3em] text-[#E10600] font-black uppercase">
                UPCOMING GRAND PRIX
              </span>
            </div>
            {nextRace && (
              <span className="f-mono text-[10px] text-zinc-300 font-bold px-2 py-0.5 rounded-md bg-black/60 border border-white/10">
                ROUND {String(nextRace.roundNumber).padStart(2, "0")}
              </span>
            )}
          </div>

          {nextRace ? (
            <>
              <div className="flex items-start gap-4 mt-3 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
                  {COUNTRY_FLAGS[nextRace.circuit?.country] || "🏁"}
                </div>
                <div className="min-w-0">
                  <h2 className="f-cond font-black text-2xl sm:text-3xl leading-tight text-white uppercase tracking-tight truncate">
                    {nextRace.name}
                  </h2>
                  <p className="f-mono text-xs text-zinc-400 mt-1 font-semibold truncate">
                    📍 {nextRace.circuit?.name || "Official Grand Prix Circuit"}
                  </p>
                </div>
              </div>

              {countdown.raceDay ? (
                <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center my-auto">
                  <p
                    className="f-cond font-black text-4xl text-[#E10600] tracking-widest uppercase"
                    style={{ animation: "glow 1.2s infinite" }}
                  >
                    ● LIGHTS OUT TODAY
                  </p>
                  <p className="f-mono text-xs text-zinc-400 mt-1">Race session underway</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2.5 my-auto">
                  {[
                    { v: countdown.d, l: "DAYS" },
                    { v: countdown.h, l: "HRS" },
                    { v: countdown.m, l: "MIN" },
                    { v: countdown.s, l: "SEC" },
                  ].map((u) => (
                    <div
                      key={u.l}
                      className="rounded-2xl border border-white/10 text-center py-3.5 px-1 bg-black/50 backdrop-blur-md shadow-inner transition-transform hover:-translate-y-0.5"
                    >
                      <div
                        className="f-orbitron font-black text-2xl sm:text-3xl tabular-nums leading-none"
                        style={{ color: u.l === "SEC" ? "#E10600" : "#ffffff" }}
                      >
                        {String(u.v).padStart(2, "0")}
                      </div>
                      <div className="f-mono text-[9px] font-bold tracking-widest text-zinc-500 mt-2">
                        {u.l}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs f-mono text-zinc-400 font-bold">
                <span>🗓 {nextRace.date}</span>
                <span className="text-[#00E676] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                  TIMING READY
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 f-mono text-sm py-12">
              Championship Season Complete
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
