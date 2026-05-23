"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "./lib/pitwall-auth";
import Navbar from "./components/Navbar";
import RaceWeekendWidget from "./components/RaceWeekendWidget";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const COUNTRY_FLAGS: Record<string, string> = {
  "Australia": "🇦🇺", "China": "🇨🇳", "Japan": "🇯🇵", "Bahrain": "🇧🇭",
  "Saudi Arabia": "🇸🇦", "United States": "🇺🇸", "Canada": "🇨🇦",
  "Monaco": "🇲🇨", "Spain": "🇪🇸", "Austria": "🇦🇹", "United Kingdom": "🇬🇧",
  "Belgium": "🇧🇪", "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹",
  "Azerbaijan": "🇦🇿", "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷",
  "UAE": "🇦🇪", "Qatar": "🇶🇦",
};

const statusStyle: Record<string, string> = {
  COMPLETED: "text-green-400 bg-green-500/10 border-green-500/30",
  CANCELLED: "text-red-400 bg-red-500/10 border-red-500/30",
  SCHEDULED: "text-zinc-400 bg-zinc-800/50 border-zinc-700",
  ONGOING: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};

interface NextRace {
  name: string;
  date: string;
  roundNumber: number;
  circuit?: { country: string };
}

function useCountUp(target: number, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let raf: number;
    const timeout = setTimeout(() => {
      let startTime: number | null = null;
      const step = (ts: number) => {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        setValue(Math.round(eased * target));
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}

function Particles() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className="absolute rounded-full" style={{
          width: Math.random() > 0.7 ? "3px" : "2px",
          height: Math.random() > 0.7 ? "3px" : "2px",
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          backgroundColor: Math.random() > 0.6 ? "#ef4444" : "#ffffff",
          opacity: Math.random() * 0.15 + 0.05,
          animation: `float ${6 + Math.random() * 10}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 5}s`,
        }} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`streak-${i}`} className="absolute h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" style={{
          width: `${100 + Math.random() * 200}px`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animation: `streak ${3 + Math.random() * 4}s linear infinite`,
          animationDelay: `${Math.random() * 4}s`,
        }} />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, href, delay }: {
  label: string; value: number; sub: string; href: string; delay: number;
}) {
  const count = useCountUp(value, 1200, delay);
  const icons: Record<string, string> = { DRIVERS: "🏎", TEAMS: "🏗", "GRAND PRIX": "🏁", CIRCUITS: "🗺" };

  return (
    <Link href={href}
      className="group relative bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 hover:border-red-500/30 transition-all duration-300 overflow-hidden card-enter"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-red-500/10 to-transparent" />
      </div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(239,68,68,0.05), transparent 60%)" }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-mono text-zinc-600 tracking-[0.2em] group-hover:text-zinc-400 transition-colors">{label}</p>
          <span className="text-xl opacity-30 group-hover:opacity-70 transition-opacity">{icons[label] || "📊"}</span>
        </div>
        <p className="text-6xl font-black text-white mb-2 group-hover:text-red-400 transition-colors duration-300 tabular-nums">{count}</p>
        <p className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">{sub}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState({ drivers: 0, teams: 0, races: 0, circuits: 0 });
  const [sprintCount, setSprintCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<any[]>([]);
  const [topDrivers, setTopDrivers] = useState<any[]>([]);
  const [raceWinners, setRaceWinners] = useState<Record<string, { driver: string; team: string }>>({});
  const [nextRace, setNextRace] = useState<NextRace | null>(null);
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0, isRaceDay: false });
  const [visible, setVisible] = useState(false);
  const [allRacesData, setAllRacesData] = useState<any[]>([]);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading) setTimeout(() => setVisible(true), 50);
  }, [loading]);

  useEffect(() => {
    if (!nextRace) return;
    const target = new Date(nextRace.date + "T00:00:00Z");
    const update = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setCountdown({ d: 0, h: 0, m: 0, s: 0, isRaceDay: true }); return; }
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        isRaceDay: false,
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRace]);

  const fetchData = async () => {
    try {
      const [driversRes, teamsRes, racesRes, circuitsRes] = await Promise.all([
        authFetch(`${API}/api/drivers`),
        authFetch(`${API}/api/teams`),
        authFetch(`${API}/api/races/season/2026`),
        authFetch(`${API}/api/circuits`),
      ]);
      const [drivers, teams, racesData, circuits] = await Promise.all([
        driversRes.json(), teamsRes.json(), racesRes.json(), circuitsRes.json(),
      ]);

      const grandPrixRaces = racesData.filter((r: any) => !r.name.toLowerCase().includes("sprint"));
      const sprintRaces = racesData.filter((r: any) => r.name.toLowerCase().includes("sprint"));

      setStats({ drivers: drivers.length, teams: teams.length, races: grandPrixRaces.length, circuits: circuits.length });
      setSprintCount(sprintRaces.length);
      setAllRacesData(racesData);
      setRaces(grandPrixRaces.slice(0, 6));
      setTopDrivers(drivers.slice(0, 5));

      const today = new Date().toISOString().split("T")[0];
      const upcoming = grandPrixRaces
        .filter((r: any) => r.status === "SCHEDULED" && r.date >= today)
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
      if (upcoming.length > 0) setNextRace(upcoming[0]);

      try {
        const winnersRes = await authFetch(`${API}/api/race-results/winners/2026`);
        const winnersData = await winnersRes.json();
        const winnerMap: Record<string, { driver: string; team: string }> = {};
        Object.entries(winnersData).forEach(([raceName, w]: [string, any]) => {
          winnerMap[raceName] = { driver: w.driverLastName || w.driverName, team: w.teamName };
        });
        setRaceWinners(winnerMap);
      } catch (e) { console.error("Failed to fetch winners", e); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const grandPrixRaces = allRacesData.filter(r => !r.name.toLowerCase().includes("sprint"));
  const totalGP = grandPrixRaces.length || 22;
  const gpCompleted = grandPrixRaces.filter(r => r.status === "COMPLETED").length;
  const gpCancelled = grandPrixRaces.filter(r => r.status === "CANCELLED").length;
  const sprintCompleted = allRacesData.filter(r => r.name.toLowerCase().includes("sprint") && r.status === "COMPLETED").length;
  const progressPct = (gpCompleted / totalGP) * 100;

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0px) translateX(0px)} 33%{transform:translateY(-20px) translateX(10px)} 66%{transform:translateY(10px) translateX(-10px)} }
        @keyframes streak { 0%{transform:translateX(-100%) scaleX(0);opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{transform:translateX(200vw) scaleX(1);opacity:0} }
        @keyframes cardEnter { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px rgba(239,68,68,0.1)} 50%{box-shadow:0 0 40px rgba(239,68,68,0.3)} }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(300%)} }
        .card-enter{animation:cardEnter 0.5s ease-out both}
        .pulse-glow{animation:pulse-glow 3s ease-in-out infinite}
        .animate-shimmer{animation:shimmer 2.5s ease-in-out infinite}
      `}</style>

      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-950 to-red-950/10" />
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/8 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "80px 80px" }} />
      </div>

      <Particles />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

        {/* Hero header */}
        <div className="mb-12 flex items-start justify-between flex-wrap gap-6">
          <div className="card-enter" style={{ animationDelay: "0ms" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-red-500/50 animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-red-500/20 animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
              <p className="text-red-500/60 font-mono text-xs tracking-[0.3em] uppercase">Season 2026 · Command Center</p>
            </div>
            <h1 className="text-6xl font-black tracking-tighter text-white leading-none">
              F1 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-orange-400">PITWALL</span>
              <br />
              <span className="text-zinc-500 text-4xl font-light tracking-wide">OVERVIEW</span>
            </h1>
          </div>

          {nextRace && (
            <div className="relative bg-zinc-900/80 backdrop-blur border border-zinc-700/50 rounded-2xl px-6 py-5 text-right pulse-glow card-enter overflow-hidden" style={{ animationDelay: "200ms" }}>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <p className="text-xs font-mono text-zinc-500 tracking-widest mb-1">NEXT RACE · ROUND {nextRace.roundNumber}</p>
              <p className="text-white font-black text-lg mb-3">{COUNTRY_FLAGS[nextRace.circuit?.country || ""] || "🏁"} {nextRace.name}</p>
              {countdown.isRaceDay ? (
                <p className="text-red-500 font-black text-2xl animate-pulse">RACE DAY 🏁</p>
              ) : (
                <div className="flex items-center gap-3 justify-end">
                  {[{ v: countdown.d, label: "D" }, { v: countdown.h, label: "H" }, { v: countdown.m, label: "M" }, { v: countdown.s, label: "S" }].map(({ v, label }) => (
                    <div key={label} className="text-center">
                      <div className="bg-zinc-800 border border-zinc-700 rounded-lg w-12 h-12 flex items-center justify-center mb-1">
                        <span className="text-xl font-black text-white tabular-nums">{String(v).padStart(2, "0")}</span>
                      </div>
                      <span className="text-zinc-600 text-xs font-mono">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-zinc-700 text-xs font-mono mt-2">{nextRace.date}</p>
            </div>
          )}
        </div>

        {/* Stat cards — RACES now shows Grand Prix only */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "DRIVERS", value: stats.drivers, sub: "2026 Grid", href: "/drivers" },
            { label: "TEAMS", value: stats.teams, sub: "Constructors", href: "/teams" },
            { label: "GRAND PRIX", value: stats.races, sub: `${gpCompleted} done · ${sprintCount} sprints`, href: "/races" },
            { label: "CIRCUITS", value: stats.circuits, sub: "Worldwide", href: "/circuits" },
          ].map((s, i) => (
            <StatCard key={s.label} {...s} delay={300 + i * 80} />
          ))}
        </div>

        {/* Season progress */}
        <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 mb-8 card-enter overflow-hidden relative" style={{ animationDelay: "600ms" }}>
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#ef4444 0,#ef4444 1px,transparent 1px,transparent 40px)" }} />
          <div className="relative flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-xs font-mono text-zinc-400 tracking-[0.2em]">2026 SEASON PROGRESS</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
              <span><span className="text-white font-bold">{gpCompleted}</span> / {totalGP} Grand Prix</span>
              {sprintCompleted > 0 && <span className="text-orange-400">⚡ {sprintCompleted}/{sprintCount} sprints</span>}
            </div>
          </div>
          <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#ef4444,#f97316)", boxShadow: "0 0 20px rgba(239,68,68,0.4)" }} />
            <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${progressPct}%` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
          <div className="relative h-1 mb-3">
            {Array.from({ length: totalGP }).map((_, i) => (
              <div key={i} className="absolute top-0 w-0.5 h-1 rounded-full"
                style={{ left: `${(i / totalGP) * 100}%`, backgroundColor: i < gpCompleted ? "#ef4444" : "#3f3f46" }} />
            ))}
          </div>
          <div className="flex gap-5 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-green-400"><div className="w-2 h-2 rounded-full bg-green-500" />{gpCompleted} GP Completed</span>
            <span className="flex items-center gap-1.5 text-xs text-orange-400"><div className="w-2 h-2 rounded-full bg-orange-500" />⚡ {sprintCompleted} Sprints Done</span>
            <span className="flex items-center gap-1.5 text-xs text-red-400"><div className="w-2 h-2 rounded-full bg-red-500" />{gpCancelled} Cancelled</span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500"><div className="w-2 h-2 rounded-full bg-zinc-600" />{totalGP - gpCompleted - gpCancelled} Scheduled</span>
          </div>
        </div>

        {/* 3-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 card-enter" style={{ animationDelay: "700ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-red-500 rounded-full" />
                <h2 className="text-xs font-bold tracking-widest text-zinc-300">RACE CALENDAR</h2>
              </div>
              <Link href="/races" className="text-xs text-red-500 hover:text-red-400 font-mono transition-colors group">
                VIEW ALL <span className="group-hover:translate-x-1 inline-block transition-transform">→</span>
              </Link>
            </div>
            <div className="space-y-1">
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-zinc-800/50 rounded-lg animate-pulse" />)}</div>
              ) : races.map((race, idx) => {
                const winner = raceWinners[race.name];
                const isCancelled = race.status === "CANCELLED";
                return (
                  <div key={race.id} className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 hover:bg-zinc-800/40 group ${isCancelled ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base flex-shrink-0">{COUNTRY_FLAGS[race.circuit?.country] || "🏁"}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate group-hover:text-red-300 transition-colors">{race.name}</p>
                        {winner && <p className="text-xs text-zinc-600 mt-0.5 truncate">🏆 <span className="text-zinc-400">{winner.driver}</span></p>}
                        {isCancelled && <p className="text-xs text-red-400/60 mt-0.5">Cancelled</p>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-mono flex-shrink-0 ml-2 ${statusStyle[race.status]}`}>
                      {race.status === "COMPLETED" ? "✓ C" : race.status === "CANCELLED" ? "✗ C" : "S"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-enter" style={{ animationDelay: "800ms" }}><RaceWeekendWidget /></div>

          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 card-enter" style={{ animationDelay: "900ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-red-500 rounded-full" />
                <h2 className="text-xs font-bold tracking-widest text-zinc-300">DRIVER ROSTER</h2>
              </div>
              <Link href="/drivers" className="text-xs text-red-500 hover:text-red-400 font-mono transition-colors group">
                VIEW ALL <span className="group-hover:translate-x-1 inline-block transition-transform">→</span>
              </Link>
            </div>
            <div className="space-y-1">
              {loading ? (
                <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 bg-zinc-800/50 rounded-lg animate-pulse" />)}</div>
              ) : topDrivers.map((driver, i) => (
                <div key={driver.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-zinc-800/40 transition-all duration-200 group">
                  <span className="text-2xl font-black text-zinc-700 w-5 text-center group-hover:text-zinc-500 transition-colors tabular-nums">{i + 1}</span>
                  <div className="w-0.5 h-10 rounded-full flex-shrink-0 transition-all duration-300 group-hover:h-12"
                    style={{ backgroundColor: driver.team?.colorHex || "#666", boxShadow: `0 0 4px ${driver.team?.colorHex || "#666"}60` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate group-hover:text-red-300 transition-colors">{driver.name}</p>
                    <p className="text-xs mt-0.5 truncate font-medium" style={{ color: driver.team?.colorHex || "#666" }}>{driver.team?.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono text-zinc-400">#{driver.carNumber}</p>
                    <p className="text-xs text-zinc-600">{driver.careerWins}W</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}