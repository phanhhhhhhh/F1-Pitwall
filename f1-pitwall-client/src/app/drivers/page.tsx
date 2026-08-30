"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import { fetchDriverProfiles } from "../lib/f1-data";
import { useSeason } from "../context/SeasonContext";
import Navbar from "../components/Navbar";
import { SkeletonCard } from "../components/LoadingSkeleton";
import { flagForNationality, getTeamColor, useCountUp } from "../lib/f1-theme";
import type { DriverCareer, DriverProfile } from "../types/f1";

const HologramHelmet3D = dynamic(() => import("../components/HologramHelmet3D"), { ssr: false });

function DriverCard({
  driver,
  profile,
  idx,
  onSelect,
}: {
  driver: DriverCareer;
  /** Ratings computed from this season's races. Absent until the ratings request lands. */
  profile?: DriverProfile;
  idx: number;
  onSelect: (d: DriverCareer) => void;
}) {
  const [hov, setHov] = useState(false);
  const col = getTeamColor(driver.team?.name, driver.team?.colorHex);
  const flag = flagForNationality(driver.nationality);
  const skill = profile?.skills;

  const wins = useCountUp(driver.careerWins, 800, idx * 30);
  const poles = useCountUp(driver.careerPoles, 800, idx * 30);
  const pts = useCountUp(Math.round(driver.careerPoints), 1000, idx * 30);

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
        style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 36px ${col}30` }}
      />
      <div
        className="relative border rounded-3xl overflow-hidden transition-all duration-300 bg-gradient-to-b from-zinc-900/90 to-black/95 p-5 shadow-xl"
        style={{
          borderColor: hov ? `${col}80` : "rgba(255,255,255,.08)",
          transform: hov ? "translateY(-5px)" : "none",
        }}
      >
        <div className="h-[3px] w-full absolute top-0 left-0 right-0" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <span
              className="f-orbitron font-black text-3xl tabular-nums leading-none"
              style={{ color: col, textShadow: `0 0 16px ${col}40` }}
            >
              #{driver.carNumber}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-zinc-800">
              <span className="text-sm leading-none">{flag}</span>
              <span className="f-mono text-[10px] text-zinc-400 font-bold uppercase">{driver.nationality}</span>
            </div>
          </div>

          <div className="mb-4">
            <h2
              className="f-cond font-black text-2xl uppercase tracking-tight text-white transition-colors"
              style={{ color: hov ? col : "#fff" }}
            >
              {driver.name}
            </h2>
            <p className="f-mono text-[11px] font-bold mt-1" style={{ color: col }}>
              {driver.team?.name || "Independent"}
            </p>
          </div>

          {/* Ratings derived from this season's races, not a hand-written table */}
          <div className="space-y-1 mb-4 p-2.5 rounded-2xl bg-black/50 border border-zinc-800/80">
            {skill ? (
              <>
                <div className="flex items-center justify-between text-[10px] f-mono text-zinc-400">
                  <span>PACE RATING</span>
                  <span className="font-bold text-white">{skill.pace}/100</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${skill.pace}%`, background: `linear-gradient(90deg, ${col}, #00E676)` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] f-mono text-zinc-500 pt-0.5">
                  <span>RACECRAFT: {skill.racecraft}</span>
                  <span>TYRE: {skill.tyreMgmt}</span>
                  <span>WET: {skill.wetSkill}</span>
                </div>
              </>
            ) : (
              <div className="text-[10px] f-mono text-zinc-600 py-2 text-center">RATING PENDING</div>
            )}
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

/**
 * The full rating card for one driver, with the season measurements each rating came from.
 * Ratings are only meaningful next to their evidence — a 92 for tyre management means nothing
 * until you can see it came from twelve stints against a known field median.
 */
function DriverRatingBreakdown({ profile, season }: { profile?: DriverProfile; season: number }) {
  if (!profile) {
    return (
      <div className="mb-5 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
        <p className="f-mono text-[11px] text-zinc-500">
          No {season} rating computed for this driver yet.
        </p>
      </div>
    );
  }

  const { skills, evidence } = profile;
  const bars = [
    { label: "PACE", value: skills.pace, confidence: evidence.confidence.pace, color: "#34d399" },
    { label: "RACECRAFT", value: skills.racecraft, confidence: evidence.confidence.racecraft, color: "#fbbf24" },
    { label: "TYRE MGMT", value: skills.tyreMgmt, confidence: evidence.confidence.tyreMgmt, color: "#fb923c" },
    { label: "WET", value: skills.wetSkill, confidence: evidence.confidence.wetSkill, color: "#38bdf8" },
    { label: "EXPERIENCE", value: skills.experience, confidence: evidence.confidence.experience, color: "#a78bfa" },
  ];

  const facts = [
    evidence.teammateName ? `vs ${evidence.teammateName}` : null,
    evidence.qualifyingH2HPct != null
      ? `Out-qualified teammate ${evidence.qualifyingH2HPct.toFixed(0)}% of ${evidence.qualifyingHeadToHeadSessions}`
      : null,
    evidence.teammateGapPct != null
      ? `Median quali gap ${evidence.teammateGapPct > 0 ? "+" : ""}${evidence.teammateGapPct.toFixed(3)}%`
      : null,
    evidence.avgPositionsGained != null
      ? `${evidence.avgPositionsGained > 0 ? "+" : ""}${evidence.avgPositionsGained.toFixed(1)} places per race from the grid`
      : null,
    evidence.finishRatePct != null
      ? `Finished ${evidence.racesClassified} of ${evidence.racesStarted} starts`
      : null,
    evidence.degradationSecPerLap != null && evidence.fieldDegradationSecPerLap != null
      ? `Tyre deg ${evidence.degradationSecPerLap.toFixed(3)} s/lap vs field ${evidence.fieldDegradationSecPerLap.toFixed(3)}`
      : null,
    evidence.wetRaces > 0 ? `${evidence.wetRaces} wet race${evidence.wetRaces > 1 ? "s" : ""} this season` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mb-5 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
      <div className="flex items-baseline justify-between mb-3">
        <span className="f-mono text-[10px] text-zinc-500 uppercase tracking-widest">
          {season} RATING
        </span>
        <span className="f-orbitron text-lg font-black text-white">{skills.overall}</span>
      </div>

      <div className="space-y-2 mb-3">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-[10px] f-mono text-zinc-400 mb-0.5">
              <span>{bar.label}</span>
              <span>
                <span className="font-bold" style={{ color: bar.color }}>
                  {bar.value}
                </span>
                <span className="text-zinc-600 ml-1.5 text-[9px]">{bar.confidence}% conf</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${bar.value}%`,
                  background: bar.color,
                  opacity: 0.35 + (bar.confidence / 100) * 0.65,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {facts.length > 0 && (
        <ul className="space-y-0.5 pt-2 border-t border-zinc-800">
          {facts.map((fact) => (
            <li key={fact} className="f-mono text-[10px] text-zinc-500">
              · {fact}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DriversPage() {
  const { season } = useSeason();
  const [drivers, setDrivers] = useState<DriverCareer[]>([]);
  const [profiles, setProfiles] = useState<DriverProfile[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverCareer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [sortBy, setSortBy] = useState<"number" | "wins" | "points" | "rating">("number");

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

  // Ratings are a separate, slower request: the driver grid renders straight away and the bars
  // fill in when the computation lands.
  useEffect(() => {
    let cancelled = false;
    fetchDriverProfiles(season)
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((e: unknown) => console.error("Driver ratings unavailable", e));
    return () => {
      cancelled = true;
    };
  }, [season]);

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.driverId, p])),
    [profiles]
  );

  const teams = ["ALL", ...Array.from(new Set(drivers.map((d) => d.team?.name).filter(Boolean)))];
  const filtered = drivers
    .filter((d) => {
      const ms =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.team?.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.nationality?.toLowerCase().includes(search.toLowerCase());
      return ms && (filterTeam === "ALL" || d.team?.name === filterTeam);
    })
    .sort((a, b) => {
      if (sortBy === "wins") return b.careerWins - a.careerWins;
      if (sortBy === "points") return b.careerPoints - a.careerPoints;
      if (sortBy === "rating") {
        // Unrated drivers sort last rather than to the top as a zero.
        const ra = profileById.get(a.id)?.skills.overall ?? -1;
        const rb = profileById.get(b.id)?.skills.overall ?? -1;
        return rb - ra;
      }
      return a.carNumber - b.carNumber;
    });

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

          <div className="flex items-center gap-3">
            <Link
              href="/drivers/compare"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black f-cond text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(225,6,0,0.4)] hover:shadow-[0_0_20px_rgba(225,6,0,0.7)] transition-all flex items-center gap-2"
            >
              <span>⚔️</span>
              <span>1V1 HEAD-TO-HEAD BATTLE</span>
            </Link>
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
              {(["number", "wins", "points", "rating"] as const).map((s) => (
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

        {/* ── 3D HOLOGRAPHIC DRIVER HELMET SHOWCASE ── */}
        <section className="mb-8">
          <HologramHelmet3D season={season} profiles={profiles} />
        </section>

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
                profile={profileById.get(driver.id)}
                idx={idx}
                onSelect={(d) => setSelectedDriver(d)}
              />
            ))}
          </div>
        )}

        {/* Modal Driver Detail */}
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
                className="w-full max-w-md bg-zinc-950 border border-zinc-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="f-mono text-xs text-red-500 font-bold">
                      {flagForNationality(selectedDriver.nationality)} {selectedDriver.nationality}
                    </span>
                    <h2 className="text-3xl font-black f-cond uppercase text-white mt-1">
                      {selectedDriver.name}
                    </h2>
                    <p className="f-mono text-xs text-zinc-400 mt-0.5">{selectedDriver.team?.name}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 my-5 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">CAREER WINS</span>
                    <p className="text-xl font-black f-orbitron text-amber-400">{selectedDriver.careerWins}</p>
                  </div>
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">CAREER POLES</span>
                    <p className="text-xl font-black f-orbitron text-white">{selectedDriver.careerPoles}</p>
                  </div>
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">TOTAL PTS</span>
                    <p className="text-xl font-black f-orbitron text-red-500">
                      {Math.round(selectedDriver.careerPoints)}
                    </p>
                  </div>
                </div>

                <DriverRatingBreakdown
                  profile={profileById.get(selectedDriver.id)}
                  season={season}
                />

                <button
                  onClick={() => setSelectedDriver(null)}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 font-black f-orbitron text-xs rounded-xl text-white transition-all uppercase tracking-wider"
                >
                  CLOSE DRIVER PROFILE
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}