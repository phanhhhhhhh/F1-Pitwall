"use client";

import Link from "next/link";
import { COUNTRY_FLAGS } from "../lib/f1-theme";
import type { RaceInfo } from "../types/f1";

interface RaceCalendarSectionProps {
  calendar: RaceInfo[];
  winners: Record<string, { driver: string; team: string }>;
  loading: boolean;
}

export default function RaceCalendarSection({
  calendar,
  winners,
  loading,
}: RaceCalendarSectionProps) {
  return (
    <section
      className="lg:col-span-3 rise relative overflow-hidden rounded-2xl border border-white/5"
      style={{ background: "rgba(18,18,21,.7)", animationDelay: "280ms" }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 bg-[#E10600] rounded-full" />
          <h3 className="f-cond font-bold text-lg tracking-wide">
            RACE CALENDAR
          </h3>
        </div>
        <Link
          href="/races"
          className="f-mono text-[11px] text-[#E10600] hover:text-[#ff5a3c] transition-colors group"
        >
          VIEW ALL{" "}
          <span className="inline-block group-hover:translate-x-1 transition-transform">
            →
          </span>
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-20 m-2 rounded-lg bg-white/[0.03] animate-pulse"
              />
            ))
          : calendar.map((race) => {
              const w = winners[race.name];
              const done = race.status === "COMPLETED";
              const cancel = race.status === "CANCELLED";
              return (
                <Link
                  key={race.id}
                  href={
                    done
                      ? `/races/${race.id}/results`
                      : `/races/${race.id}/qualifying`
                  }
                  className={`group relative flex items-center gap-3 px-5 py-4 border-b border-r border-white/[0.04] transition-all hover:bg-white/[0.03] ${cancel ? "opacity-40" : ""}`}
                >
                  <span
                    className="f-cond font-black text-2xl w-7 text-center tabular-nums"
                    style={{
                      color: done ? "#22c55e" : cancel ? "#52525b" : "#3f3f46",
                    }}
                  >
                    {race.roundNumber}
                  </span>
                  <span className="text-2xl">
                    {COUNTRY_FLAGS[race.circuit?.country] || "🏁"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="f-cond font-bold text-sm text-white truncate group-hover:text-[#E10600] transition-colors uppercase tracking-wide">
                      {race.name.replace(" Grand Prix", " GP")}
                    </p>
                    {w ? (
                      <p className="f-mono text-[10px] text-zinc-500 truncate">
                        🏆 {w.driver}
                      </p>
                    ) : cancel ? (
                      <p className="f-mono text-[10px] text-red-400/60">
                        cancelled
                      </p>
                    ) : (
                      <p className="f-mono text-[10px] text-zinc-600">
                        {race.date}
                      </p>
                    )}
                  </div>
                  <span
                    className="f-mono text-[10px] px-2 py-1 rounded border"
                    style={{
                      color: done ? "#22c55e" : "#71717a",
                      borderColor: done
                        ? "rgba(34,197,94,.3)"
                        : "rgba(255,255,255,.08)",
                      background: done ? "rgba(34,197,94,.08)" : "transparent",
                    }}
                  >
                    {done ? "✓" : cancel ? "✗" : "—"}
                  </span>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
