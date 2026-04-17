"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const NATIONALITY_FLAGS: Record<string, string> = {
  "British": "🇬🇧", "Australian": "🇦🇺", "Dutch": "🇳🇱", "French": "🇫🇷",
  "German": "🇩🇪", "Spanish": "🇪🇸", "Finnish": "🇫🇮", "Canadian": "🇨🇦",
  "Mexican": "🇲🇽", "Brazilian": "🇧🇷", "Italian": "🇮🇹", "Monegasque": "🇲🇨",
  "Thai": "🇹🇭", "New Zealander": "🇳🇿", "Argentine": "🇦🇷", "New Zealand": "🇳🇿",
};

interface Driver {
  id: number;
  name: string;
  carNumber: number;
  nationality: string;
  careerPoints: number;
  careerWins: number;
  careerPoles: number;
  team: { id: number; name: string; colorHex: string };
}

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("ALL");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/drivers`)
      .then(r => r.json()).then(setDrivers)
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const teams = ["ALL", ...Array.from(new Set(drivers.map(d => d.team?.name).filter(Boolean)))];

  const filtered = drivers.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.team?.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.nationality?.toLowerCase().includes(search.toLowerCase());
    const matchTeam = filterTeam === "ALL" || d.team?.name === filterTeam;
    return matchSearch && matchTeam;
  });

  const isChampion = (d: Driver) => d.carNumber === 1;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">

        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
              2026 Season · {drivers.length} Drivers
            </p>  
            <h1 className="text-4xl font-black tracking-tighter text-white">
              DRIVER <span className="text-red-500">ROSTER</span>
            </h1>
          </div>
          <input
            type="text"
            placeholder="Search driver, team, nationality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 w-72"
          />
        </div>

        {}
        <div className="flex gap-2 flex-wrap mb-8">
          {teams.map(team => {
            const teamData = drivers.find(d => d.team?.name === team)?.team;
            return (
              <button
                key={team}
                onClick={() => setFilterTeam(team)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  filterTeam === team
                    ? "border-red-500 text-white bg-red-500/20"
                    : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                }`}
                style={filterTeam === team && teamData ? { borderColor: teamData.colorHex, color: teamData.colorHex, backgroundColor: teamData.colorHex + "20" } : {}}
              >
                {team}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            LOADING TELEMETRY...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((driver) => (
              <div
                key={driver.id}
                className={`group relative bg-zinc-900 rounded-xl p-5 overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                  isChampion(driver)
                    ? "border-2 border-yellow-500/50 hover:border-yellow-400/80 shadow-lg shadow-yellow-500/10"
                    : "border border-zinc-800 hover:border-zinc-600"
                }`}
              >
                {}
                {isChampion(driver) && (
                  <div className="absolute top-3 right-3 bg-yellow-500/20 border border-yellow-500/40 rounded px-2 py-0.5 text-xs text-yellow-400 font-mono z-10">
                    👑 CHAMPION
                  </div>
                )}

                {}
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: driver.team?.colorHex || "#444" }} />

                {}
                <div className="absolute -bottom-3 -right-1 text-7xl font-black text-zinc-800/30 pointer-events-none select-none">
                  {driver.carNumber}
                </div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl font-black text-zinc-600">#{driver.carNumber}</span>
                  </div>

                  <h2 className="text-sm font-bold text-white mb-1 leading-tight">{driver.name}</h2>
                  <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: driver.team?.colorHex || "#666" }}>
                    {driver.team?.name}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800">
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{driver.careerWins}</p>
                      <p className="text-xs text-zinc-600">WINS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{driver.careerPoles}</p>
                      <p className="text-xs text-zinc-600">POLES</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-white">{driver.careerPoints}</p>
                      <p className="text-xs text-zinc-600">PTS</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
