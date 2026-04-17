"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "./lib/pitwall-auth";
import Navbar from "./components/Navbar";
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

// 2026 race winners (3 completed races)
const RACE_WINNERS: Record<string, { driver: string; team: string }> = {
  "Australian Grand Prix": { driver: "G. Russell", team: "Mercedes" },
  "Chinese Grand Prix": { driver: "K. Antonelli", team: "Mercedes" },
  "Japanese Grand Prix": { driver: "K. Antonelli", team: "Mercedes" },
};

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState({ drivers: 0, teams: 0, races: 0, circuits: 0 });
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<any[]>([]);
  const [topDrivers, setTopDrivers] = useState<any[]>([]);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, []);

  // Countdown to Miami GP — May 3, 2026
  useEffect(() => {
    const target = new Date("2026-05-03T20:00:00Z");
    const update = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setCountdown("RACE DAY"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d}d ${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

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
      setStats({ drivers: drivers.length, teams: teams.length, races: racesData.length, circuits: circuits.length });
      setRaces(racesData.slice(0, 5));
      setTopDrivers(drivers.slice(0, 5));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const completed = races.filter(r => r.status === "COMPLETED").length;
  const cancelled = races.filter(r => r.status === "CANCELLED").length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
              Season 2026 · Command Center
            </p>
            <h1 className="text-5xl font-black tracking-tighter text-white">
              F1 PITWALL <span className="text-red-500">OVERVIEW</span>
            </h1>
          </div>
          {/* Next Race Banner */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-6 py-4 text-right">
            <p className="text-xs font-mono text-zinc-500 tracking-widest mb-1">NEXT RACE · ROUND 6</p>
            <p className="text-white font-black text-lg">🇺🇸 Miami Grand Prix</p>
            <p className="text-red-500 font-mono font-bold text-xl">{countdown}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "DRIVERS", value: stats.drivers, sub: "2026 Grid", href: "/drivers" },
            { label: "TEAMS", value: stats.teams, sub: "Constructors", href: "/teams" },
            { label: "RACES", value: stats.races, sub: `${completed} completed · ${cancelled} cancelled`, href: "/races" },
            { label: "CIRCUITS", value: stats.circuits, sub: "Worldwide", href: "/circuits" },
          ].map((s) => (
            <Link key={s.label} href={s.href}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-red-500/50 transition-all group">
              <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">{s.label}</p>
              <p className="text-5xl font-black text-white mb-1 group-hover:text-red-500 transition-colors">
                {loading ? "—" : s.value}
              </p>
              <p className="text-xs text-zinc-600">{s.sub}</p>
            </Link>
          ))}
        </div>

        {/* Season Progress */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-mono text-zinc-400 tracking-widest">2026 SEASON PROGRESS</p>
            <p className="text-xs text-zinc-500">{completed} / 22 active races completed</p>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(completed / 22) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-3">
            <span className="text-xs text-green-400">● {completed} Completed</span>
            <span className="text-xs text-red-400">● {cancelled} Cancelled</span>
            <span className="text-xs text-zinc-500">● {22 - completed - cancelled} Scheduled</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Race Calendar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold tracking-widest text-zinc-300">RACE CALENDAR</h2>
              <Link href="/races" className="text-xs text-red-500 hover:text-red-400 font-mono">VIEW ALL →</Link>
            </div>
            <div className="space-y-2">
              {loading ? <p className="text-zinc-600 font-mono text-sm">Loading...</p> : races.map((race) => {
                const winner = RACE_WINNERS[race.name];
                return (
                  <div key={race.id} className="flex items-center justify-between py-3 border-b border-zinc-800/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-6">
                        {COUNTRY_FLAGS[race.circuit?.country] || "🏁"}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-white">{race.name}</p>
                        {winner && (
                          <p className="text-xs text-zinc-500 mt-0.5">🏆 {winner.driver} · {winner.team}</p>
                        )}
                        {!winner && race.status === "CANCELLED" && (
                          <p className="text-xs text-red-400/70 mt-0.5">Cancelled — Middle East conflict</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border font-mono ${statusStyle[race.status]}`}>
                      {race.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drivers */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold tracking-widest text-zinc-300">DRIVER ROSTER</h2>
              <Link href="/drivers" className="text-xs text-red-500 hover:text-red-400 font-mono">VIEW ALL →</Link>
            </div>
            <div className="space-y-2">
              {loading ? <p className="text-zinc-600 font-mono text-sm">Loading...</p> : topDrivers.map((driver, i) => (
                <div key={driver.id} className="flex items-center gap-4 py-3 border-b border-zinc-800/50 last:border-0">
                  <span className="text-2xl font-black text-zinc-700 w-6 text-center">{i + 1}</span>
                  <div
                    className="w-0.5 h-8 rounded-full"
                    style={{ backgroundColor: driver.team?.colorHex || "#666" }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{driver.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: driver.team?.colorHex || "#666" }}>
                      {driver.team?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-zinc-300">#{driver.carNumber}</p>
                    <p className="text-xs text-zinc-600">{driver.careerWins}W · {driver.careerPoints}pts</p>
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
