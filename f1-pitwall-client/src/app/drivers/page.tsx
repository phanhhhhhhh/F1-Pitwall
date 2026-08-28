"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import Navbar from "../components/Navbar";
import { SkeletonCard } from "../components/LoadingSkeleton";
import { NATIONALITY_FLAGS, getDriverSkill, useCountUp } from "../lib/f1-theme";
import type { DriverCareer } from "../types/f1";

function DriverCard({
  driver,
  idx,
  onSelect,
}: {
  driver: DriverCareer;
  idx: number;
  onSelect: (driver: DriverCareer) => void;
}) {
  const [hov, setHov] = useState(false);
  const isChamp = driver.carNumber === 1;
  const col = driver.team?.colorHex || "#666";
  const flag = NATIONALITY_FLAGS[driver.nationality] || "🏁";
  const first = driver.name.split(" ")[0];
  const last = driver.name.split(" ").slice(1).join(" ");
  const wins = useCountUp(driver.careerWins, 900, idx * 40);
  const poles = useCountUp(driver.careerPoles, 900, idx * 40 + 100);
  const pts = useCountUp(driver.careerPoints, 900, idx * 40 + 200);

  const skill = getDriverSkill(driver.name);

  return (
    <div
      className="group relative rise cursor-pointer"
      style={{ animationDelay: `${idx * 40}ms` }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(driver)}
    >
      <div
        className="absolute inset-0 rounded-3xl transition-opacity duration-500 pointer-events-none"
        style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 36px ${col}35` }}
      />
      <div
        className="relative border rounded-3xl overflow-hidden transition-all duration-300 bg-gradient-to-b from-zinc-900/90 to-black/95 p-5 shadow-xl"
        style={{
          borderColor: hov ? `${col}80` : isChamp ? "rgba(255,210,63,.4)" : "rgba(255,255,255,.08)",
          transform: hov ? "translateY(-6px)" : "none",
        }}
      >
        {/* Team Color Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />

        {/* Huge Ghost Car Number */}
        <div
          className="absolute -bottom-4 -right-2 f-cond font-black select-none pointer-events-none transition-all duration-500 text-8xl"
          style={{
            lineHeight: 0.8,
            color: col,
            opacity: hov ? 0.16 : 0.06,
            transform: hov ? "scale(1.1) rotate(-4deg)" : "none",
          }}
        >
          {driver.carNumber}
        </div>

        <div className="relative z-10">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{flag}</span>
              <span
                className="f-orbitron text-xs font-black px-2.5 py-0.5 rounded-lg border shadow-sm"
                style={{ color: col, borderColor: `${col}50`, background: `${col}15` }}
              >
                #{driver.carNumber}
              </span>
            </div>
            {isChamp && (
              <span className="f-orbitron text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-0.5 font-black tracking-wider">
                👑 WORLD CHAMPION
              </span>
            )}
          </div>

          {/* Name & Team */}
          <div className="mb-4">
            <p className="f-mono text-[11px] text-zinc-400 leading-none mb-1 font-bold">{first}</p>
            <h2
              className="f-cond font-black text-3xl leading-none uppercase tracking-tight transition-colors"
              style={{ color: hov ? col : "#fff" }}
            >
              {last || first}
            </h2>
            <p className="f-mono text-[11px] font-bold tracking-wider mt-1.5 uppercase" style={{ color: col }}>
              {driver.team?.name}
            </p>
          </div>

          {/* ── Skill Radar Quick Bar ────────────────────────────────────────── */}
          <div className="mb-4 p-2.5 rounded-xl bg-black/50 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] f-mono">
              <span className="text-zinc-500">PACE RATING</span>
              <span className="font-bold text-white">{skill.pace} / 100</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${skill.pace}%`, background: `linear-gradient(90deg, ${col}, #00E676)` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] f-mono text-zinc-500 pt-0.5">
              <span>RACECRAFT: {skill.racecraft}</span>
              <span>TYRE: {skill.tyreMgmt}</span>
              <span>WET: {skill.wetSkill}</span>
            </div>
          </div>

          <div className="h-px mb-4 bg-gradient-to-r from-zinc-700 to-transparent" />

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "WINS", v: wins, hl: driver.careerWins > 10 },
              { l: "POLES", v: poles, hl: false },
              { l: "POINTS", v: pts, hl: false },
            ].map((s) => (
              <div key={s.l} className="text-center p-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <p className={`f-cond font-black text-xl tabular-nums ${s.hl ? "text-amber-400" : "text-white"}`}>
                  {s.v.toLocaleString()}
                </p>
                <p className="f-mono text-[8px] text-zinc-500 tracking-wider mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverCareer[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverCareer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [sortBy, setSortBy] = useState<"number" | "wins" | "points">("number");

  useEffect(() => {
    authFetch(`${API}/api/drivers`)
      .then((r) => r.json())
      .then(setDrivers)
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load drivers data.");
      })
      .finally(() => setLoading(false));
  }, []);

  const teams = ["ALL", ...Array.from(new Set(drivers.map((d) => d.team?.name).filter(Boolean)))];
  const filtered = drivers
    .filter((d) => {
      const ms =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.team?.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.nationality?.toLowerCase().includes(search.toLowerCase());
      return ms && (filterTeam === "ALL" || d.team?.name === filterTeam);
    })
    .sort((a, b) =>
      sortBy === "wins"
        ? b.careerWins - a.careerWins
        : sortBy === "points"
        ? b.careerPoints - a.careerPoints
        : a.carNumber - b.carNumber
    );

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-[3px] bg-red-600 rounded-full shadow-[0_0_8px_#E10600]" />
              <span className="f-mono text-xs text-red-500 font-bold tracking-widest uppercase">
                2026 DRIVER LINEUP
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black f-cond tracking-tight uppercase">
              WORLD CHAMPIONSHIP <span className="text-red-600">DRIVERS</span>
            </h1>
          </div>

          {/* Controls: Search, Team Filter, Sort */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search driver / team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/60 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-all flex-1 md:w-60"
            />

            {/* Team Filter */}
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              className="bg-black/60 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-cond font-bold text-zinc-300 focus:outline-none focus:border-red-500"
            >
              {teams.map((t) => (
                <option key={t || "ALL"} value={t || "ALL"}>
                  {t}
                </option>
              ))}
            </select>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800">
              {(["number", "wins", "points"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-3 py-1 text-xs font-bold f-cond uppercase rounded-lg transition-all ${
                    sortBy === s
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Drivers Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-950/40 border border-red-500/30 text-center">
            <p className="f-mono text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((driver, idx) => (
              <DriverCard
                key={driver.id || driver.carNumber}
                driver={driver}
                idx={idx}
                onSelect={(d) => setSelectedDriver(d)}
              />
            ))}
          </div>
        )}

        {/* Driver Detail Modal */}
        <AnimatePresence>
          {selectedDriver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDriver(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-zinc-950 border border-zinc-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ background: selectedDriver.team?.colorHex || "#E10600" }}
                />

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="f-mono text-xs text-zinc-400 font-bold">
                      {selectedDriver.team?.name} · #{selectedDriver.carNumber}
                    </span>
                    <h2 className="text-3xl font-black f-cond uppercase text-white mt-1">
                      {selectedDriver.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Radar Breakdown */}
                {(() => {
                  const skill = getDriverSkill(selectedDriver.name);
                  return (
                    <div className="space-y-3 my-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                      <div className="text-xs font-black f-orbitron text-zinc-300 tracking-wider uppercase mb-2">
                        TELEMETRY & DRIVER SKILL ANALYSIS
                      </div>
                      {[
                        { label: "QUALIFYING PACE", val: skill.pace, col: "#00E676" },
                        { label: "RACECRAFT & OVERTAKING", val: skill.racecraft, col: "#FFD200" },
                        { label: "TYRE PRESERVATION", val: skill.tyreMgmt, col: "#FF8000" },
                        { label: "WET WEATHER MASTERY", val: skill.wetSkill, col: "#00E5FF" },
                      ].map((bar) => (
                        <div key={bar.label}>
                          <div className="flex justify-between text-[11px] f-mono mb-1">
                            <span className="text-zinc-400">{bar.label}</span>
                            <span className="font-black" style={{ color: bar.col }}>
                              {bar.val} / 100
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${bar.val}%`, background: bar.col }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <button
                  onClick={() => setSelectedDriver(null)}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 font-black f-orbitron text-xs rounded-xl text-white transition-all uppercase tracking-wider"
                >
                  CLOSE DRIVER TELEMETRY
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}