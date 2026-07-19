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
      className="rise relative overflow-hidden rounded-2xl border border-[#E10600]/20"
      style={{
        background: "linear-gradient(160deg,rgba(225,6,0,.08),rgba(15,15,18,.85))",
        animationDelay: "80ms",
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg,transparent,#E10600,transparent)" }}
      />
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <span className="f-mono text-[11px] tracking-[0.3em] text-[#E10600] font-bold">
            NEXT RACE
          </span>
          {nextRace && (
            <span className="f-mono text-[11px] text-zinc-600">
              RND {nextRace.roundNumber}
            </span>
          )}
        </div>
        {nextRace ? (
          <>
            <div className="flex items-center gap-3 mt-2 mb-5">
              <span className="text-4xl">
                {COUNTRY_FLAGS[nextRace.circuit?.country] || "🏁"}
              </span>
              <div className="min-w-0">
                <h2 className="f-cond font-bold text-2xl leading-tight text-white truncate">
                  {nextRace.name}
                </h2>
                <p className="f-mono text-[11px] text-zinc-500 truncate">
                  {nextRace.circuit?.name}
                </p>
              </div>
            </div>
            {countdown.raceDay ? (
              <div className="flex-1 flex items-center justify-center">
                <p
                  className="f-cond font-black text-3xl text-[#E10600]"
                  style={{ animation: "glow 1.2s infinite" }}
                >
                  ● RACE DAY
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 mt-auto">
                {[
                  { v: countdown.d, l: "DAYS" },
                  { v: countdown.h, l: "HRS" },
                  { v: countdown.m, l: "MIN" },
                  { v: countdown.s, l: "SEC" },
                ].map((u) => (
                  <div
                    key={u.l}
                    className="rounded-lg border border-white/8 text-center py-3"
                    style={{ background: "rgba(0,0,0,.3)" }}
                  >
                    <div
                      className="f-cond font-black text-3xl tabular-nums leading-none"
                      style={{ color: u.l === "SEC" ? "#E10600" : "#fff" }}
                    >
                      {String(u.v).padStart(2, "0")}
                    </div>
                    <div className="f-mono text-[9px] tracking-widest text-zinc-600 mt-1.5">
                      {u.l}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="f-mono text-[11px] text-zinc-600 mt-4 text-center">
              {nextRace.date}
            </p>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 f-mono text-sm">
            Season complete
          </div>
        )}
      </div>
    </div>
  );
}
