"use client";

import { useEffect, useState } from "react";
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
  position: number; driverId: number; driverName: string; carNumber: number;
  nationality: string; teamName: string; teamColor: string; totalPoints: number;
  wins: number; podiums: number; fastestLaps: number; gapToLeader: number; gapToAhead: number;
}
interface ConstructorStanding {
  position: number; teamId: number; teamName: string; teamColor: string; country: string;
  totalPoints: number; wins: number; podiums: number; gapToLeader: number;
  driver1Name: string; driver2Name: string; driver1Points: number; driver2Points: number;
}

function useCountUp(target: number, duration = 1000, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t = setTimeout(() => {
      let s: number | null = null;
      const step = (ts: number) => {
        if (s === null) s = ts;
        const p = Math.min((ts - s) / duration, 1);
        setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return v;
}
const Pts = ({ points, delay = 0 }: { points: number; delay?: number }) => <>{useCountUp(Math.round(points), 900, delay)}</>;

const MEDAL = ["#FFD23F", "#C8CDD4", "#D8853B"];

export default function StandingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    (async () => {
      try {
        const [d, c] = await Promise.all([
          authFetch(`${API}/api/race-results/standings/drivers/2026`),
          authFetch(`${API}/api/race-results/standings/constructors/2026`),
        ]);
        setDrivers(await d.json());
        setConstructors(await c.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const maxPts = drivers[0]?.totalPoints || 1;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,400;0,500;0,600;0,700;1,600;1,800&family=Saira+Condensed:wght@500;600;700;800;900&display=swap');
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        @keyframes grid-pan{from{background-position:0 0}to{background-position:0 80px}}
        @keyframes glow{0%,100%{opacity:.4}50%{opacity:.9}}
        @keyframes live{0%,100%{box-shadow:0 0 0 0 rgba(225,6,0,.6)}70%{box-shadow:0 0 0 6px rgba(225,6,0,0)}}
        @keyframes shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
        @keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes streak{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(60vw);opacity:0}}
        .rise{animation:rise .5s cubic-bezier(.16,1,.3,1) both}
        .shimmer{animation:shimmer 2.4s ease-in-out infinite}
        .chamfer{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
        .trow:hover{background:rgba(255,255,255,.03)}
      `}</style>

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 15% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 25%,black,transparent 80%)" }} />
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)" }} />
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="absolute h-px" style={{ width: `${120 + i * 50}px`, top: `${15 + i * 20}%`, left: "-10%", background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: `streak ${5 + i * 1.4}s linear infinite`, animationDelay: `${i * 1.3}s` }} />
        ))}
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 rise">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">2026 SEASON · LIVE STANDINGS</span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(48px,7vw,84px)" }}>
              <span className="block text-white">CHAMPIONSHIP</span>
              <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>STANDINGS</span>
            </h1>
            {drivers[0] && (
              <p className="f-mono text-xs text-zinc-500 mt-3">
                LEADER <span className="text-white font-bold">{drivers[0].driverName}</span>
                <span className="text-[#E10600] ml-2 font-bold">{Math.round(drivers[0].totalPoints)} PTS</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton label="CSV" variant="csv" onClick={() => tab === "drivers" ? downloadDriverStandingsCsv(2026) : downloadConstructorStandingsCsv(2026)} />
            <ExportButton label="PDF Report" variant="pdf" onClick={() => downloadStandingsPdf(2026)} />
            <Link href="/races" className="f-mono text-[11px] text-zinc-500 hover:text-[#E10600] border border-white/10 hover:border-[#E10600]/50 px-4 py-2 rounded-lg transition-all">← RACES</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-7 rise" style={{ animationDelay: "60ms" }}>
          {(["drivers", "constructors"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-full f-cond font-bold text-sm tracking-wide border transition-all ${tab === t ? "border-[#E10600] bg-[#E10600]/15 text-[#ff6a52]" : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"
                }`}>
              {t === "drivers" ? "🏎 DRIVERS" : "🏗 CONSTRUCTORS"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 border-2 border-[#E10600]/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-[#E10600] rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="f-mono text-[11px] text-[#E10600]/70 tracking-widest animate-pulse">LOADING TELEMETRY...</p>
          </div>
        ) : tab === "drivers" ? (
          <>
            {/* Podium top 3 */}
            {drivers.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
                {[drivers[1], drivers[0], drivers[2]].map((d, hi) => {
                  const isP1 = hi === 1;
                  const col = d.teamColor || "#666";
                  const medal = MEDAL[hi === 0 ? 1 : hi === 1 ? 0 : 2];
                  return (
                    <div key={d.driverId} className={`rise relative overflow-hidden rounded-2xl border chamfer ${isP1 ? "" : "mt-4 sm:mt-6"}`}
                      style={{ animationDelay: `${hi * 80}ms`, background: `linear-gradient(160deg,${col}18,rgba(15,15,18,.85))`, borderColor: isP1 ? `${col}50` : "rgba(255,255,255,.06)", boxShadow: isP1 ? `0 0 40px ${col}25` : "none" }}>
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: col }} />
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <span className="f-cond font-black italic" style={{ fontSize: isP1 ? "44px" : "34px", color: medal, lineHeight: .8, textShadow: `0 0 24px ${medal}40` }}>P{d.position}</span>
                          <span className="f-mono text-[10px] text-zinc-500 border border-white/10 rounded px-1.5 py-0.5">#{d.carNumber}</span>
                        </div>
                        <p className="f-cond font-black text-white uppercase leading-none tracking-wide" style={{ fontSize: isP1 ? "26px" : "20px" }}>{d.driverName}</p>
                        <p className="f-mono text-[11px] mt-1" style={{ color: col }}>{d.teamName}</p>
                        <div className="flex items-end justify-between mt-4">
                          <div>
                            <div className="f-cond font-black text-white leading-none" style={{ fontSize: isP1 ? "40px" : "32px" }}><Pts points={d.totalPoints} delay={hi * 120} /></div>
                            <div className="f-mono text-[9px] text-zinc-600 tracking-widest mt-1">POINTS</div>
                          </div>
                          <div className="text-right">
                            <div className="f-cond font-bold text-xl text-[#FFD23F]">{d.wins}</div>
                            <div className="f-mono text-[9px] text-zinc-600 tracking-widest">WINS</div>
                          </div>
                        </div>
                        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(d.totalPoints / maxPts) * 100}%`, background: col, boxShadow: `0 0 8px ${col}` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timing tower */}
            <div className="rise relative overflow-hidden rounded-2xl border border-white/5" style={{ background: "rgba(18,18,21,.7)", animationDelay: "120ms" }}>
              <div className="absolute inset-x-0 top-0 h-px overflow-hidden"><div className="h-full w-1/3 shimmer" style={{ background: "linear-gradient(90deg,transparent,rgba(225,6,0,.6),transparent)" }} /></div>
              <div className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/5 f-mono text-[10px] text-zinc-600 tracking-widest">
                <div className="col-span-1">POS</div>
                <div className="col-span-5 sm:col-span-4">DRIVER</div>
                <div className="col-span-3 hidden sm:block">TEAM</div>
                <div className="col-span-1 text-center">W</div>
                <div className="col-span-2 sm:col-span-1 text-right">GAP</div>
                <div className="col-span-3 sm:col-span-2 text-right">PTS</div>
              </div>
              {drivers.map((d, i) => {
                const col = d.teamColor || "#666";
                return (
                  <div key={d.driverId} className={`trow relative grid grid-cols-12 gap-2 px-5 py-3.5 border-b border-white/[0.04] transition-colors rise ${i === 0 ? "bg-[#E10600]/[0.04]" : ""}`}
                    style={{ animationDelay: `${i * 30}ms` }} onMouseEnter={() => setHovered(d.driverId)} onMouseLeave={() => setHovered(null)}>
                    {hovered === d.driverId && <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />}
                    <div className="col-span-1 flex items-center">
                      <span className="f-cond font-black italic text-2xl tabular-nums" style={{ color: i < 3 ? MEDAL[i] : "#52525b" }}>{d.position}</span>
                    </div>
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0">
                      <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: col, boxShadow: `0 0 8px ${col}80` }} />
                      <div className="min-w-0">
                        <p className="f-cond font-bold text-sm sm:text-base text-white truncate uppercase tracking-wide">{d.driverName}</p>
                        <p className="f-mono text-[10px] text-zinc-500">#{d.carNumber}</p>
                      </div>
                    </div>
                    <div className="col-span-3 hidden sm:flex items-center">
                      <span className="f-mono text-[11px] px-2 py-0.5 rounded" style={{ color: col, background: `${col}15` }}>{d.teamName}</span>
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <span className={`f-cond font-bold text-base ${d.wins > 0 ? "text-[#FFD23F]" : "text-zinc-600"}`}>{d.wins}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                      <span className="f-mono text-[11px] text-zinc-500">{d.gapToLeader > 0 ? `-${Math.round(d.gapToLeader)}` : "—"}</span>
                    </div>
                    <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
                      <span className="f-cond font-black text-xl tabular-nums" style={{ color: i === 0 ? "#E10600" : "#fff" }}><Pts points={d.totalPoints} delay={i * 30} /></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {constructors.map((c, i) => {
              const col = c.teamColor || "#666";
              return (
                <div key={c.teamId} className="rise relative overflow-hidden rounded-2xl border border-white/5 group" style={{ animationDelay: `${i * 50}ms`, background: "rgba(18,18,21,.7)", boxShadow: i === 0 ? `0 0 30px ${col}12` : "none" }}>
                  <div className="h-[3px] w-full" style={{ background: col, boxShadow: `0 0 10px ${col}80` }} />
                  <div className="flex items-center gap-4 sm:gap-6 px-5 sm:px-6 py-5">
                    <span className="f-cond font-black italic text-4xl sm:text-5xl tabular-nums w-12 text-center" style={{ color: i < 3 ? MEDAL[i] : "#52525b" }}>{c.position}</span>
                    <div className="flex-1 min-w-0">
                      <h2 className="f-cond font-black text-xl sm:text-2xl text-white uppercase tracking-wide truncate">{c.teamName}</h2>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {[{ n: c.driver1Name, p: c.driver1Points }, { n: c.driver2Name, p: c.driver2Points }].filter(x => x.n).map((x, di) => (
                          <span key={di} className="f-mono text-[11px] text-zinc-500">{x.n.split(" ").pop()} <span className="text-white font-bold">{Math.round(x.p)}</span></span>
                        ))}
                      </div>
                      <div className="mt-2.5 max-w-xs h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(c.totalPoints / (constructors[0]?.totalPoints || 1)) * 100}%`, background: col, boxShadow: `0 0 8px ${col}` }} />
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-7">
                      <div className="text-center"><div className="f-cond font-black text-2xl text-[#FFD23F]">{c.wins}</div><div className="f-mono text-[9px] text-zinc-600 tracking-widest">WINS</div></div>
                      <div className="text-center"><div className="f-cond font-black text-2xl text-white">{c.podiums}</div><div className="f-mono text-[9px] text-zinc-600 tracking-widest">POD</div></div>
                    </div>
                    <div className="text-right min-w-20">
                      {c.gapToLeader > 0 && <p className="f-mono text-[10px] text-zinc-600 mb-0.5">-{Math.round(c.gapToLeader)}</p>}
                      <p className="f-cond font-black text-4xl leading-none" style={{ color: i === 0 ? "#E10600" : "#fff" }}><Pts points={c.totalPoints} delay={i * 50} /></p>
                      <p className="f-mono text-[9px] text-zinc-600 tracking-widest mt-1">PTS</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}