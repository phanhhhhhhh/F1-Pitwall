"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Circuit {
  id: number;
  name: string;
  country: string;
  city: string;
  type: string;
  totalLaps: number;
  lengthKm: number;
  lapRecordSec: number;
  lapRecordHolder: string;
  turnCount: number;
}

const typeConfig: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  PERMANENT: { color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/30", glow: "#3b82f6" },
  STREET: { color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/30", glow: "#f97316" },
  OVAL: { color: "#a855f7", bg: "bg-purple-500/10", border: "border-purple-500/30", glow: "#a855f7" },
};

const COUNTRY_FLAGS: Record<string, string> = {
  "Australia": "🇦🇺", "China": "🇨🇳", "Japan": "🇯🇵", "Bahrain": "🇧🇭",
  "Saudi Arabia": "🇸🇦", "United States": "🇺🇸", "Canada": "🇨🇦",
  "Monaco": "🇲🇨", "Spain": "🇪🇸", "Austria": "🇦🇹", "United Kingdom": "🇬🇧",
  "Belgium": "🇧🇪", "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹",
  "Azerbaijan": "🇦🇿", "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷",
  "UAE": "🇦🇪", "Qatar": "🇶🇦", "Las Vegas": "🇺🇸",
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
};

function CircuitCard({ circuit, idx }: { circuit: Circuit; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const cfg = typeConfig[circuit.type] || { color: "#71717a", bg: "bg-zinc-800", border: "border-zinc-700", glow: "#71717a" };
  const flag = COUNTRY_FLAGS[circuit.country] || "🏁";

  return (
    <div
      className="group relative card-enter"
      style={{ animationDelay: `${idx * 40}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none"
        style={{ opacity: hovered ? 1 : 0, boxShadow: `0 0 30px ${cfg.glow}20` }} />

      <div
        className="relative bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden transition-all duration-300"
        style={{
          borderColor: hovered ? `${cfg.color}30` : undefined,
          transform: hovered ? "translateY(-3px)" : "translateY(0)",
        }}
      >
        {/* Top color bar */}
        <div className="h-0.5 w-full transition-all duration-300"
          style={{ backgroundColor: cfg.color, boxShadow: hovered ? `0 0 10px ${cfg.color}` : "none" }} />

        {/* Background lap time watermark */}
        <div
          className="absolute right-3 bottom-3 font-black select-none pointer-events-none font-mono transition-all duration-500"
          style={{
            fontSize: "2rem",
            color: cfg.color,
            opacity: hovered ? 0.08 : 0.04,
            transform: hovered ? "scale(1.05)" : "scale(1)",
          }}
        >
          {formatTime(circuit.lapRecordSec)}
        </div>

        <div className="relative z-10 p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg flex-shrink-0">{flag}</span>
                <span className={`text-xs px-2 py-0.5 rounded border font-mono font-bold ${cfg.bg} ${cfg.border}`}
                  style={{ color: cfg.color }}>
                  {circuit.type}
                </span>
              </div>
              <h2 className={`text-base font-black transition-colors duration-200 leading-tight ${hovered ? "" : "text-white"}`}
                style={{ color: hovered ? cfg.color : undefined }}>
                {circuit.name}
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                {circuit.city}, {circuit.country}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px mb-4 transition-all duration-300"
            style={{ background: `linear-gradient(90deg, ${cfg.color}40, transparent)`, opacity: hovered ? 1 : 0.4 }} />

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "LAPS", value: circuit.totalLaps, suffix: "" },
              { label: "KM", value: circuit.lengthKm, suffix: "" },
              { label: "TURNS", value: circuit.turnCount, suffix: "" },
              { label: "RECORD", value: formatTime(circuit.lapRecordSec), suffix: "", isTime: true },
            ].map(({ label, value, suffix, isTime }) => (
              <div key={label} className="text-center">
                <p className={`font-black tabular-nums transition-colors duration-200 ${isTime
                  ? "text-sm"
                  : "text-lg"
                  }`}
                  style={{ color: isTime ? cfg.color : hovered ? "white" : "#e4e4e7" }}>
                  {value}{suffix}
                </p>
                <p className="text-xs text-zinc-600 font-mono">{label}</p>
              </div>
            ))}
          </div>

          {/* Record holder */}
          <div className="flex items-center gap-2 bg-zinc-800/40 rounded-lg px-3 py-2 border border-zinc-700/30">
            <span className="text-xs text-red-500">⚡</span>
            <p className="text-xs text-zinc-400 font-mono">
              Record by <span className="text-white font-bold">{circuit.lapRecordHolder}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CircuitsPage() {
  const router = useRouter();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/circuits`)
      .then(r => r.json()).then(setCircuits)
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const types = ["ALL", "PERMANENT", "STREET", "OVAL"];
  const filtered = circuits.filter(c => {
    const matchType = filter === "ALL" || c.type === filter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
                @keyframes cardEnter {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .card-enter { animation: cardEnter 0.4s ease-out both; }
                @keyframes headerEnter {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .header-enter { animation: headerEnter 0.4s ease-out both; }
            `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 right-1/3 w-[500px] h-[400px] bg-red-500/4 rounded-full blur-[130px]" />
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
              <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">{circuits.length} CIRCUITS WORLDWIDE</p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              CIRCUIT<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">DATABASE</span>
            </h1>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search circuit or country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 w-64 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mb-8 header-enter" style={{ animationDelay: "100ms" }}>
          {types.map(t => {
            const cfg = typeConfig[t];
            const isActive = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${!isActive ? "border-zinc-700/50 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300" : ""
                  }`}
                style={isActive ? {
                  borderColor: cfg ? `${cfg.color}60` : "#ef4444",
                  color: cfg ? cfg.color : "white",
                  backgroundColor: cfg ? `${cfg.color}15` : "rgba(239,68,68,0.15)",
                } : {}}>
                {t}
                <span className="ml-1.5 opacity-50">
                  {t === "ALL" ? circuits.length : circuits.filter(c => c.type === t).length}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800/50"
                style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((circuit, idx) => (
              <CircuitCard key={circuit.id} circuit={circuit} idx={idx} />
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-center text-zinc-700 text-xs font-mono mt-8">
            Showing {filtered.length} of {circuits.length} circuits
          </p>
        )}
      </main>
    </div>
  );
}