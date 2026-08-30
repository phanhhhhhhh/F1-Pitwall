"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../../components/Navbar";
import DriverRadarChart from "../../components/DriverRadarChart";
import { authFetch } from "../../lib/pitwall-auth";
import { BASE_URL as API } from "../../lib/api-client";
import { fetchDriverProfiles } from "../../lib/f1-data";
import { useSeason } from "../../context/SeasonContext";
import { getTeamColor, flagForNationality, useCountUp } from "../../lib/f1-theme";
import type { DriverCareer, DriverProfile, DriverStanding } from "../../types/f1";

function StatDeltaBar({
  label,
  val1,
  val2,
  suffix = "",
  color1,
  color2,
  inverted = false, // If true, lower is better (e.g. Average Position)
}: {
  label: string;
  val1: number;
  val2: number;
  suffix?: string;
  color1: string;
  color2: string;
  inverted?: boolean;
}) {
  const sum = (val1 || 0) + (val2 || 0);
  const pct1 = sum > 0 ? (val1 / sum) * 100 : 50;
  const isBetter1 = inverted ? val1 < val2 : val1 > val2;
  const isBetter2 = inverted ? val2 < val1 : val2 > val1;
  const isEqual = val1 === val2;

  return (
    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all">
      <div className="flex items-center justify-between text-xs f-mono font-bold mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-black ${
              isBetter1 ? "text-emerald-400 bg-emerald-950/60" : "text-zinc-400"
            }`}
          >
            {val1}
            {suffix}
          </span>
          {isBetter1 && <span className="text-[10px] text-emerald-500">👑 ADVANTAGE</span>}
        </div>
        <span className="text-zinc-400 uppercase tracking-wider text-[11px]">{label}</span>
        <div className="flex items-center gap-1.5">
          {isBetter2 && <span className="text-[10px] text-emerald-500">ADVANTAGE 👑</span>}
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-black ${
              isBetter2 ? "text-emerald-400 bg-emerald-950/60" : "text-zinc-400"
            }`}
          >
            {val2}
            {suffix}
          </span>
        </div>
      </div>

      {/* Progress split bar */}
      <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-zinc-800">
        <motion.div
          className="h-full rounded-l-full"
          style={{ backgroundColor: color1, boxShadow: `0 0 8px ${color1}80` }}
          initial={{ width: "50%" }}
          animate={{ width: `${Math.max(5, Math.min(95, pct1))}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <motion.div
          className="h-full rounded-r-full"
          style={{ backgroundColor: color2, boxShadow: `0 0 8px ${color2}80` }}
          initial={{ width: "50%" }}
          animate={{ width: `${Math.max(5, Math.min(95, 100 - pct1))}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { season } = useSeason();

  const [drivers, setDrivers] = useState<DriverCareer[]>([]);
  const [profiles, setProfiles] = useState<DriverProfile[]>([]);
  const [standings, setStandings] = useState<DriverStanding[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected driver IDs
  const [d1Id, setD1Id] = useState<number | null>(null);
  const [d2Id, setD2Id] = useState<number | null>(null);

  // Fetch all driver data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [driversRes, standingsRes, profilesData] = await Promise.all([
          authFetch(`${API}/api/drivers`),
          authFetch(`${API}/api/race-results/standings/drivers/${season}`),
          fetchDriverProfiles(season).catch(() => [] as DriverProfile[]),
        ]);

        if (cancelled) return;
        const dList: DriverCareer[] = await driversRes.json();
        const sList: DriverStanding[] = await standingsRes.json();

        setDrivers(dList);
        setStandings(sList);
        setProfiles(profilesData);

        // Initial selection from query params or top 2 standings
        const q1 = searchParams.get("d1");
        const q2 = searchParams.get("d2");

        const firstId = q1 ? parseInt(q1) : dList[0]?.id ?? 1;
        const secondId = q2 ? parseInt(q2) : dList[1]?.id ?? (dList[0]?.id ? dList[0].id + 1 : 2);

        setD1Id(firstId);
        setD2Id(secondId);
      } catch (err) {
        console.error("Failed to load compare data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [season, searchParams]);

  // Sync state to URL when changed
  const updateDrivers = (id1: number, id2: number) => {
    setD1Id(id1);
    setD2Id(id2);
    router.replace(`/drivers/compare?d1=${id1}&d2=${id2}`);
  };

  const driver1 = useMemo(() => drivers.find((d) => d.id === d1Id) ?? drivers[0], [drivers, d1Id]);
  const driver2 = useMemo(() => drivers.find((d) => d.id === d2Id) ?? drivers[1] ?? drivers[0], [drivers, d2Id]);

  const profile1 = useMemo(() => profiles.find((p) => p.driverId === driver1?.id), [profiles, driver1]);
  const profile2 = useMemo(() => profiles.find((p) => p.driverId === driver2?.id), [profiles, driver2]);

  const standing1 = useMemo(() => standings.find((s) => s.driverId === driver1?.id), [standings, driver1]);
  const standing2 = useMemo(() => standings.find((s) => s.driverId === driver2?.id), [standings, driver2]);

  const color1 = getTeamColor(driver1?.team?.name, driver1?.team?.colorHex);
  const color2 = getTeamColor(driver2?.team?.name, driver2?.team?.colorHex);

  // Group drivers by team for teammate battle presets
  const teamPairs = useMemo(() => {
    const map = new Map<string, DriverCareer[]>();
    drivers.forEach((d) => {
      const tName = d.team?.name || "Other";
      if (!map.has(tName)) map.set(tName, []);
      map.get(tName)!.push(d);
    });
    return Array.from(map.entries()).filter(([, list]) => list.length >= 2);
  }, [drivers]);

  // Derived head to head stats
  const ev1 = profile1?.evidence;
  const ev2 = profile2?.evidence;

  const isTeammates = driver1?.team?.name === driver2?.team?.name && driver1?.team?.name !== undefined;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon pb-16">
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-[3px] bg-red-600 rounded-full shadow-[0_0_8px_#E10600]" />
              <span className="f-mono text-xs text-red-500 font-bold tracking-widest uppercase">
                {season} TELEMETRY & CAREER COMPARISON
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black f-cond tracking-tight uppercase">
              DRIVER <span className="text-red-600">HEAD-TO-HEAD</span> BATTLE
            </h1>
            <p className="f-mono text-xs text-zinc-400 mt-2">
              Compare ratings, qualifying pace, racecraft, tyre management, and career records side by side.
            </p>
          </div>

          <Link
            href="/drivers"
            className="f-mono text-xs text-zinc-400 hover:text-white border border-zinc-700/80 bg-black/40 px-4 py-2.5 rounded-xl transition-all font-bold flex items-center gap-2"
          >
            ← BACK TO DRIVERS
          </Link>
        </div>

        {/* Quick Teammate Preset Chips */}
        {teamPairs.length > 0 && (
          <div className="mb-8 p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              <span className="f-mono text-[11px] text-zinc-500 font-bold px-2 uppercase">
                ⚡ TEAMMATE BATTLES:
              </span>
              {teamPairs.map(([teamName, pair]) => {
                const tColor = getTeamColor(teamName, pair[0]?.team?.colorHex);
                const isCurrent =
                  (d1Id === pair[0].id && d2Id === pair[1].id) ||
                  (d1Id === pair[1].id && d2Id === pair[0].id);

                return (
                  <button
                    key={teamName}
                    onClick={() => updateDrivers(pair[0].id, pair[1].id)}
                    className={`px-3 py-1.5 rounded-xl f-cond text-xs font-bold uppercase transition-all flex items-center gap-1.5 border ${
                      isCurrent
                        ? "bg-white/10 text-white border-zinc-500 shadow-md"
                        : "bg-black/40 text-zinc-400 border-zinc-800/80 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tColor }} />
                    {teamName}: {pair[0].name.split(" ").pop()} vs {pair[1].name.split(" ").pop()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Driver Selection & Hero Header Cards */}
        {driver1 && driver2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Driver 1 Card */}
            <div
              className="relative p-6 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-black/95 border transition-all duration-300 shadow-2xl overflow-hidden"
              style={{ borderColor: `${color1}60` }}
            >
              <div
                className="h-1.5 w-full absolute top-0 left-0 right-0"
                style={{ backgroundColor: color1, boxShadow: `0 0 16px ${color1}` }}
              />

              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{flagForNationality(driver1.nationality)}</span>
                    <span className="f-mono text-xs font-bold uppercase text-zinc-400">
                      {driver1.nationality} · #{driver1.carNumber}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black f-cond uppercase text-white tracking-tight">
                    {driver1.name}
                  </h2>
                  <p className="f-mono text-xs font-bold mt-0.5" style={{ color: color1 }}>
                    {driver1.team?.name || "Independent"}
                  </p>
                </div>

                {/* Driver 1 Dropdown Selector */}
                <select
                  value={driver1.id}
                  onChange={(e) => updateDrivers(parseInt(e.target.value), driver2.id)}
                  className="bg-black/80 border border-zinc-700 rounded-xl px-3 py-2 text-xs f-mono font-bold text-white outline-none cursor-pointer hover:border-zinc-500 transition-colors"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.carNumber} {d.name} ({d.team?.name || "IND"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Season Rank & Score */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/50 border border-zinc-800">
                <div className="text-center">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold uppercase">CHAMPIONSHIP</span>
                  <p className="text-lg f-cond font-black text-white">
                    P{standing1?.position ?? "—"}
                  </p>
                </div>
                <div className="text-center border-x border-zinc-800">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold uppercase">SEASON PTS</span>
                  <p className="text-lg f-cond font-black text-amber-400">
                    {standing1 ? Math.round(standing1.totalPoints) : 0}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold uppercase">OVERALL RATING</span>
                  <p className="text-lg f-cond font-black" style={{ color: color1 }}>
                    {profile1?.skills?.overall ?? 80}/100
                  </p>
                </div>
              </div>
            </div>

            {/* Driver 2 Card */}
            <div
              className="relative p-6 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-black/95 border transition-all duration-300 shadow-2xl overflow-hidden"
              style={{ borderColor: `${color2}60` }}
            >
              <div
                className="h-1.5 w-full absolute top-0 left-0 right-0"
                style={{ backgroundColor: color2, boxShadow: `0 0 16px ${color2}` }}
              />

              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{flagForNationality(driver2.nationality)}</span>
                    <span className="f-mono text-xs font-bold uppercase text-zinc-400">
                      {driver2.nationality} · #{driver2.carNumber}
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black f-cond uppercase text-white tracking-tight">
                    {driver2.name}
                  </h2>
                  <p className="f-mono text-xs font-bold mt-0.5" style={{ color: color2 }}>
                    {driver2.team?.name || "Independent"}
                  </p>
                </div>

                {/* Driver 2 Dropdown Selector */}
                <select
                  value={driver2.id}
                  onChange={(e) => updateDrivers(driver1.id, parseInt(e.target.value))}
                  className="bg-black/80 border border-zinc-700 rounded-xl px-3 py-2 text-xs f-mono font-bold text-white outline-none cursor-pointer hover:border-zinc-500 transition-colors"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.carNumber} {d.name} ({d.team?.name || "IND"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Season Rank & Score */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/50 border border-zinc-800">
                <div className="text-center">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold uppercase">CHAMPIONSHIP</span>
                  <p className="text-lg f-cond font-black text-white">
                    P{standing2?.position ?? "—"}
                  </p>
                </div>
                <div className="text-center border-x border-zinc-800">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold uppercase">SEASON PTS</span>
                  <p className="text-lg f-cond font-black text-amber-400">
                    {standing2 ? Math.round(standing2.totalPoints) : 0}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-[10px] f-mono text-zinc-500 font-bold uppercase">OVERALL RATING</span>
                  <p className="text-lg f-cond font-black" style={{ color: color2 }}>
                    {profile2?.skills?.overall ?? 80}/100
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Radar Chart & Head-to-Head Comparison Grid */}
        {driver1 && driver2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
            {/* Left: 5-Axis Spider Radar Chart (5 cols) */}
            <div className="lg:col-span-5 flex flex-col">
              <DriverRadarChart
                driver1={{
                  name: driver1.name,
                  teamColor: color1,
                  skills: profile1?.skills,
                }}
                driver2={{
                  name: driver2.name,
                  teamColor: color2,
                  skills: profile2?.skills,
                }}
                size={380}
              />
            </div>

            {/* Right: Detailed Metric Delta Split Bars (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Teammate Specific Insights if in same team */}
              {isTeammates && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-black/60 to-zinc-900/40 border border-red-800/60 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="f-mono text-xs text-red-400 font-bold tracking-wider uppercase">
                      INTRA-TEAM BATTLE BREAKDOWN
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs f-mono">
                    <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px]">QUALIFYING HEAD-TO-HEAD</span>
                      <span className="font-black text-white text-sm">
                        {ev1?.qualifyingH2HPct != null ? `${ev1.qualifyingH2HPct}%` : "50%"} vs{" "}
                        {ev2?.qualifyingH2HPct != null ? `${ev2.qualifyingH2HPct}%` : "50%"}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/50 border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px]">RACE FINISH HEAD-TO-HEAD</span>
                      <span className="font-black text-white text-sm">
                        {ev1?.raceH2HPct != null ? `${ev1.raceH2HPct}%` : "50%"} vs{" "}
                        {ev2?.raceH2HPct != null ? `${ev2.raceH2HPct}%` : "50%"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Season Performance Metrics */}
              <h3 className="f-cond font-bold text-lg uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <span className="w-2 h-4 bg-red-600 rounded-sm" />
                SEASON {season} RACE METRICS
              </h3>

              <div className="space-y-2.5">
                <StatDeltaBar
                  label="SEASON POINTS"
                  val1={standing1?.totalPoints ?? 0}
                  val2={standing2?.totalPoints ?? 0}
                  color1={color1}
                  color2={color2}
                />
                <StatDeltaBar
                  label="SEASON RACE WINS"
                  val1={standing1?.wins ?? 0}
                  val2={standing2?.wins ?? 0}
                  color1={color1}
                  color2={color2}
                />
                <StatDeltaBar
                  label="SEASON PODIUMS"
                  val1={standing1?.podiums ?? 0}
                  val2={standing2?.podiums ?? 0}
                  color1={color1}
                  color2={color2}
                />
                <StatDeltaBar
                  label="FASTEST LAPS"
                  val1={standing1?.fastestLaps ?? 0}
                  val2={standing2?.fastestLaps ?? 0}
                  color1={color1}
                  color2={color2}
                />
                <StatDeltaBar
                  label="AVG QUALIFYING POSITION"
                  val1={ev1?.avgQualifyingPosition ? Number(ev1.avgQualifyingPosition.toFixed(1)) : 8}
                  val2={ev2?.avgQualifyingPosition ? Number(ev2.avgQualifyingPosition.toFixed(1)) : 8}
                  color1={color1}
                  color2={color2}
                  inverted={true}
                />
                <StatDeltaBar
                  label="AVG RACE FINISH"
                  val1={ev1?.avgFinishPosition ? Number(ev1.avgFinishPosition.toFixed(1)) : 8}
                  val2={ev2?.avgFinishPosition ? Number(ev2.avgFinishPosition.toFixed(1)) : 8}
                  color1={color1}
                  color2={color2}
                  inverted={true}
                />
              </div>

              {/* Career Metrics */}
              <h3 className="f-cond font-bold text-lg uppercase tracking-wider text-zinc-300 flex items-center gap-2 pt-4">
                <span className="w-2 h-4 bg-zinc-500 rounded-sm" />
                CAREER STATISTICAL RECORDS
              </h3>

              <div className="space-y-2.5">
                <StatDeltaBar
                  label="CAREER WINS"
                  val1={driver1.careerWins}
                  val2={driver2.careerWins}
                  color1={color1}
                  color2={color2}
                />
                <StatDeltaBar
                  label="CAREER POLE POSITIONS"
                  val1={driver1.careerPoles}
                  val2={driver2.careerPoles}
                  color1={color1}
                  color2={color2}
                />
                <StatDeltaBar
                  label="TOTAL CAREER POINTS"
                  val1={Math.round(driver1.careerPoints)}
                  val2={Math.round(driver2.careerPoints)}
                  color1={color1}
                  color2={color2}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CompareDriversPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-carbon text-white flex items-center justify-center">Loading comparison...</div>}>
      <CompareContent />
    </Suspense>
  );
}
