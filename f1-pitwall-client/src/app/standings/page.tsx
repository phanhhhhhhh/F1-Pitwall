"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import {
  downloadDriverStandingsCsv,
  downloadConstructorStandingsCsv,
  downloadStandingsPdf,
} from "../lib/export";
import Navbar from "../components/Navbar";
import ExportButton from "../components/ExportButton";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface DriverStanding {
  position: number;
  driverId: number;
  driverName: string;
  carNumber: number;
  nationality: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  gapToLeader: number;
  gapToAhead: number;
}

interface ConstructorStanding {
  position: number;
  teamId: number;
  teamName: string;
  teamColor: string;
  country: string;
  totalPoints: number;
  wins: number;
  podiums: number;
  gapToLeader: number;
  driver1Name: string;
  driver2Name: string;
  driver1Points: number;
  driver2Points: number;
}

// Animated counter hook
function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let startTime: number | null = null;
    let raf: number;
    const timeout = setTimeout(() => {
      const step = (ts: number) => {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.floor(eased * target));
        if (progress < 1) raf = requestAnimationFrame(step);
        else setValue(target);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}

function AnimatedPoints({ points, delay = 0 }: { points: number; delay?: number }) {
  const v = useCountUp(Math.floor(points), 1000, delay);
  return <>{v}</>;
}

function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 100);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="relative h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
      />
      {/* shimmer */}
      <div
        className="absolute inset-y-0 rounded-full animate-shimmer"
        style={{ width: `${width}%`, background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
      />
    </div>
  );
}

function PositionBadge({ pos }: { pos: number }) {
  if (pos === 1) return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" style={{ animationDuration: "2s" }} />
      <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
        <span className="text-black font-black text-sm">P1</span>
      </div>
    </div>
  );
  if (pos === 2) return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 flex items-center justify-center shadow-lg shadow-zinc-400/20">
      <span className="text-black font-black text-sm">P2</span>
    </div>
  );
  if (pos === 3) return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg shadow-amber-600/20">
      <span className="text-white font-black text-sm">P3</span>
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center">
      <span className="text-zinc-500 font-bold text-sm">P{pos}</span>
    </div>
  );
}

// Speed lines background
function SpeedLines() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 20 }).map((_, i) => (
          <line
            key={i}
            x1={`${Math.random() * 100}%`} y1="0"
            x2={`${Math.random() * 100}%`} y2="100%"
            stroke="#ef4444" strokeWidth="0.5"
            style={{ animation: `speedLine ${2 + Math.random() * 3}s linear infinite`, animationDelay: `${Math.random() * 2}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

export default function StandingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchStandings();
  }, []);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const fetchStandings = async () => {
    try {
      const [dRes, cRes] = await Promise.all([
        authFetch(`${API}/api/race-results/standings/drivers/2026`),
        authFetch(`${API}/api/race-results/standings/constructors/2026`),
      ]);
      setDrivers(await dRes.json());
      setConstructors(await cRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const maxPoints = drivers[0]?.totalPoints || 1;

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      <style>{`
        @keyframes speedLine {
          from { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
        .animate-glow { animation: glowPulse 2s ease-in-out infinite; }
        .row-enter { animation: slideUp 0.4s ease-out both; }
        .page-enter { animation: fadeIn 0.6s ease-out both; }
      `}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-glow" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-red-900/10 rounded-full blur-3xl animate-glow" style={{ animationDelay: "1s" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: "linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />
      </div>

      <SpeedLines />

      <Navbar />

      <main className={`relative z-10 max-w-7xl mx-auto px-8 py-10 page-enter`}>

        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-red-500/70 font-mono text-xs tracking-[0.3em] uppercase">
                2026 Season · Live Standings
              </p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              CHAMPIONSHIP
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-300">
                STANDINGS
              </span>
            </h1>
            {drivers[0] && (
              <p className="text-zinc-500 text-sm mt-3 font-mono">
                Leader: <span className="text-white font-bold">{drivers[0].driverName}</span>
                <span className="text-red-500 ml-2 font-black">{Math.floor(drivers[0].totalPoints)} PTS</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton label="CSV" variant="csv" onClick={() => tab === "drivers" ? downloadDriverStandingsCsv(2026) : downloadConstructorStandingsCsv(2026)} />
            <ExportButton label="PDF Report" variant="pdf" onClick={() => downloadStandingsPdf(2026)} />
            <Link href="/races" className="text-xs text-zinc-500 hover:text-red-400 font-mono border border-zinc-700 hover:border-red-500 px-4 py-2 rounded-lg transition-all">
              ← RACES
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          {(["drivers", "constructors"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative px-8 py-2.5 rounded-lg text-xs font-black tracking-widest border transition-all duration-300 overflow-hidden ${tab === t
                  ? "bg-red-500/10 border-red-500 text-red-400 shadow-lg shadow-red-500/10"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                }`}>
              {tab === t && (
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent" />
              )}
              {t === "drivers" ? "🏎 DRIVERS" : "🏗 CONSTRUCTORS"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-2 border border-red-500/40 rounded-full border-b-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
            </div>
            <p className="text-red-500/70 font-mono text-xs tracking-widest animate-pulse">LOADING STANDINGS...</p>
          </div>
        ) : tab === "drivers" ? (
          <div className={`transition-all duration-500 ${visible ? "opacity-100" : "opacity-0"}`}>
            {/* Top 3 hero cards */}
            {drivers.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[drivers[1], drivers[0], drivers[2]].map((d, heroIdx) => {
                  const actualIdx = heroIdx === 0 ? 1 : heroIdx === 1 ? 0 : 2;
                  const colors = ["#d1d5db", "#f59e0b", "#d97706"];
                  const labels = ["P2", "P1", "P3"];
                  const scales = ["scale-95", "scale-100", "scale-95"];
                  const glows = ["shadow-zinc-400/10", "shadow-yellow-500/20", "shadow-amber-600/10"];
                  return (
                    <div key={d.driverId}
                      className={`relative bg-zinc-900/80 backdrop-blur border border-zinc-700/50 rounded-2xl p-5 ${scales[heroIdx]} hover:scale-100 transition-all duration-300 group row-enter`}
                      style={{
                        animationDelay: `${heroIdx * 0.1}s`,
                        boxShadow: actualIdx === 0 ? `0 0 40px ${d.teamColor}20, 0 4px 24px ${d.teamColor}10` : undefined,
                        borderColor: actualIdx === 0 ? `${d.teamColor}40` : undefined,
                      }}>
                      {/* Team color accent */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ backgroundColor: d.teamColor }} />
                      {actualIdx === 0 && (
                        <div className="absolute -top-px left-0 right-0 h-0.5 rounded-t-2xl blur-sm" style={{ backgroundColor: d.teamColor }} />
                      )}
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-4xl font-black" style={{ color: colors[heroIdx], textShadow: `0 0 20px ${colors[heroIdx]}40` }}>
                          {labels[heroIdx]}
                        </span>
                        <span className="text-xs font-mono text-zinc-600 border border-zinc-700 px-2 py-0.5 rounded">
                          #{d.carNumber}
                        </span>
                      </div>
                      <p className="text-lg font-black text-white mb-0.5 group-hover:text-red-300 transition-colors">
                        {d.driverName.split(" ").map((part, i) => (
                          <span key={i} className={i === d.driverName.split(" ").length - 1 ? "block text-2xl" : "block text-sm text-zinc-400 font-medium"}>{part}</span>
                        ))}
                      </p>
                      <p className="text-xs font-bold mb-4" style={{ color: d.teamColor }}>{d.teamName}</p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-black text-white">
                            <AnimatedPoints points={d.totalPoints} delay={heroIdx * 150} />
                          </p>
                          <p className="text-xs text-zinc-600 font-mono">POINTS</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-white">{d.wins}</p>
                          <p className="text-xs text-zinc-600 font-mono">WINS</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <AnimatedBar pct={(d.totalPoints / maxPoints) * 100} color={d.teamColor} delay={heroIdx * 150 + 300} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full table */}
            <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/80">
                <div className="col-span-1 text-xs font-mono text-zinc-600">POS</div>
                <div className="col-span-4 text-xs font-mono text-zinc-600">DRIVER</div>
                <div className="col-span-3 text-xs font-mono text-zinc-600 hidden md:block">TEAM</div>
                <div className="col-span-1 text-xs font-mono text-zinc-600 text-center">W</div>
                <div className="col-span-1 text-xs font-mono text-zinc-600 text-center hidden sm:block">POD</div>
                <div className="col-span-1 text-xs font-mono text-zinc-600 text-right">GAP</div>
                <div className="col-span-1 text-xs font-mono text-zinc-600 text-right">PTS</div>
              </div>

              {drivers.map((d, i) => (
                <div
                  key={d.driverId}
                  className={`relative grid grid-cols-12 gap-2 px-6 py-4 border-b border-zinc-800/30 cursor-default transition-all duration-200 row-enter ${hoveredRow === d.driverId ? "bg-zinc-800/40" : i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"
                    } ${i === 0 ? "bg-yellow-500/5" : ""}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                  onMouseEnter={() => setHoveredRow(d.driverId)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Hover glow line */}
                  {hoveredRow === d.driverId && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full transition-all" style={{ backgroundColor: d.teamColor, boxShadow: `0 0 8px ${d.teamColor}` }} />
                  )}

                  {/* Position */}
                  <div className="col-span-1 flex items-center">
                    <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-600"
                      }`}>{d.position}</span>
                  </div>

                  {/* Driver */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-0.5 h-10 rounded-full flex-shrink-0 transition-all duration-300"
                      style={{
                        backgroundColor: d.teamColor,
                        boxShadow: hoveredRow === d.driverId ? `0 0 6px ${d.teamColor}` : "none"
                      }} />
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{d.driverName}</p>
                      <p className="text-xs text-zinc-500 font-mono">#{d.carNumber}</p>
                    </div>
                  </div>

                  {/* Team */}
                  <div className="col-span-3 hidden md:flex items-center">
                    <span className="text-xs font-bold px-2 py-1 rounded" style={{ color: d.teamColor, backgroundColor: `${d.teamColor}15` }}>
                      {d.teamName}
                    </span>
                  </div>

                  {/* Wins */}
                  <div className="col-span-1 flex items-center justify-center">
                    <span className={`text-sm font-black ${d.wins > 0 ? "text-yellow-400" : "text-zinc-600"}`}>{d.wins}</span>
                  </div>

                  {/* Podiums */}
                  <div className="col-span-1 hidden sm:flex items-center justify-center">
                    <span className={`text-sm ${d.podiums > 0 ? "text-zinc-300" : "text-zinc-700"}`}>{d.podiums}</span>
                  </div>

                  {/* Gap */}
                  <div className="col-span-1 flex items-center justify-end">
                    <span className="text-xs font-mono text-zinc-600">
                      {d.gapToLeader > 0 ? `-${d.gapToLeader.toFixed(0)}` : "—"}
                    </span>
                  </div>

                  {/* Points */}
                  <div className="col-span-1 flex items-center justify-end">
                    <div className="text-right">
                      <p className="text-sm font-black text-white">
                        <AnimatedPoints points={d.totalPoints} delay={i * 40} />
                      </p>
                      <div className="w-12 mt-1">
                        <AnimatedBar pct={(d.totalPoints / maxPoints) * 100} color={d.teamColor} delay={i * 40 + 200} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Constructor standings */
          <div className={`space-y-3 transition-all duration-500 ${visible ? "opacity-100" : "opacity-0"}`}>
            {constructors.map((c, i) => (
              <div key={c.teamId}
                className="relative group bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-600/50 transition-all duration-300 row-enter"
                style={{
                  animationDelay: `${i * 0.06}s`,
                  boxShadow: i === 0 ? `0 0 30px ${c.teamColor}10` : undefined,
                }}>
                {/* Top color bar */}
                <div className="h-0.5 w-full transition-all duration-500 group-hover:h-1" style={{ backgroundColor: c.teamColor, boxShadow: `0 0 10px ${c.teamColor}80` }} />

                <div className="flex items-center gap-6 px-6 py-5">
                  {/* Position */}
                  <PositionBadge pos={c.position} />

                  {/* Team info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-white group-hover:text-red-300 transition-colors">{c.teamName}</h2>
                    <div className="flex items-center gap-4 mt-1.5">
                      {[{ name: c.driver1Name, pts: c.driver1Points }, { name: c.driver2Name, pts: c.driver2Points }].filter(dr => dr.name).map((dr, di) => (
                        <span key={di} className="text-xs text-zinc-500 font-mono">
                          {dr.name.split(" ").pop()} <span className="text-white font-bold">{Math.floor(dr.pts)}</span>
                        </span>
                      ))}
                    </div>
                    {/* Points bar */}
                    <div className="mt-2.5 max-w-xs">
                      <AnimatedBar
                        pct={(c.totalPoints / (constructors[0]?.totalPoints || 1)) * 100}
                        color={c.teamColor}
                        delay={i * 60 + 200}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-2xl font-black text-white">{c.wins}</p>
                      <p className="text-xs text-zinc-600 font-mono tracking-widest">WINS</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-white">{c.podiums}</p>
                      <p className="text-xs text-zinc-600 font-mono tracking-widest">POD</p>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right min-w-24">
                    {c.gapToLeader > 0 && (
                      <p className="text-xs text-zinc-600 font-mono mb-1">-{c.gapToLeader.toFixed(0)}</p>
                    )}
                    <p className="text-4xl font-black text-white leading-none">
                      <AnimatedPoints points={c.totalPoints} delay={i * 60} />
                    </p>
                    <p className="text-xs text-zinc-600 font-mono tracking-widest mt-1">PTS</p>
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