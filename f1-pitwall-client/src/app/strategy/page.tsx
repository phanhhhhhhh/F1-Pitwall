"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── Tyre configs ─────────────────────────────────────────────────────────
const TYRE = {
  SOFT:   { color: "#ef4444", lapTime: 0, degradation: 0.08, maxLaps: 20, label: "S" },
  MEDIUM: { color: "#eab308", lapTime: 0.5, degradation: 0.05, maxLaps: 30, label: "M" },
  HARD:   { color: "#e2e8f0", lapTime: 1.2, degradation: 0.03, maxLaps: 40, label: "H" },
  INTER:  { color: "#22c55e", lapTime: 3.0, degradation: 0.04, maxLaps: 25, label: "I" },
  WET:    { color: "#3b82f6", lapTime: 6.0, degradation: 0.03, maxLaps: 30, label: "W" },
};

type TyreType = keyof typeof TYRE;

const PIT_LOSS = 22; // seconds lost per pit stop

interface Stint {
  id: string;
  tyre: TyreType;
  laps: number;
}

interface Strategy {
  id: string;
  name: string;
  color: string;
  stints: Stint[];
}

interface Circuit {
  id: number;
  name: string;
  totalLaps: number;
  lapRecordSec: number;
  country: string;
}

// ─── Calculate total race time for a strategy ─────────────────────────────
function calcRaceTime(stints: Stint[], baseLapTime: number): number {
  let total = 0;
  const pitStops = stints.length - 1;

  stints.forEach(stint => {
    const tyre = TYRE[stint.tyre];
    for (let lap = 1; lap <= stint.laps; lap++) {
      const degradation = tyre.degradation * lap;
      const lapTime = baseLapTime + tyre.lapTime + degradation;
      total += lapTime;
    }
  });

  total += pitStops * PIT_LOSS;
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

// ─── Timeline Bar ──────────────────────────────────────────────────────────
function StrategyTimeline({ strategy, totalLaps, baseLapTime, maxTime }: {
  strategy: Strategy; totalLaps: number; baseLapTime: number; maxTime: number;
}) {
  const raceTime = calcRaceTime(strategy.stints, baseLapTime);
  const pct = (raceTime / maxTime) * 100;

  let lapCursor = 0;
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strategy.color }} />
          <span className="text-sm font-bold text-white">{strategy.name}</span>
          <span className="text-xs text-zinc-500 font-mono">{strategy.stints.length - 1} stop{strategy.stints.length > 2 ? "s" : ""}</span>
        </div>
        <span className="text-sm font-mono font-bold text-white">{formatTime(raceTime)}</span>
      </div>

      {/* Stint blocks */}
      <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
        {strategy.stints.map((stint, i) => {
          const widthPct = (stint.laps / totalLaps) * 100;
          lapCursor += stint.laps;
          return (
            <div key={stint.id}
              className="flex items-center justify-center text-xs font-bold transition-all hover:brightness-125 cursor-default relative group"
              style={{ width: `${widthPct}%`, backgroundColor: TYRE[stint.tyre].color + (i % 2 === 0 ? "dd" : "aa") }}
              title={`${stint.tyre} · ${stint.laps} laps`}
            >
              {widthPct > 8 && (
                <span className="text-black font-black text-xs">
                  {TYRE[stint.tyre].label}{stint.laps}
                </span>
              )}
              {/* Pit stop marker */}
              {i < strategy.stints.length - 1 && (
                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/50" />
              )}
            </div>
          );
        })}
      </div>

      {/* Time bar */}
      <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: strategy.color }} />
      </div>

      <div className="flex gap-3 mt-2">
        {strategy.stints.map((stint, i) => (
          <span key={stint.id} className="text-xs text-zinc-600">
            <span className="font-bold" style={{ color: TYRE[stint.tyre].color }}>{stint.tyre}</span>
            {" "}{stint.laps}L
            {i < strategy.stints.length - 1 && " →"}
          </span>
        ))}
        <span className="text-xs text-zinc-700 ml-auto">
          +{(raceTime - maxTime * (Math.min(...[raceTime]) / maxTime)).toFixed(1)}s pit loss
        </span>
      </div>
    </div>
  );
}

export default function StrategyPage() {
  const router = useRouter();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState<Circuit | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: "s1", name: "Strategy A", color: STRATEGY_COLORS[0],
      stints: [
        { id: "st1", tyre: "SOFT", laps: 20 },
        { id: "st2", tyre: "MEDIUM", laps: 32 },
      ]
    },
    {
      id: "s2", name: "Strategy B", color: STRATEGY_COLORS[1],
      stints: [
        { id: "st3", tyre: "MEDIUM", laps: 26 },
        { id: "st4", tyre: "HARD", laps: 26 },
      ]
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/circuits`)
      .then(r => r.json())
      .then((data: Circuit[]) => {
        setCircuits(data);
        // Default to Miami
        const miami = data.find((c: Circuit) => c.name.includes("Miami") || c.name.includes("Albert"));
        setSelectedCircuit(miami || data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalLaps = selectedCircuit?.totalLaps || 57;
  const baseLapTime = selectedCircuit?.lapRecordSec ? selectedCircuit.lapRecordSec + 2 : 92;

  // Sync stints laps to match total laps
  const syncStrategyLaps = (strategy: Strategy): Strategy => {
    const usedLaps = strategy.stints.slice(0, -1).reduce((sum, s) => sum + s.laps, 0);
    const lastStint = { ...strategy.stints[strategy.stints.length - 1], laps: Math.max(1, totalLaps - usedLaps) };
    return { ...strategy, stints: [...strategy.stints.slice(0, -1), lastStint] };
  };

  const raceTimes = strategies.map(s => calcRaceTime(syncStrategyLaps(s).stints, baseLapTime));
  const maxTime = Math.max(...raceTimes);
  const minTime = Math.min(...raceTimes);
  const bestStratIdx = raceTimes.indexOf(minTime);

  const addStrategy = () => {
    if (strategies.length >= 5) return;
    const idx = strategies.length;
    setStrategies(prev => [...prev, {
      id: `s${Date.now()}`,
      name: STRATEGY_NAMES[idx],
      color: STRATEGY_COLORS[idx],
      stints: [
        { id: `st${Date.now()}a`, tyre: "SOFT", laps: Math.floor(totalLaps / 2) },
        { id: `st${Date.now()}b`, tyre: "HARD", laps: Math.ceil(totalLaps / 2) },
      ]
    }]);
  };

  const removeStrategy = (id: string) => {
    if (strategies.length <= 1) return;
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  const addStint = (stratId: string) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== stratId || s.stints.length >= 5) return s;
      const newStint: Stint = { id: `st${Date.now()}`, tyre: "HARD", laps: 10 };
      const stints = [...s.stints, newStint];
      // Redistribute laps
      const perStint = Math.floor(totalLaps / stints.length);
      return {
        ...s, stints: stints.map((st, i) => ({
          ...st, laps: i === stints.length - 1 ? totalLaps - perStint * (stints.length - 1) : perStint
        }))
      };
    }));
  };

  const removeStint = (stratId: string, stintId: string) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== stratId || s.stints.length <= 1) return s;
      const stints = s.stints.filter(st => st.id !== stintId);
      const perStint = Math.floor(totalLaps / stints.length);
      return {
        ...s, stints: stints.map((st, i) => ({
          ...st, laps: i === stints.length - 1 ? totalLaps - perStint * (stints.length - 1) : perStint
        }))
      };
    }));
  };

  const updateStint = (stratId: string, stintId: string, field: keyof Stint, value: any) => {
    setStrategies(prev => prev.map(s => {
      if (s.id !== stratId) return s;
      return { ...s, stints: s.stints.map(st => st.id === stintId ? { ...st, [field]: value } : st) };
    }));
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
              Race Engineering · Pit Strategy
            </p>
            <h1 className="text-4xl font-black tracking-tighter text-white">
              PIT STRATEGY <span className="text-red-500">SIMULATOR</span>
            </h1>
          </div>
          <button onClick={addStrategy} disabled={strategies.length >= 5}
            className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">
            + ADD STRATEGY
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" /> LOADING...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ─── Left: Circuit + Strategy Builder ──────────────────── */}
            <div className="lg:col-span-1 space-y-6">

              {/* Circuit selector */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">CIRCUIT</p>
                <select
                  value={selectedCircuit?.id || ""}
                  onChange={e => setSelectedCircuit(circuits.find(c => c.id === Number(e.target.value)) || null)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                >
                  {circuits.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {selectedCircuit && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <p className="text-xl font-black text-white">{totalLaps}</p>
                      <p className="text-xs text-zinc-600">LAPS</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                      <p className="text-sm font-black text-white">{formatLapTime(baseLapTime)}</p>
                      <p className="text-xs text-zinc-600">BASE LAP</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tyre legend */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">TYRE COMPOUNDS</p>
                <div className="space-y-2">
                  {(Object.entries(TYRE) as [TyreType, typeof TYRE[TyreType]][]).map(([name, cfg]) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-black text-black"
                          style={{ backgroundColor: cfg.color }}>
                          {cfg.label}
                        </div>
                        <span className="text-xs text-zinc-400">{name}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-600 font-mono">
                        <span>+{cfg.lapTime.toFixed(1)}s</span>
                        <span>max {cfg.maxLaps}L</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-800">
                  <p className="text-xs text-zinc-600 font-mono">Pit stop loss: <span className="text-white">{PIT_LOSS}s</span></p>
                </div>
              </div>

              {/* Strategy builders */}
              {strategies.map((strategy, sIdx) => {
                const synced = syncStrategyLaps(strategy);
                const raceTime = calcRaceTime(synced.stints, baseLapTime);
                const isBest = sIdx === bestStratIdx;
                return (
                  <div key={strategy.id}
                    className={`bg-zinc-900 rounded-xl p-5 border transition-all ${isBest ? "border-2" : "border-zinc-800"}`}
                    style={isBest ? { borderColor: strategy.color } : {}}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strategy.color }} />
                        <span className="text-sm font-bold text-white">{strategy.name}</span>
                        {isBest && <span className="text-xs text-yellow-400 font-mono">★ FASTEST</span>}
                      </div>
                      <button onClick={() => removeStrategy(strategy.id)}
                        className="text-zinc-600 hover:text-red-400 text-lg transition-colors">×</button>
                    </div>

                    {/* Stints */}
                    <div className="space-y-3 mb-4">
                      {synced.stints.map((stint, stintIdx) => (
                        <div key={stint.id} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600 w-4">{stintIdx + 1}</span>
                          <select
                            value={stint.tyre}
                            onChange={e => updateStint(strategy.id, stint.id, "tyre", e.target.value as TyreType)}
                            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500 flex-1"
                            style={{ color: TYRE[stint.tyre].color }}
                          >
                            {(Object.keys(TYRE) as TyreType[]).map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={totalLaps - (stintIdx === synced.stints.length - 1 ? synced.stints.slice(0, -1).reduce((s, st) => s + st.laps, 0) : 0)}
                            value={stint.laps}
                            onChange={e => updateStint(strategy.id, stint.id, "laps", Math.max(1, Number(e.target.value)))}
                            disabled={stintIdx === synced.stints.length - 1}
                            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center text-xs text-white focus:outline-none focus:border-red-500 disabled:opacity-50"
                          />
                          <span className="text-xs text-zinc-600">L</span>
                          {synced.stints.length > 1 && (
                            <button onClick={() => removeStint(strategy.id, stint.id)}
                              className="text-zinc-700 hover:text-red-400 text-sm transition-colors">×</button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button onClick={() => addStint(strategy.id)} disabled={synced.stints.length >= 5}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors font-mono disabled:opacity-30">
                        + ADD STINT
                      </button>
                      <span className="text-xs font-mono text-zinc-400">{formatTime(raceTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Right: Visualization ──────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Winner banner */}
              <div className="rounded-xl p-5 border-2" style={{ borderColor: strategies[bestStratIdx]?.color, backgroundColor: strategies[bestStratIdx]?.color + "10" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: strategies[bestStratIdx]?.color }}>
                      ★ OPTIMAL STRATEGY
                    </p>
                    <h2 className="text-2xl font-black text-white">{strategies[bestStratIdx]?.name}</h2>
                    <p className="text-zinc-400 text-sm mt-1">
                      {strategies[bestStratIdx]?.stints.length - 1} pit stop{strategies[bestStratIdx]?.stints.length > 2 ? "s" : ""} ·{" "}
                      {strategies[bestStratIdx] && syncStrategyLaps(strategies[bestStratIdx]).stints.map(s => s.tyre).join(" → ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-white">{formatTime(minTime)}</p>
                    <p className="text-xs text-zinc-500">Total race time</p>
                  </div>
                </div>
              </div>

              {/* Timeline comparison */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-6">STRATEGY COMPARISON</p>

                {strategies.map((strategy, sIdx) => {
                  const synced = syncStrategyLaps(strategy);
                  const raceTime = calcRaceTime(synced.stints, baseLapTime);
                  const isBest = sIdx === bestStratIdx;
                  const gap = raceTime - minTime;
                  return (
                    <div key={strategy.id} className={`mb-6 pb-6 border-b border-zinc-800 last:border-0 last:mb-0 last:pb-0 ${isBest ? "relative" : ""}`}>
                      {isBest && (
                        <div className="absolute -left-6 top-0 bottom-0 w-1 rounded-r" style={{ backgroundColor: strategy.color }} />
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: strategy.color }} />
                          <span className="text-sm font-bold text-white">{strategy.name}</span>
                          {isBest && <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ backgroundColor: strategy.color + "30", color: strategy.color }}>BEST</span>}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-mono font-bold text-white">{formatTime(raceTime)}</span>
                          {gap > 0 && <span className="text-xs text-zinc-500 font-mono ml-2">+{gap.toFixed(1)}s</span>}
                        </div>
                      </div>

                      {/* Stint timeline */}
                      <div className="flex h-10 rounded-lg overflow-hidden gap-px mb-2">
                        {synced.stints.map((stint, i) => (
                          <div key={stint.id}
                            className="flex items-center justify-center font-black text-black text-xs relative group"
                            style={{ width: `${(stint.laps / totalLaps) * 100}%`, backgroundColor: TYRE[stint.tyre].color + (i % 2 === 0 ? "" : "bb") }}
                            title={`${stint.tyre} · ${stint.laps} laps · ${formatTime(calcStintTime(stint, baseLapTime))}`}
                          >
                            {(stint.laps / totalLaps) > 0.1 && `${TYRE[stint.tyre].label}${stint.laps}`}
                          </div>
                        ))}
                      </div>

                      {/* Lap markers */}
                      <div className="flex text-xs text-zinc-700 font-mono">
                        <span>L1</span>
                        <span className="ml-auto">L{totalLaps}</span>
                      </div>

                      {/* Stint details */}
                      <div className="flex gap-4 mt-2 flex-wrap">
                        {synced.stints.map((stint, i) => (
                          <div key={stint.id} className="flex items-center gap-1.5 text-xs">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: TYRE[stint.tyre].color }} />
                            <span className="text-zinc-400">{stint.tyre}</span>
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-4">TIME DELTA</p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 text-xs font-mono text-zinc-600">STRATEGY</th>
                      <th className="text-left py-2 text-xs font-mono text-zinc-600">STOPS</th>
                      <th className="text-left py-2 text-xs font-mono text-zinc-600">COMPOUNDS</th>
                      <th className="text-right py-2 text-xs font-mono text-zinc-600">RACE TIME</th>
                      <th className="text-right py-2 text-xs font-mono text-zinc-600">DELTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((strategy, sIdx) => {
                      const synced = syncStrategyLaps(strategy);
                      const raceTime = calcRaceTime(synced.stints, baseLapTime);
                      const gap = raceTime - minTime;
                      const isBest = sIdx === bestStratIdx;
                      return (
                        <tr key={strategy.id} className={`border-b border-zinc-800/50 ${isBest ? "bg-zinc-800/20" : ""}`}>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: strategy.color }} />
                              <span className="text-sm text-white font-bold">{strategy.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-zinc-400">{synced.stints.length - 1}</td>
                          <td className="py-3">
                            <div className="flex gap-1">
                              {synced.stints.map(s => (
                                <span key={s.id} className="text-xs font-bold px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: TYRE[s.tyre].color + "25", color: TYRE[s.tyre].color }}>
                                  {TYRE[s.tyre].label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 text-right text-sm font-mono text-white">{formatTime(raceTime)}</td>
                          <td className="py-3 text-right text-sm font-mono" style={{ color: isBest ? "#22c55e" : "#ef4444" }}>
                            {isBest ? "FASTEST" : `+${gap.toFixed(1)}s`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Info */}
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
                <p className="text-xs text-zinc-600 font-mono">
                  ℹ️ Base lap time = circuit record + 2s average race pace · Pit stop loss = {PIT_LOSS}s · Degradation modelled as linear per lap
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
