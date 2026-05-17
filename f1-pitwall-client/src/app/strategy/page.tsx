"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const TYRE = {
  SOFT: { color: "#ef4444", lapTime: 0, degradation: 0.08, maxLaps: 20, label: "S" },
  MEDIUM: { color: "#eab308", lapTime: 0.5, degradation: 0.05, maxLaps: 30, label: "M" },
  HARD: { color: "#e2e8f0", lapTime: 1.2, degradation: 0.03, maxLaps: 40, label: "H" },
  INTER: { color: "#22c55e", lapTime: 3.0, degradation: 0.04, maxLaps: 25, label: "I" },
  WET: { color: "#3b82f6", lapTime: 6.0, degradation: 0.03, maxLaps: 30, label: "W" },
};

type TyreType = keyof typeof TYRE;
const PIT_LOSS = 22;

interface Stint { id: string; tyre: TyreType; laps: number; }
interface Strategy { id: string; name: string; color: string; stints: Stint[]; }
interface Circuit { id: number; name: string; totalLaps: number; lapRecordSec: number; country: string; }

function calcRaceTime(stints: Stint[], baseLapTime: number): number {
  let total = 0;
  stints.forEach(stint => {
    const tyre = TYRE[stint.tyre];
    for (let lap = 1; lap <= stint.laps; lap++) {
      total += baseLapTime + tyre.lapTime + tyre.degradation * lap;
    }
  });
  total += (stints.length - 1) * PIT_LOSS;
  return total;
}

function calcStintTime(stint: Stint, baseLapTime: number): number {
  const tyre = TYRE[stint.tyre];
  let total = 0;
  for (let lap = 1; lap <= stint.laps; lap++) {
    total += baseLapTime + tyre.lapTime + tyre.degradation * lap;
  }
  return total;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(1);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}

const STRATEGY_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7"];
const STRATEGY_NAMES = ["Strategy A", "Strategy B", "Strategy C", "Strategy D", "Strategy E"];

export default function StrategyPage() {
  const router = useRouter();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState<Circuit | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: "s1", name: "Strategy A", color: STRATEGY_COLORS[0],
      stints: [{ id: "st1", tyre: "SOFT", laps: 20 }, { id: "st2", tyre: "MEDIUM", laps: 32 }]
    },
    {
      id: "s2", name: "Strategy B", color: STRATEGY_COLORS[1],
      stints: [{ id: "st3", tyre: "MEDIUM", laps: 26 }, { id: "st4", tyre: "HARD", laps: 26 }]
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [hoveredStrat, setHoveredStrat] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/circuits`)
      .then(r => r.json())
      .then((data: Circuit[]) => {
        setCircuits(data);
        setSelectedCircuit(data.find((c: Circuit) => c.name.includes("Albert")) || data[0]);
      })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalLaps = selectedCircuit?.totalLaps || 57;
  const baseLapTime = selectedCircuit?.lapRecordSec ? selectedCircuit.lapRecordSec + 2 : 92;

  const syncStrategyLaps = (s: Strategy): Strategy => {
    const usedLaps = s.stints.slice(0, -1).reduce((sum, st) => sum + st.laps, 0);
    const last = { ...s.stints[s.stints.length - 1], laps: Math.max(1, totalLaps - usedLaps) };
    return { ...s, stints: [...s.stints.slice(0, -1), last] };
  };

  const raceTimes = strategies.map(s => calcRaceTime(syncStrategyLaps(s).stints, baseLapTime));
  const minTime = Math.min(...raceTimes);
  const maxTime = Math.max(...raceTimes);
  const bestStratIdx = raceTimes.indexOf(minTime);

  const addStrategy = () => {
    if (strategies.length >= 5) return;
    const idx = strategies.length;
    setStrategies(prev => [...prev, {
      id: `s${Date.now()}`, name: STRATEGY_NAMES[idx], color: STRATEGY_COLORS[idx],
      stints: [
        { id: `st${Date.now()}a`, tyre: "SOFT", laps: Math.floor(totalLaps / 2) },
        { id: `st${Date.now()}b`, tyre: "HARD", laps: Math.ceil(totalLaps / 2) },
      ],
    }]);
  };

  const removeStrategy = (id: string) => {
    if (strategies.length <= 1) return;
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  const addStint = (stratId: string) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== stratId || s.stints.length >= 5) return s;
      const stints = [...s.stints, { id: `st${Date.now()}`, tyre: "HARD" as TyreType, laps: 10 }];
      const per = Math.floor(totalLaps / stints.length);
      return { ...s, stints: stints.map((st, i) => ({ ...st, laps: i === stints.length - 1 ? totalLaps - per * (stints.length - 1) : per })) };
    }));
  };

  const removeStint = (stratId: string, stintId: string) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== stratId || s.stints.length <= 1) return s;
      const stints = s.stints.filter(st => st.id !== stintId);
      const per = Math.floor(totalLaps / stints.length);
      return { ...s, stints: stints.map((st, i) => ({ ...st, laps: i === stints.length - 1 ? totalLaps - per * (stints.length - 1) : per })) };
    }));
  };

  const updateStint = (stratId: string, stintId: string, field: keyof Stint, value: any) => {
    setStrategies(prev => prev.map(s => s.id !== stratId ? s :
      { ...s, stints: s.stints.map(st => st.id === stintId ? { ...st, [field]: value } : st) }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes slideUp { from { transform:translateY(16px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes glowPulse { 0%,100% { opacity:.4; } 50% { opacity:1; } }
        @keyframes shimmer { 0% { transform:translateX(-100%); } 100% { transform:translateX(300%); } }
        @keyframes stintPop { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        .slide-up { animation: slideUp .4s ease-out both; }
        .glow-pulse { animation: glowPulse 3s ease-in-out infinite; }
        .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-red-500/4 rounded-full blur-[150px] glow-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-blue-900/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 slide-up">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">RACE ENGINEERING · PIT STRATEGY</p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              PIT STRATEGY<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">SIMULATOR</span>
            </h1>
          </div>
          <button onClick={addStrategy} disabled={strategies.length >= 5}
            className="relative overflow-hidden px-6 py-3 rounded-xl font-black text-sm tracking-widest text-white transition-all duration-300 disabled:opacity-30"
            style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.3)" }}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
            + ADD STRATEGY
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="text-red-500/70 font-mono text-xs tracking-widest animate-pulse">LOADING CIRCUITS...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT PANEL ── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Circuit selector */}
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-5 slide-up" style={{ animationDelay: "100ms" }}>
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">CIRCUIT</p>
                <select
                  value={selectedCircuit?.id || ""}
                  onChange={e => setSelectedCircuit(circuits.find(c => c.id === Number(e.target.value)) || null)}
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors"
                >
                  {circuits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedCircuit && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "LAPS", value: totalLaps },
                      { label: "BASE LAP", value: formatLapTime(baseLapTime) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-3 text-center">
                        <p className="text-xl font-black text-white tabular-nums">{value}</p>
                        <p className="text-xs text-zinc-600 font-mono">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tyre compounds */}
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-5 slide-up" style={{ animationDelay: "150ms" }}>
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">TYRE COMPOUNDS</p>
                <div className="space-y-2">
                  {(Object.entries(TYRE) as [TyreType, typeof TYRE[TyreType]][]).map(([name, cfg]) => (
                    <div key={name} className="flex items-center justify-between py-1 group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-black shadow-sm transition-transform duration-200 group-hover:scale-110"
                          style={{ backgroundColor: cfg.color, boxShadow: `0 0 8px ${cfg.color}40` }}>
                          {cfg.label}
                        </div>
                        <span className="text-xs text-zinc-400 font-medium">{name}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-600 font-mono">
                        <span className="text-zinc-500">+{cfg.lapTime.toFixed(1)}s</span>
                        <span className="text-zinc-600">max {cfg.maxLaps}L</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-800/50 flex items-center justify-between">
                  <p className="text-xs text-zinc-600 font-mono">Pit stop loss</p>
                  <p className="text-xs font-black text-white font-mono">{PIT_LOSS}s</p>
                </div>
              </div>

              {/* Strategy builders */}
              {strategies.map((strategy, sIdx) => {
                const synced = syncStrategyLaps(strategy);
                const raceTime = calcRaceTime(synced.stints, baseLapTime);
                const isBest = sIdx === bestStratIdx;
                return (
                  <div key={strategy.id}
                    className="relative bg-zinc-900/80 backdrop-blur rounded-2xl p-5 border transition-all duration-300 slide-up"
                    style={{
                      animationDelay: `${200 + sIdx * 80}ms`,
                      borderColor: isBest ? `${strategy.color}50` : "rgba(39,39,42,0.5)",
                      boxShadow: isBest ? `0 0 20px ${strategy.color}10` : "none",
                    }}>
                    {/* Glow accent */}
                    {isBest && <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl" style={{ backgroundColor: strategy.color, boxShadow: `0 0 10px ${strategy.color}` }} />}

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strategy.color, boxShadow: `0 0 6px ${strategy.color}` }} />
                        <span className="text-sm font-black text-white">{strategy.name}</span>
                        {isBest && <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ color: strategy.color, backgroundColor: `${strategy.color}20` }}>★ FASTEST</span>}
                      </div>
                      <button onClick={() => removeStrategy(strategy.id)} className="text-zinc-700 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>

                    <div className="space-y-2.5 mb-4">
                      {synced.stints.map((stint, stintIdx) => (
                        <div key={stint.id} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-700 w-4 font-mono">{stintIdx + 1}</span>
                          <select
                            value={stint.tyre}
                            onChange={e => updateStint(strategy.id, stint.id, "tyre", e.target.value as TyreType)}
                            className="bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-red-500/50 flex-1 transition-colors"
                            style={{ color: TYRE[stint.tyre].color }}
                          >
                            {(Object.keys(TYRE) as TyreType[]).map(t => (
                              <option key={t} value={t} style={{ color: TYRE[t].color }}>{t}</option>
                            ))}
                          </select>
                          <input
                            type="number" min={1} max={totalLaps}
                            value={stint.laps}
                            onChange={e => updateStint(strategy.id, stint.id, "laps", Math.max(1, Number(e.target.value)))}
                            disabled={stintIdx === synced.stints.length - 1}
                            className="w-14 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-center text-xs text-white focus:outline-none focus:border-red-500/50 disabled:opacity-40 font-mono"
                          />
                          <span className="text-xs text-zinc-600">L</span>
                          {synced.stints.length > 1 && (
                            <button onClick={() => removeStint(strategy.id, stint.id)} className="text-zinc-700 hover:text-red-400 transition-colors text-sm">×</button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
                      <button onClick={() => addStint(strategy.id)} disabled={synced.stints.length >= 5}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono disabled:opacity-30">
                        + ADD STINT
                      </button>
                      <span className="text-xs font-mono font-bold" style={{ color: strategy.color }}>{formatTime(raceTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Best strategy hero */}
              <div className="relative rounded-2xl p-6 overflow-hidden border-2 slide-up" style={{
                borderColor: strategies[bestStratIdx]?.color,
                backgroundColor: `${strategies[bestStratIdx]?.color}08`,
                boxShadow: `0 0 40px ${strategies[bestStratIdx]?.color}15`,
              }}>
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${strategies[bestStratIdx]?.color}, transparent)` }} />
                {/* Background watermark */}
                <div className="absolute right-6 top-6 font-black text-8xl select-none pointer-events-none opacity-5" style={{ color: strategies[bestStratIdx]?.color }}>
                  {strategies[bestStratIdx]?.stints.length - 1}S
                </div>
                <div className="relative">
                  <p className="text-xs font-mono mb-2 tracking-widest" style={{ color: strategies[bestStratIdx]?.color }}>★ OPTIMAL STRATEGY</p>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-3xl font-black text-white">{strategies[bestStratIdx]?.name}</h2>
                      <p className="text-zinc-400 text-sm mt-1.5 font-mono">
                        {strategies[bestStratIdx]?.stints.length - 1} pit stop ·{" "}
                        {strategies[bestStratIdx] && syncStrategyLaps(strategies[bestStratIdx]).stints.map(s => s.tyre).join(" → ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black text-white tabular-nums">{formatTime(minTime)}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-1">Total race time</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy comparison */}
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 slide-up" style={{ animationDelay: "200ms" }}>
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-6">STRATEGY COMPARISON</p>
                {strategies.map((strategy, sIdx) => {
                  const synced = syncStrategyLaps(strategy);
                  const raceTime = calcRaceTime(synced.stints, baseLapTime);
                  const isBest = sIdx === bestStratIdx;
                  const gap = raceTime - minTime;
                  const isHov = hoveredStrat === strategy.id;
                  return (
                    <div key={strategy.id}
                      className="mb-6 pb-6 border-b border-zinc-800/30 last:border-0 last:mb-0 last:pb-0 transition-all duration-200"
                      onMouseEnter={() => setHoveredStrat(strategy.id)}
                      onMouseLeave={() => setHoveredStrat(null)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full transition-transform duration-200" style={{ backgroundColor: strategy.color, transform: isHov ? "scale(1.3)" : "scale(1)", boxShadow: isHov ? `0 0 8px ${strategy.color}` : "none" }} />
                          <span className="text-sm font-black text-white">{strategy.name}</span>
                          {isBest && (
                            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold" style={{ backgroundColor: `${strategy.color}25`, color: strategy.color }}>BEST</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-mono font-black text-white">{formatTime(raceTime)}</span>
                          {gap > 0 && <span className="text-xs text-zinc-600 font-mono ml-2">+{gap.toFixed(1)}s</span>}
                        </div>
                      </div>

                      {/* Stint blocks */}
                      <div className="flex h-10 rounded-xl overflow-hidden gap-px mb-2">
                        {synced.stints.map((stint, i) => (
                          <div key={stint.id}
                            className="flex items-center justify-center font-black text-black text-xs relative group/stint transition-all duration-200"
                            style={{
                              width: `${(stint.laps / totalLaps) * 100}%`,
                              backgroundColor: TYRE[stint.tyre].color + (i % 2 === 0 ? "" : "cc"),
                              filter: isHov ? "brightness(1.15)" : "brightness(1)",
                            }}
                            title={`${stint.tyre} · ${stint.laps} laps`}>
                            {(stint.laps / totalLaps) > 0.1 && (
                              <span className="font-black">{TYRE[stint.tyre].label}{stint.laps}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex text-xs text-zinc-700 font-mono mb-2">
                        <span>L1</span><span className="ml-auto">L{totalLaps}</span>
                      </div>

                      <div className="flex gap-4 flex-wrap">
                        {synced.stints.map((stint, i) => (
                          <div key={stint.id} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: TYRE[stint.tyre].color }} />
                            <span className="text-zinc-400 font-bold">{stint.tyre}</span>
                            <span className="text-zinc-600">{stint.laps}L</span>
                            <span className="text-zinc-700">{formatTime(calcStintTime(stint, baseLapTime))}</span>
                            {i < synced.stints.length - 1 && <span className="text-zinc-700">→ PIT</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delta table */}
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up" style={{ animationDelay: "300ms" }}>
                <div className="px-6 py-4 border-b border-zinc-800/50">
                  <p className="text-xs font-mono text-zinc-500 tracking-widest">TIME DELTA</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/30">
                      {["STRATEGY", "STOPS", "COMPOUNDS", "RACE TIME", "DELTA"].map((h, i) => (
                        <th key={h} className={`py-3 px-4 text-xs font-mono text-zinc-600 ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((strategy, sIdx) => {
                      const synced = syncStrategyLaps(strategy);
                      const raceTime = calcRaceTime(synced.stints, baseLapTime);
                      const gap = raceTime - minTime;
                      const isBest = sIdx === bestStratIdx;
                      return (
                        <tr key={strategy.id}
                          className="border-b border-zinc-800/20 last:border-0 transition-colors duration-150 hover:bg-zinc-800/20">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strategy.color, boxShadow: `0 0 4px ${strategy.color}` }} />
                              <span className="text-sm text-white font-black">{strategy.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-zinc-400 font-mono">{synced.stints.length - 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {synced.stints.map(s => (
                                <span key={s.id} className="text-xs font-black px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${TYRE[s.tyre].color}20`, color: TYRE[s.tyre].color }}>
                                  {TYRE[s.tyre].label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-mono font-bold text-white">{formatTime(raceTime)}</td>
                          <td className="py-3 px-4 text-right text-sm font-mono font-black"
                            style={{ color: isBest ? "#22c55e" : "#ef4444" }}>
                            {isBest ? "FASTEST" : `+${gap.toFixed(1)}s`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Info note */}
              <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-4 slide-up" style={{ animationDelay: "400ms" }}>
                <p className="text-xs text-zinc-600 font-mono">
                  ℹ️ Base lap = record + 2s · Pit loss = {PIT_LOSS}s · Degradation modelled as linear per lap
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}