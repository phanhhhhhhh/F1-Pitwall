"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import Navbar from "../components/Navbar";
import { SkeletonCard } from "../components/LoadingSkeleton";
import { NATIONALITY_FLAGS, COUNTRY_FLAGS, useCountUp } from "../lib/f1-theme";
import type { TeamInfo, DriverCard } from "../types/f1";

const ENGINE_SUPPLIERS: Record<string, string> = {
  "Red Bull Racing": "Honda RBPT",
  "Ferrari": "Ferrari 066/12",
  "Scuderia Ferrari": "Ferrari 066/12",
  "McLaren": "Mercedes-AMG M15",
  "Mercedes-AMG Petronas": "Mercedes-AMG M15",
  "Aston Martin": "Honda HRC",
  "Williams": "Mercedes-AMG M15",
  "Haas": "Ferrari 066/12",
  "Racing Bulls": "Honda RBPT",
  "Alpine": "Mercedes-AMG M15",
  "Audi": "Audi F1 Power Unit",
  "Cadillac": "Ferrari Power Unit",
};

function TeamCard({ team, drivers, idx }: { team: TeamInfo; drivers: DriverCard[]; idx: number }) {
  const [hov, setHov] = useState(false);
  const col = team.colorHex || "#E10600";
  const td = drivers.filter((d) => d.team?.name === team.name);
  const titles = useCountUp(team.championships, 900, idx * 80);
  const budget = useCountUp(team.annualBudgetM, 900, idx * 80 + 150);

  const engine = ENGINE_SUPPLIERS[team.name] || "1.6L V6 Turbo Hybrid";

  return (
    <div
      className="group relative rise"
      style={{ animationDelay: `${idx * 60}ms` }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className="absolute inset-0 rounded-3xl transition-opacity duration-500 pointer-events-none"
        style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 44px ${col}30` }}
      />
      <div
        className="relative border rounded-3xl overflow-hidden transition-all duration-300 bg-gradient-to-b from-zinc-900/90 to-black/95 p-6 shadow-xl"
        style={{
          borderColor: hov ? `${col}80` : "rgba(255,255,255,.08)",
          transform: hov ? "translateY(-5px)" : "none",
        }}
      >
        <div className="h-1 w-full absolute top-0 left-0 right-0" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />
        
        {/* Championship watermark */}
        <div
          className="absolute right-3 top-4 f-cond font-black select-none pointer-events-none transition-all duration-500 text-8xl"
          style={{
            lineHeight: 0.8,
            color: col,
            opacity: hov ? 0.12 : 0.04,
            transform: hov ? "scale(1.08)" : "none",
          }}
        >
          {team.championships}
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="f-orbitron text-[10px] text-zinc-400 border border-zinc-700/80 px-2 py-0.5 rounded-lg bg-black/40">
                  RANK #{idx + 1}
                </span>
                <span className="text-base">{COUNTRY_FLAGS[team.country] || "🏁"}</span>
                <span className="f-mono text-[11px] text-zinc-400 font-bold">{team.country}</span>
              </div>
              <h2 className="f-cond font-black text-3xl uppercase tracking-tight text-white transition-colors" style={{ color: hov ? col : "#fff" }}>
                {team.name}
              </h2>
              <p className="f-mono text-[11px] text-zinc-400 mt-1 font-semibold">
                EST. {team.foundedYear} · {team.base}
              </p>
            </div>
            <div className="text-right">
              <p className="f-orbitron font-black text-4xl tabular-nums leading-none" style={{ color: col }}>
                {titles}
              </p>
              <p className="f-mono text-[9px] text-zinc-500 tracking-widest mt-1 uppercase font-bold">WCC TITLES</p>
            </div>
          </div>

          {/* Power Unit Spec Pill */}
          <div className="mb-4 p-2 rounded-xl bg-black/40 border border-zinc-800 flex items-center justify-between text-[11px] f-mono">
            <span className="text-zinc-500">POWER UNIT</span>
            <span className="font-bold text-zinc-200">{engine}</span>
          </div>

          {/* Driver Lineup */}
          {td.length > 0 && (
            <div className="flex gap-2 mb-5">
              {td.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2.5 flex-1 rounded-2xl px-3 py-2.5 border transition-all bg-black/40"
                  style={{ borderColor: hov ? `${col}40` : "rgba(255,255,255,.08)" }}
                >
                  <span className="text-base flex-shrink-0">{NATIONALITY_FLAGS[d.nationality] || "🏁"}</span>
                  <div className="min-w-0">
                    <p className="f-cond font-bold text-sm text-white truncate uppercase">{d.name.split(" ").pop()}</p>
                    <p className="f-mono text-[10px] font-bold" style={{ color: col }}>#{d.carNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="h-px mb-4 bg-gradient-to-r from-zinc-700 to-transparent" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="f-mono text-[9px] text-zinc-500 tracking-widest mb-0.5">HEADQUARTERS</p>
              <p className="f-cond font-bold text-sm text-zinc-200 truncate">{team.base}</p>
            </div>
            <div>
              <p className="f-mono text-[9px] text-zinc-500 tracking-widest mb-0.5">COST CAP BUDGET</p>
              <p className="f-orbitron font-black text-sm tabular-nums" style={{ color: col }}>${budget}M</p>
            </div>
          </div>

          <div className="mt-4 h-1.5 rounded-full overflow-hidden bg-zinc-800">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: hov ? `${Math.min((team.annualBudgetM / 500) * 100, 100)}%` : "30%",
                background: col,
                boxShadow: `0 0 8px ${col}`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [drivers, setDrivers] = useState<DriverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/api/teams`).then((r) => r.json()),
      authFetch(`${API}/api/drivers`).then((r) => r.json()),
    ])
      .then(([t, d]) => {
        setTeams(t);
        setDrivers(d);
      })
      .catch(() => setError("Failed to load teams data"))
      .finally(() => setLoading(false));
  }, []);

  const totalTitles = teams.reduce((s, t) => s + (t.championships || 0), 0);

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-[3px] bg-red-600 rounded-full shadow-[0_0_8px_#E10600]" />
              <span className="f-mono text-xs text-red-500 font-bold tracking-widest uppercase">
                CONSTRUCTORS CHAMPIONSHIP
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black f-cond tracking-tight uppercase">
              2026 FORMULA 1 <span className="text-red-600">TEAMS</span>
            </h1>
          </div>

          <div className="flex items-center gap-4 bg-black/60 px-4 py-2 rounded-2xl border border-zinc-800 f-mono text-xs">
            <div>
              <span className="text-zinc-500">TOTAL TEAMS: </span>
              <span className="font-bold text-white">{teams.length}</span>
            </div>
            <div className="w-px h-4 bg-zinc-800" />
            <div>
              <span className="text-zinc-500">TOTAL TITLES: </span>
              <span className="font-bold text-amber-400">{totalTitles}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-950/40 border border-red-500/30 text-center">
            <p className="f-mono text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team, idx) => (
              <TeamCard key={team.id || team.name} team={team} drivers={drivers} idx={idx} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}