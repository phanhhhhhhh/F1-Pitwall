"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "../lib/pitwall-auth";
import { F1, tyre } from "../lib/f1-theme";
import Navbar from "../components/Navbar";
import PitwallBackground from "../components/PitwallBackground";
import { SkeletonCard } from "../components/LoadingSkeleton";
import type { CircuitRef } from "../types/f1";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ─── local tyre data (lap-time penalty + degradation model) ──────────────────
const TYRE_PERF: Record<string, { lapTime: number; degradation: number }> = {
  SOFT:         { lapTime: 0,   degradation: 0.08 },
  MEDIUM:       { lapTime: 0.5, degradation: 0.05 },
  HARD:         { lapTime: 1.2, degradation: 0.03 },
  INTERMEDIATE: { lapTime: 3.0, degradation: 0.04 },
  WET:          { lapTime: 6.0, degradation: 0.03 },
};
type TyreType = keyof typeof TYRE_PERF;

const PIT_LOSS = 22;
const STRATEGY_COLORS = [F1.red, "#3b82f6", F1.green, F1.gold, "#a855f7"];
const STRATEGY_NAMES = ["Strategy A", "Strategy B", "Strategy C", "Strategy D", "Strategy E"];

interface Stint    { id: string; tyre: TyreType; laps: number; }
interface Strategy { id: string; name: string; color: string; stints: Stint[]; }

// ─── pure helpers ─────────────────────────────────────────────────────────────
function calcRaceTime(stints: Stint[], base: number): number {
  let total = 0;
  stints.forEach(stint => {
    const p = TYRE_PERF[stint.tyre] ?? TYRE_PERF.HARD;
    for (let lap = 1; lap <= stint.laps; lap++) total += base + p.lapTime + p.degradation * lap;
  });
  return total + (stints.length - 1) * PIT_LOSS;
}

function calcStintTime(stint: Stint, base: number): number {
  const p = TYRE_PERF[stint.tyre] ?? TYRE_PERF.HARD;
  let total = 0;
  for (let lap = 1; lap <= stint.laps; lap++) total += base + p.lapTime + p.degradation * lap;
  return total;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(1);
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function formatLapTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** Single animated stint bar segment */
function StintBar({
  stint, pct, index, totalStints, hovered, totalLaps,
}: {
  stint: Stint; pct: number; index: number; totalStints: number; hovered: boolean; totalLaps: number;
}) {
  const spec = tyre(stint.tyre);
  const showLabel = pct > 0.09;
  const isLast = index === totalStints - 1;
  const lapStart = 1; // computed by caller if needed, kept simple here

  // Pit-stop marker rendered to the right of every non-last stint
  return (
    <>
      <motion.div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ width: `${pct * 100}%`, background: spec.color, minWidth: 4 }}
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.55, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
        title={`${stint.tyre} · ${stint.laps} laps`}
      >
        {/* alternating shade for depth */}
        {index % 2 === 1 && (
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        )}
        {/* hover brightness */}
        {hovered && (
          <div className="absolute inset-0 bg-white/10 pointer-events-none" />
        )}
        {showLabel && (
          <span
            className="f-cond font-black text-xs select-none z-10 relative"
            style={{ color: spec.color === "#EDEDED" ? "#000" : "rgba(0,0,0,0.85)" }}
          >
            {spec.letter}{stint.laps}
          </span>
        )}
      </motion.div>
      {/* Pit-stop marker (▼ wrench icon) between stints */}
      {!isLast && (
        <motion.div
          className="flex-shrink-0 flex items-center justify-center"
          style={{ width: 18, background: "transparent", position: "relative", zIndex: 10 }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
          title={`Pit stop after lap ${lapStart + stint.laps - 1}`}
        >
          <div
            className="w-[2px] h-full absolute left-1/2 -translate-x-1/2"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
          <div
            className="relative z-10 flex flex-col items-center"
            style={{ marginTop: -2 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 9 L2 3 L5 5 L8 3 Z" fill="rgba(255,255,255,0.7)" />
            </svg>
          </div>
        </motion.div>
      )}
    </>
  );
}

/** Lap-axis tick labels */
function LapAxis({ totalLaps }: { totalLaps: number }) {
  const ticks = [1, Math.round(totalLaps * 0.25), Math.round(totalLaps * 0.5), Math.round(totalLaps * 0.75), totalLaps];
  return (
    <div className="relative flex items-end h-4 mt-1">
      {ticks.map((lap) => (
        <div
          key={lap}
          className="absolute flex flex-col items-center"
          style={{ left: `${((lap - 1) / (totalLaps - 1)) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-px h-1.5 bg-white/15 mb-0.5" />
          <span className="f-mono text-[9px] text-zinc-600">{lap}</span>
        </div>
      ))}
    </div>
  );
}

/** Tyre compound legend chip */
function CompoundChip({ tyreKey }: { tyreKey: string }) {
  const spec = tyre(tyreKey);
  const perf = TYRE_PERF[tyreKey as TyreType];
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center f-cond font-black text-sm flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{
          background: spec.color,
          boxShadow: `0 0 8px ${spec.color}50`,
          color: spec.color === "#EDEDED" ? "#111" : "#000",
        }}
      >
        {spec.letter}
      </div>
      <div className="flex-1">
        <span className="text-xs text-zinc-300 font-medium f-mono">{spec.label}</span>
      </div>
      {perf && (
        <div className="flex gap-3 text-xs text-zinc-600 f-mono flex-shrink-0">
          <span>+{perf.lapTime.toFixed(1)}s</span>
          <span className="text-zinc-700">max {spec.maxLaps}L</span>
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function StrategyPage() {
  const [circuits, setCircuits] = useState<CircuitRef[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitRef | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([
    {
      id: "s1", name: "Strategy A", color: STRATEGY_COLORS[0],
      stints: [{ id: "st1", tyre: "SOFT", laps: 20 }, { id: "st2", tyre: "MEDIUM", laps: 32 }],
    },
    {
      id: "s2", name: "Strategy B", color: STRATEGY_COLORS[1],
      stints: [{ id: "st3", tyre: "MEDIUM", laps: 26 }, { id: "st4", tyre: "HARD", laps: 26 }],
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [hoveredStrat, setHoveredStrat] = useState<string | null>(null);

  // ── auth + data fetch (preserved exactly) ──────────────────────────────────
  useEffect(() => {
    authFetch(`${API}/api/circuits`)
      .then(r => r.json())
      .then((data: CircuitRef[]) => {
        setCircuits(data);
        setSelectedCircuit(data.find((c: CircuitRef) => c.name.includes("Albert")) || data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── derived values ─────────────────────────────────────────────────────────
  const totalLaps = selectedCircuit?.totalLaps || 57;
  const baseLapTime = selectedCircuit?.lapRecordSec ? selectedCircuit.lapRecordSec + 2 : 92;

  const syncStrategyLaps = (s: Strategy): Strategy => {
    const usedLaps = s.stints.slice(0, -1).reduce((sum, st) => sum + st.laps, 0);
    const last = { ...s.stints[s.stints.length - 1], laps: Math.max(1, totalLaps - usedLaps) };
    return { ...s, stints: [...s.stints.slice(0, -1), last] };
  };

  const raceTimes  = strategies.map(s => calcRaceTime(syncStrategyLaps(s).stints, baseLapTime));
  const minTime    = Math.min(...raceTimes);
  const bestStratIdx = raceTimes.indexOf(minTime);

  // ── strategy mutations (preserved exactly) ─────────────────────────────────
  const addStrategy = () => {
    if (strategies.length >= 5) return;
    const idx = strategies.length;
    setStrategies(prev => [...prev, {
      id: `s${Date.now()}`, name: STRATEGY_NAMES[idx], color: STRATEGY_COLORS[idx],
      stints: [
        { id: `st${Date.now()}a`, tyre: "SOFT",        laps: Math.floor(totalLaps / 2) },
        { id: `st${Date.now()}b`, tyre: "HARD",        laps: Math.ceil(totalLaps / 2) },
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

  const updateStint = (stratId: string, stintId: string, field: keyof Stint, value: Stint[keyof Stint]) => {
    setStrategies(prev => prev.map(s => s.id !== stratId ? s :
      { ...s, stints: s.stints.map(st => st.id === stintId ? { ...st, [field]: value } : st) }));
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: F1.bg }}>
      <PitwallBackground glow="top-center" />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* ── HEADER ── */}
        <motion.div
          className="flex items-end justify-between mb-10 flex-wrap gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-[3px]" style={{ background: F1.red }} />
              <p className="f-mono text-[11px] tracking-[0.28em] uppercase" style={{ color: `${F1.red}99` }}>
                Race Engineering · Pit Strategy
              </p>
            </div>
            <h1 className="f-cond font-black text-5xl sm:text-6xl leading-none tracking-tight uppercase">
              Pit Strategy{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: `linear-gradient(90deg,${F1.red},${F1.orange})` }}
              >
                Simulator
              </span>
            </h1>
            <p className="f-mono text-xs text-zinc-500 mt-2 tracking-wider">
              Model multi-stop strategies · Compare race-time deltas
            </p>
          </div>

          <motion.button
            onClick={addStrategy}
            disabled={strategies.length >= 5}
            className="chamfer-sm relative overflow-hidden px-6 py-3 f-mono font-bold text-xs tracking-widest text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg,${F1.red},#c00)`, boxShadow: `0 0 24px ${F1.red}40` }}
            whileHover={{ scale: 1.03, boxShadow: `0 0 32px ${F1.red}60` }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 pointer-events-none" />
            + ADD STRATEGY
          </motion.button>
        </motion.div>

        {/* ── LOADING ── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ════════════════════ LEFT PANEL ════════════════════ */}
            <div className="lg:col-span-1 space-y-4">

              {/* Circuit selector */}
              <motion.div
                className="relative rounded-2xl overflow-hidden border"
                style={{ background: F1.card, borderColor: F1.hairline }}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
              >
                <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg,${F1.red},transparent)` }} />
                <div className="p-5">
                  <p className="f-mono text-[10px] tracking-[0.3em] text-zinc-500 mb-3 uppercase">Circuit</p>
                  <select
                    value={selectedCircuit?.id ?? ""}
                    onChange={e => setSelectedCircuit(circuits.find(c => c.id === Number(e.target.value)) ?? null)}
                    className="w-full border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none transition-colors f-mono"
                    style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    {circuits.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {selectedCircuit && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[
                        { label: "TOTAL LAPS", value: totalLaps },
                        { label: "BASE LAP",   value: formatLapTime(baseLapTime) },
                      ].map(({ label, value }) => (
                        <div
                          key={label}
                          className="rounded-xl p-3 text-center border"
                          style={{ background: "rgba(255,255,255,0.03)", borderColor: F1.hairline }}
                        >
                          <p className="f-cond font-black text-xl text-white tabular-nums">{value}</p>
                          <p className="f-mono text-[9px] text-zinc-600 tracking-widest mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Tyre compound reference */}
              <motion.div
                className="relative rounded-2xl overflow-hidden border"
                style={{ background: F1.card, borderColor: F1.hairline }}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.12 }}
              >
                <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg,${F1.gold},transparent)` }} />
                <div className="p-5">
                  <p className="f-mono text-[10px] tracking-[0.3em] text-zinc-500 mb-3 uppercase">Tyre Compounds</p>
                  <div className="space-y-1 divide-y divide-white/[0.04]">
                    {(["SOFT","MEDIUM","HARD","INTERMEDIATE","WET"] as TyreType[]).map(k => (
                      <CompoundChip key={k} tyreKey={k} />
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: F1.hairline }}>
                    <p className="f-mono text-[10px] text-zinc-600 tracking-widest">PIT STOP LOSS</p>
                    <p className="f-mono text-xs font-bold text-white">{PIT_LOSS}s</p>
                  </div>
                </div>
              </motion.div>

              {/* Per-strategy editor cards */}
              <AnimatePresence>
                {strategies.map((strategy, sIdx) => {
                  const synced    = syncStrategyLaps(strategy);
                  const raceTime  = calcRaceTime(synced.stints, baseLapTime);
                  const isBest    = sIdx === bestStratIdx;
                  const col       = strategy.color;

                  return (
                    <motion.div
                      key={strategy.id}
                      className="relative rounded-2xl overflow-hidden border transition-shadow duration-300"
                      style={{
                        background: F1.card,
                        borderColor: isBest ? `${col}55` : F1.hairline,
                        boxShadow: isBest ? `0 0 28px ${col}18` : "none",
                      }}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.35, delay: 0.18 + sIdx * 0.07 }}
                    >
                      {/* Top accent */}
                      <div className="h-[3px] w-full" style={{ background: col, boxShadow: isBest ? `0 0 10px ${col}` : "none" }} />

                      {/* Watermark stop count */}
                      <div
                        className="absolute right-4 top-4 f-cond font-black select-none pointer-events-none opacity-[0.06]"
                        style={{ fontSize: "5rem", lineHeight: 1, color: col }}
                      >
                        {synced.stints.length - 1}S
                      </div>

                      <div className="p-5 relative">
                        {/* Card header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
                            <span className="f-cond font-black text-base text-white">{strategy.name}</span>
                            {isBest && (
                              <span className="f-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-widest"
                                style={{ color: col, background: `${col}22`, border: `1px solid ${col}44` }}>
                                ★ FASTEST
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeStrategy(strategy.id)}
                            className="text-zinc-700 hover:text-red-400 transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-red-400/10"
                          >
                            ×
                          </button>
                        </div>

                        {/* Stint editors */}
                        <div className="space-y-2 mb-4">
                          {synced.stints.map((stint, stintIdx) => {
                            const spec = tyre(stint.tyre);
                            return (
                              <div key={stint.id} className="flex items-center gap-2">
                                <span className="f-mono text-[10px] text-zinc-700 w-4 text-center flex-shrink-0">{stintIdx + 1}</span>
                                {/* Compound dot preview */}
                                <div
                                  className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center f-cond font-black text-[10px]"
                                  style={{ background: spec.color, color: spec.color === "#EDEDED" ? "#111" : "#000" }}
                                >
                                  {spec.letter}
                                </div>
                                <select
                                  value={stint.tyre}
                                  onChange={e => updateStint(strategy.id, stint.id, "tyre", e.target.value as TyreType)}
                                  className="border rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-1 transition-colors f-mono font-bold"
                                  style={{
                                    background: `${spec.color}18`,
                                    borderColor: `${spec.color}50`,
                                    color: spec.color === "#EDEDED" ? "#ccc" : spec.color,
                                  }}
                                >
                                  {(["SOFT","MEDIUM","HARD","INTERMEDIATE","WET"] as TyreType[]).map(t => {
                                    const ts = tyre(t);
                                    return (
                                      <option key={t} value={t} style={{ color: ts.color, background: "#1a1a1e" }}>
                                        {ts.label}
                                      </option>
                                    );
                                  })}
                                </select>
                                <input
                                  type="number" min={1} max={totalLaps}
                                  value={stint.laps}
                                  onChange={e => updateStint(strategy.id, stint.id, "laps", Math.max(1, Number(e.target.value)))}
                                  disabled={stintIdx === synced.stints.length - 1}
                                  className="w-12 border rounded-lg px-1.5 py-1.5 text-center text-xs text-white focus:outline-none disabled:opacity-40 f-mono tabular-nums"
                                  style={{ background: "rgba(255,255,255,0.04)", borderColor: F1.hairline }}
                                />
                                <span className="f-mono text-[10px] text-zinc-700 flex-shrink-0">L</span>
                                {synced.stints.length > 1 && (
                                  <button
                                    onClick={() => removeStint(strategy.id, stint.id)}
                                    className="text-zinc-700 hover:text-red-400 transition-colors text-sm w-4 flex-shrink-0 text-center"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Card footer */}
                        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: F1.hairline }}>
                          <button
                            onClick={() => addStint(strategy.id)}
                            disabled={synced.stints.length >= 5}
                            className="f-mono text-[10px] text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-30 tracking-widest"
                          >
                            + ADD STINT
                          </button>
                          <span className="f-mono text-xs font-bold tabular-nums" style={{ color: col }}>
                            {formatTime(raceTime)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* ════════════════════ RIGHT PANEL ════════════════════ */}
            <div className="lg:col-span-2 space-y-5">

              {/* ── OPTIMAL STRATEGY HERO ── */}
              <motion.div
                className="relative rounded-2xl overflow-hidden border-2 chamfer-lg"
                style={{
                  borderColor: strategies[bestStratIdx]?.color,
                  background: `${strategies[bestStratIdx]?.color}0a`,
                  boxShadow: `0 0 48px ${strategies[bestStratIdx]?.color}18`,
                }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
              >
                {/* Gradient sweep */}
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg,transparent,${strategies[bestStratIdx]?.color},transparent)` }} />
                {/* Watermark */}
                <div
                  className="absolute right-8 top-6 f-cond font-black select-none pointer-events-none"
                  style={{ fontSize: "9rem", lineHeight: 0.9, color: strategies[bestStratIdx]?.color, opacity: 0.05 }}
                >
                  P1
                </div>

                <div className="relative p-6">
                  <p className="f-mono text-[10px] tracking-[0.35em] mb-2 uppercase"
                    style={{ color: strategies[bestStratIdx]?.color }}>
                    ★ Optimal Strategy
                  </p>
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="f-cond font-black text-4xl text-white leading-none">
                        {strategies[bestStratIdx]?.name}
                      </h2>
                      <p className="f-mono text-xs text-zinc-400 mt-2 tracking-wider">
                        {strategies[bestStratIdx] && syncStrategyLaps(strategies[bestStratIdx]).stints.length - 1} pit{" "}
                        {strategies[bestStratIdx] && syncStrategyLaps(strategies[bestStratIdx]).stints.length - 1 === 1 ? "stop" : "stops"}
                        {" · "}
                        {strategies[bestStratIdx] &&
                          syncStrategyLaps(strategies[bestStratIdx]).stints.map(s => tyre(s.tyre).letter).join(" → ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="f-cond font-black text-4xl text-white tabular-nums leading-none">
                        {formatTime(minTime)}
                      </p>
                      <p className="f-mono text-[10px] text-zinc-500 tracking-widest mt-1">TOTAL RACE TIME</p>
                    </div>
                  </div>

                  {/* Mini stint preview in hero */}
                  {strategies[bestStratIdx] && (
                    <div className="mt-5">
                      <div className="flex h-8 rounded-xl overflow-hidden gap-[2px]">
                        {syncStrategyLaps(strategies[bestStratIdx]).stints.map((stint, i, arr) => (
                          <StintBar
                            key={stint.id}
                            stint={stint}
                            pct={stint.laps / totalLaps}
                            index={i}
                            totalStints={arr.length}
                            hovered={false}
                            totalLaps={totalLaps}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ── STRATEGY TIMELINE VISUALIZATION ── */}
              <motion.div
                className="relative rounded-2xl overflow-hidden border"
                style={{ background: F1.card, borderColor: F1.hairline }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 }}
              >
                <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg,${F1.red},${F1.orange},transparent)` }} />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <p className="f-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">Strategy Timeline</p>
                    {/* Compound legend */}
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      {(["SOFT","MEDIUM","HARD","INTERMEDIATE","WET"] as TyreType[]).map(k => {
                        const spec = tyre(k);
                        return (
                          <div key={k} className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center f-cond font-black text-[10px] flex-shrink-0"
                              style={{ background: spec.color, color: spec.color === "#EDEDED" ? "#111" : "#000" }}
                            >
                              {spec.letter}
                            </div>
                            <span className="f-mono text-[9px] text-zinc-500 hidden sm:block">{spec.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {strategies.map((strategy, sIdx) => {
                      const synced    = syncStrategyLaps(strategy);
                      const raceTime  = calcRaceTime(synced.stints, baseLapTime);
                      const isBest    = sIdx === bestStratIdx;
                      const isHov     = hoveredStrat === strategy.id;
                      const gap       = raceTime - minTime;
                      const col       = strategy.color;

                      return (
                        <motion.div
                          key={strategy.id}
                          onMouseEnter={() => setHoveredStrat(strategy.id)}
                          onMouseLeave={() => setHoveredStrat(null)}
                          className="group cursor-default"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, delay: 0.3 + sIdx * 0.08 }}
                        >
                          {/* Row header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <motion.div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: col }}
                                animate={{ boxShadow: isHov ? `0 0 10px ${col}` : `0 0 4px ${col}60` }}
                              />
                              <span className="f-cond font-black text-sm text-white">{strategy.name}</span>
                              {isBest && (
                                <span className="f-mono text-[9px] px-1.5 py-0.5 rounded font-bold"
                                  style={{ color: col, background: `${col}22`, border: `1px solid ${col}44` }}>
                                  BEST
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="f-mono text-xs font-bold text-white tabular-nums">{formatTime(raceTime)}</span>
                              {gap > 0 && (
                                <span className="f-mono text-[10px] text-zinc-600 tabular-nums">+{gap.toFixed(1)}s</span>
                              )}
                            </div>
                          </div>

                          {/* Timeline bar */}
                          <div
                            className="flex h-10 rounded-xl overflow-hidden transition-all duration-200"
                            style={{ filter: isHov ? "brightness(1.1)" : "brightness(1)", outline: isHov ? `1px solid ${col}60` : "none" }}
                          >
                            {synced.stints.map((stint, i) => (
                              <StintBar
                                key={stint.id}
                                stint={stint}
                                pct={stint.laps / totalLaps}
                                index={i}
                                totalStints={synced.stints.length}
                                hovered={isHov}
                                totalLaps={totalLaps}
                              />
                            ))}
                          </div>

                          {/* Lap axis */}
                          <LapAxis totalLaps={totalLaps} />

                          {/* Stint breakdown pills */}
                          <div className="flex gap-3 flex-wrap mt-2">
                            {synced.stints.map((stint, i) => {
                              const spec = tyre(stint.tyre);
                              return (
                                <div key={stint.id} className="flex items-center gap-1.5 text-xs">
                                  <div
                                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                    style={{ background: spec.color }}
                                  />
                                  <span className="f-mono font-bold text-zinc-300" style={{ color: spec.color === "#EDEDED" ? "#ccc" : spec.color }}>
                                    {spec.label}
                                  </span>
                                  <span className="f-mono text-zinc-500">{stint.laps}L</span>
                                  <span className="f-mono text-zinc-700">{formatTime(calcStintTime(stint, baseLapTime))}</span>
                                  {i < synced.stints.length - 1 && (
                                    <span className="text-zinc-700 text-[10px]">⬝ PIT</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {sIdx < strategies.length - 1 && (
                            <div className="mt-4 h-px" style={{ background: F1.hairline }} />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              {/* ── TIME DELTA TABLE ── */}
              <motion.div
                className="relative rounded-2xl overflow-hidden border"
                style={{ background: F1.card, borderColor: F1.hairline }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.35 }}
              >
                <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg,${F1.gold},transparent)` }} />
                <div className="px-6 py-4 border-b" style={{ borderColor: F1.hairline }}>
                  <p className="f-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">Time Delta</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${F1.hairline}` }}>
                        {["Strategy", "Stops", "Compounds", "Race Time", "Delta"].map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 px-4 f-mono text-[10px] tracking-widest text-zinc-600 uppercase ${i >= 3 ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {strategies.map((strategy, sIdx) => {
                        const synced   = syncStrategyLaps(strategy);
                        const raceTime = calcRaceTime(synced.stints, baseLapTime);
                        const gap      = raceTime - minTime;
                        const isBest   = sIdx === bestStratIdx;
                        const col      = strategy.color;

                        return (
                          <motion.tr
                            key={strategy.id}
                            className="transition-colors duration-150 hover:bg-white/[0.025]"
                            style={{ borderBottom: `1px solid ${F1.hairline}` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.45 + sIdx * 0.05 }}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col, boxShadow: `0 0 5px ${col}80` }} />
                                <span className="f-cond font-black text-sm text-white">{strategy.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="f-mono text-sm text-zinc-400">{synced.stints.length - 1}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex gap-1">
                                {synced.stints.map(s => {
                                  const spec = tyre(s.tyre);
                                  return (
                                    <span
                                      key={s.id}
                                      className="f-cond font-black text-xs w-5 h-5 rounded flex items-center justify-center"
                                      style={{
                                        background: spec.color,
                                        color: spec.color === "#EDEDED" ? "#111" : "#000",
                                      }}
                                    >
                                      {spec.letter}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="f-mono text-sm font-bold text-white tabular-nums">{formatTime(raceTime)}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className="f-mono text-sm font-black tabular-nums"
                                style={{ color: isBest ? F1.green : F1.red }}
                              >
                                {isBest ? "FASTEST" : `+${gap.toFixed(1)}s`}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* ── INFO NOTE ── */}
              <motion.div
                className="rounded-xl border px-5 py-3.5"
                style={{ background: "rgba(255,255,255,0.025)", borderColor: F1.hairline }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.55 }}
              >
                <p className="f-mono text-[10px] text-zinc-600 tracking-wide">
                  Base lap = circuit record + 2 s · Pit stop loss = {PIT_LOSS}s · Tyre degradation modelled as linear per lap · Last stint auto-fills to complete race distance
                </p>
              </motion.div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
