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

function useCountUp(target: number, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf: number;
    const t = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 800, 1);
        setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return value;
}

function DriverCard({ driver, idx }: { driver: Driver; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const isChampion = driver.carNumber === 1;
  const color = driver.team?.colorHex || "#666";
  const flag = NATIONALITY_FLAGS[driver.nationality] || "🏁";
  const firstName = driver.name.split(" ")[0];
  const lastName = driver.name.split(" ").slice(1).join(" ");

  const wins = useCountUp(driver.careerWins, idx * 40);
  const poles = useCountUp(driver.careerPoles, idx * 40 + 100);
  const pts = useCountUp(driver.careerPoints, idx * 40 + 200);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-default card-enter"
      style={{ animationDelay: `${idx * 40}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Card border glow */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-500"
        style={{
          opacity: hovered ? 1 : 0,
          boxShadow: `0 0 30px ${color}30, inset 0 0 30px ${color}05`,
        }}
      />

      {/* Main card */}
      <div
        className={`relative h-full border rounded-2xl overflow-hidden transition-all duration-300 ${isChampion
            ? "border-yellow-500/40 bg-gradient-to-br from-yellow-950/20 via-zinc-900 to-zinc-900"
            : "border-zinc-800/60 bg-zinc-900/80"
          } ${hovered ? "border-opacity-80 -translate-y-1" : ""}`}
        style={{
          borderColor: hovered ? `${color}50` : undefined,
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
        }}
      >
        {/* Top color bar with glow */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-300"
          style={{
            backgroundColor: color,
            boxShadow: hovered ? `0 0 12px ${color}` : "none",
          }}
        />

        {/* Champion shimmer */}
        {isChampion && (
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />
        )}

        {/* Background car number */}
        <div
          className="absolute -bottom-2 -right-2 font-black select-none pointer-events-none transition-all duration-500"
          style={{
            fontSize: "7rem",
            lineHeight: 1,
            color: color,
            opacity: hovered ? 0.12 : 0.06,
            transform: hovered ? "scale(1.1) rotate(-5deg)" : "scale(1) rotate(0deg)",
          }}
        >
          {driver.carNumber}
        </div>

        <div className="relative z-10 p-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{flag}</span>
              <div
                className="text-xs font-mono px-2 py-0.5 rounded border"
                style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
              >
                #{driver.carNumber}
              </div>
            </div>
            {isChampion && (
              <div className="flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/30 rounded-lg px-2 py-1">
                <span className="text-xs">👑</span>
                <span className="text-xs text-yellow-400 font-black tracking-wider">CHAMP</span>
              </div>
            )}
          </div>

          {/* Driver name */}
          <div className="mb-4">
            <p className="text-xs text-zinc-500 font-medium leading-none mb-0.5">{firstName}</p>
            <h2
              className="text-2xl font-black leading-none transition-colors duration-200"
              style={{ color: hovered ? color : "white" }}
            >
              {lastName || firstName}
            </h2>
            <p
              className="text-xs font-bold tracking-widest mt-2 uppercase"
              style={{ color }}
            >
              {driver.team?.name}
            </p>
          </div>

          {/* Divider */}
          <div
            className="h-px mb-4 transition-all duration-300"
            style={{
              background: `linear-gradient(90deg, ${color}40, transparent)`,
              opacity: hovered ? 1 : 0.5,
            }}
          />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "WINS", value: wins, highlight: driver.careerWins > 10 },
              { label: "POLES", value: poles, highlight: false },
              { label: "PTS", value: pts, highlight: false },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="text-center">
                <p
                  className={`text-xl font-black tabular-nums transition-colors duration-200 ${highlight ? "text-yellow-400" : hovered ? "text-white" : "text-zinc-200"
                    }`}
                >
                  {value.toLocaleString()}
                </p>
                <p className="text-xs text-zinc-600 font-mono tracking-widest">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [sortBy, setSortBy] = useState<"number" | "wins" | "points">("number");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/drivers`)
      .then(r => r.json()).then(setDrivers)
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const teams = ["ALL", ...Array.from(new Set(drivers.map(d => d.team?.name).filter(Boolean)))];

  const filtered = drivers
    .filter(d => {
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.team?.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.nationality?.toLowerCase().includes(search.toLowerCase());
      const matchTeam = filterTeam === "ALL" || d.team?.name === filterTeam;
      return matchSearch && matchTeam;
    })
    .sort((a, b) => {
      if (sortBy === "wins") return b.careerWins - a.careerWins;
      if (sortBy === "points") return b.careerPoints - a.careerPoints;
      return a.carNumber - b.carNumber;
    });

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes cardEnter {
          from { transform: translateY(20px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .card-enter { animation: cardEnter 0.4s ease-out both; }
        @keyframes headerEnter {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .header-enter { animation: headerEnter 0.4s ease-out both; }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-red-500/3 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-red-900/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: "linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 header-enter">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">2026 SEASON · {drivers.length} DRIVERS</p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              DRIVER<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">ROSTER</span>
            </h1>
          </div>

          {/* Search + Sort */}
          <div className="flex flex-col gap-2 items-end">
            <div className="relative">
              <input
                type="text"
                placeholder="Search driver, team, nationality..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 w-72 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors text-xs">
                  ✕
                </button>
              )}
            </div>
            {/* Sort */}
            <div className="flex gap-1.5">
              {(["number", "wins", "points"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${sortBy === s
                      ? "border-red-500/50 text-red-400 bg-red-500/10"
                      : "border-zinc-700 text-zinc-600 hover:text-zinc-400"
                    }`}>
                  {s === "number" ? "#NO" : s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team filter */}
        <div className="flex gap-2 flex-wrap mb-8 header-enter" style={{ animationDelay: "100ms" }}>
          {teams.map(team => {
            const teamData = drivers.find(d => d.team?.name === team)?.team;
            const color = teamData?.colorHex;
            const isActive = filterTeam === team;
            return (
              <button
                key={team}
                onClick={() => setFilterTeam(team)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${isActive ? "" : "border-zinc-700/50 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                  }`}
                style={isActive && color ? {
                  borderColor: `${color}60`,
                  color: color,
                  backgroundColor: `${color}15`,
                  boxShadow: `0 0 10px ${color}20`,
                } : isActive ? {
                  borderColor: "#ef4444",
                  color: "white",
                  backgroundColor: "rgba(239,68,68,0.15)",
                } : {}}
              >
                {team === "ALL" ? "ALL DRIVERS" : team}
              </button>
            );
          })}
        </div>

        {/* Driver grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-52 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800/50"
                style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg mb-2">No drivers found</p>
            <p className="text-zinc-700 text-sm font-mono">Try adjusting your search or filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((driver, idx) => (
              <DriverCard key={driver.id} driver={driver} idx={idx} />
            ))}
          </div>
        )}

        {/* Footer count */}
        {!loading && (
          <p className="text-center text-zinc-700 text-xs font-mono mt-8">
            Showing {filtered.length} of {drivers.length} drivers
          </p>
        )}
      </main>
    </div>
  );
}