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
  "Thai": "🇹🇭", "New Zealander": "🇳🇿", "Argentine": "🇦🇷",
};

const COUNTRY_FLAGS: Record<string, string> = {
  "United Kingdom": "🇬🇧", "Italy": "🇮🇹", "Austria": "🇦🇹", "Germany": "🇩🇪",
  "France": "🇫🇷", "United States": "🇺🇸", "Switzerland": "🇨🇭",
};

interface Driver { id: number; name: string; carNumber: number; nationality: string; }
interface Team {
  id: number; name: string; country: string; colorHex: string;
  championships: number; annualBudgetM: number; base: string; foundedYear: number;
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
        const p = Math.min((ts - start) / 1000, 1);
        setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return value;
}

function TeamCard({ team, drivers, idx }: { team: Team; drivers: Driver[]; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const color = team.colorHex || "#666";
  const teamDrivers = drivers.filter((d: any) => d.team?.name === team.name);
  const titles = useCountUp(team.championships, idx * 80);
  const budget = useCountUp(team.annualBudgetM, idx * 80 + 150);

  return (
    <div
      className="group relative card-enter"
      style={{ animationDelay: `${idx * 60}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none"
        style={{ opacity: hovered ? 1 : 0, boxShadow: `0 0 40px ${color}20` }}
      />

      <div
        className="relative bg-zinc-900/80 backdrop-blur border rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          borderColor: hovered ? `${color}40` : "rgba(39,39,42,0.6)",
          transform: hovered ? "translateY(-3px)" : "translateY(0)",
        }}
      >
        {/* Top color bar */}
        <div
          className="h-1 w-full transition-all duration-300"
          style={{
            backgroundColor: color,
            boxShadow: hovered ? `0 0 16px ${color}` : "none",
          }}
        />

        {/* Background watermark */}
        <div
          className="absolute right-4 top-4 font-black select-none pointer-events-none transition-all duration-500"
          style={{
            fontSize: "6rem",
            lineHeight: 1,
            color,
            opacity: hovered ? 0.06 : 0.03,
            transform: hovered ? "scale(1.1)" : "scale(1)",
          }}
        >
          {team.championships}
        </div>

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-zinc-600 border border-zinc-700 px-2 py-0.5 rounded">
                  #{idx + 1}
                </span>
                <span className="text-base">{COUNTRY_FLAGS[team.country] || "🏴"}</span>
                <span className="text-xs text-zinc-600 font-mono">{team.country}</span>
              </div>
              <h2
                className="text-2xl font-black transition-colors duration-200"
                style={{ color: hovered ? color : "white" }}
              >
                {team.name}
              </h2>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                Est. {team.foundedYear} · {team.base}
              </p>
            </div>

            {/* Championships */}
            <div className="text-right">
              <p
                className="text-5xl font-black tabular-nums leading-none"
                style={{ color, textShadow: hovered ? `0 0 20px ${color}60` : "none" }}
              >
                {titles}
              </p>
              <p className="text-xs text-zinc-600 font-mono tracking-widest mt-1">TITLES</p>
            </div>
          </div>

          {/* Drivers */}
          {teamDrivers.length > 0 && (
            <div className="flex gap-2 mb-5">
              {teamDrivers.map((d: any) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2.5 flex-1 rounded-xl px-3 py-2.5 border transition-all duration-200"
                  style={{
                    backgroundColor: hovered ? `${color}08` : "rgba(39,39,42,0.5)",
                    borderColor: hovered ? `${color}30` : "rgba(63,63,70,0.5)",
                  }}
                >
                  <span className="text-base flex-shrink-0">{NATIONALITY_FLAGS[d.nationality] || "🏴"}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate">{d.name.split(" ").pop()}</p>
                    <p className="text-xs font-mono" style={{ color }}>#{d.carNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          <div
            className="h-px mb-4 transition-all duration-300"
            style={{
              background: `linear-gradient(90deg, ${color}40, transparent)`,
              opacity: hovered ? 1 : 0.4,
            }}
          />

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-600 font-mono tracking-widest mb-1">BASE</p>
              <p className="text-sm text-zinc-200 font-bold">{team.base}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-600 font-mono tracking-widest mb-1">BUDGET</p>
              <p
                className="text-sm font-black tabular-nums"
                style={{ color }}
              >
                ${budget}M
              </p>
            </div>
          </div>

          {/* Budget bar */}
          <div className="mt-4">
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: hovered ? `${Math.min((team.annualBudgetM / 500) * 100, 100)}%` : "0%",
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    Promise.all([
      authFetch(`${API}/api/teams`).then(r => r.json()),
      authFetch(`${API}/api/drivers`).then(r => r.json()),
    ]).then(([t, d]) => { setTeams(t); setDrivers(d); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalBudget = teams.reduce((sum, t) => sum + (t.annualBudgetM || 0), 0);
  const totalTitles = teams.reduce((sum, t) => sum + (t.championships || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes cardEnter {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .card-enter { animation: cardEnter 0.45s ease-out both; }
        @keyframes headerEnter {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .header-enter { animation: headerEnter 0.4s ease-out both; }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 left-1/3 w-[500px] h-[400px] bg-red-500/4 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-red-900/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: "linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4 header-enter">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">2026 SEASON · {teams.length} CONSTRUCTORS</p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              CONSTRUCTOR<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">STANDINGS</span>
            </h1>
          </div>

          {/* Season totals */}
          {!loading && (
            <div className="flex gap-4 header-enter" style={{ animationDelay: "200ms" }}>
              {[
                { label: "TOTAL TITLES", value: totalTitles, suffix: "" },
                { label: "COMBINED BUDGET", value: totalBudget, suffix: "M" },
              ].map(({ label, value, suffix }) => (
                <div key={label} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-5 py-3 text-right backdrop-blur">
                  <p className="text-xs text-zinc-600 font-mono tracking-widest mb-1">{label}</p>
                  <p className="text-2xl font-black text-white">${suffix ? "" : ""}{value.toLocaleString()}{suffix}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Teams grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800/50"
                style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {teams.map((team, i) => (
              <TeamCard key={team.id} team={team} drivers={drivers} idx={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}