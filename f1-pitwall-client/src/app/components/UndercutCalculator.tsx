"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

export default function UndercutCalculator({ className = "" }: { className?: string }) {
  // Inputs
  const [initialGap, setInitialGap] = useState(1.8); // Seconds behind leader
  const [freshTyreAdvantage, setFreshTyreAdvantage] = useState(1.4); // s/lap faster on fresh rubber
  const [wornTyreDeg, setWornTyreDeg] = useState(0.5); // s/lap lost on old tyres
  const [leaderResponseLaps, setLeaderResponseLaps] = useState(1); // Laps before leader pits
  const [pitLossMode, setPitLossMode] = useState<"GREEN" | "VSC" | "SC">("GREEN");

  const pitLossSec = pitLossMode === "GREEN" ? 22.0 : pitLossMode === "VSC" ? 12.0 : 9.5;

  // Calculation:
  // Car A (Chaser) pits at Lap 0.
  // Car A loses pitLossSec on Lap 0, but gains freshTyreAdvantage on Out-Lap and subsequent laps.
  // Car B (Leader) stays out for leaderResponseLaps, losing wornTyreDeg each lap, then pits losing pitLossSec.
  const result = useMemo(() => {
    // Delta gained by Chaser over response laps:
    // Total pace delta per lap = freshTyreAdvantage + wornTyreDeg
    const paceDeltaPerLap = freshTyreAdvantage + wornTyreDeg;
    const totalPaceGained = paceDeltaPerLap * leaderResponseLaps;

    // When both cars have completed their stops:
    // Net Delta = totalPaceGained - initialGap
    const netDelta = totalPaceGained - initialGap;
    const isSuccessful = netDelta > 0;

    return {
      netDelta: Math.abs(netDelta),
      isSuccessful,
      totalPaceGained,
      pitLossSec,
    };
  }, [initialGap, freshTyreAdvantage, wornTyreDeg, leaderResponseLaps, pitLossSec]);

  return (
    <div className={`p-5 rounded-3xl bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-xl ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#E10600]" />
            <h3 className="f-cond font-black text-sm uppercase text-white tracking-wider">
              UNDERCUT & PIT WINDOW DELTA CALCULATOR
            </h3>
          </div>
          <p className="f-mono text-[10px] text-zinc-400">
            Real-time track position & delta calculator for proactive undercut or overcut pit strategy calls
          </p>
        </div>

        {/* Flag Condition Tabs */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800">
          {[
            { id: "GREEN", label: "🟢 GREEN FLAG (22s)" },
            { id: "VSC", label: "🟡 VSC (12s)" },
            { id: "SC", label: "🟠 SAFETY CAR (9.5s)" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setPitLossMode(f.id as typeof pitLossMode)}
              className={`px-2.5 py-1 rounded-lg f-mono text-[10px] font-bold uppercase transition-all ${
                pitLossMode === f.id
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Outcome Verdict Banner */}
      <div
        className={`p-4 rounded-2xl border mb-6 flex items-center justify-between flex-wrap gap-4 transition-all ${
          result.isSuccessful
            ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
            : "bg-red-950/40 border-red-500/50 text-red-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{result.isSuccessful ? "🚀" : "⛔"}</span>
          <div>
            <span className="text-[10px] f-mono font-bold uppercase tracking-wider block opacity-75">
              STRATEGY SIMULATION VERDICT
            </span>
            <h4 className="text-xl sm:text-2xl font-black f-cond uppercase text-white">
              {result.isSuccessful ? "SUCCESSFUL UNDERCUT" : "UNDERCUT ATTEMPT DEFENDED"}
            </h4>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] f-mono uppercase block opacity-75">PROJECTED TRACK POSITION</span>
          <span
            className={`text-xl f-cond font-black ${
              result.isSuccessful ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {result.isSuccessful
              ? `CHASER AHEAD BY +${result.netDelta.toFixed(3)}S`
              : `CHASER REMAINS BEHIND BY -${result.netDelta.toFixed(3)}S`}
          </span>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Initial Gap */}
        <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
          <div className="flex items-center justify-between text-xs f-mono mb-2">
            <span className="text-zinc-400">GAP TO LEADER</span>
            <span className="font-black text-amber-400">{initialGap.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="6.0"
            step="0.1"
            value={initialGap}
            onChange={(e) => setInitialGap(parseFloat(e.target.value))}
            className="w-full accent-red-600 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="text-[9px] f-mono text-zinc-600 block mt-1">Car A distance behind Car B</span>
        </div>

        {/* Fresh Tyre Delta */}
        <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
          <div className="flex items-center justify-between text-xs f-mono mb-2">
            <span className="text-zinc-400">OUT-LAP ADVANTAGE</span>
            <span className="font-black text-emerald-400">+{freshTyreAdvantage.toFixed(1)}s/lap</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={freshTyreAdvantage}
            onChange={(e) => setFreshTyreAdvantage(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="text-[9px] f-mono text-zinc-600 block mt-1">Grip benefit of new compound</span>
        </div>

        {/* Old Tyre Degradation */}
        <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
          <div className="flex items-center justify-between text-xs f-mono mb-2">
            <span className="text-zinc-400">OLD TYRE DEG LOSS</span>
            <span className="font-black text-red-400">-{wornTyreDeg.toFixed(1)}s/lap</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={wornTyreDeg}
            onChange={(e) => setWornTyreDeg(parseFloat(e.target.value))}
            className="w-full accent-red-500 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="text-[9px] f-mono text-zinc-600 block mt-1">Drop-off on leader&apos;s worn rubber</span>
        </div>

        {/* Leader Response Laps */}
        <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800">
          <div className="flex items-center justify-between text-xs f-mono mb-2">
            <span className="text-zinc-400">LEADER RESPONSE</span>
            <span className="font-black text-cyan-400">{leaderResponseLaps} {leaderResponseLaps === 1 ? "LAP" : "LAPS"}</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={leaderResponseLaps}
            onChange={(e) => setLeaderResponseLaps(parseInt(e.target.value))}
            className="w-full accent-cyan-500 bg-zinc-800 rounded-lg cursor-pointer"
          />
          <span className="text-[9px] f-mono text-zinc-600 block mt-1">Laps Car B stays out before pitting</span>
        </div>
      </div>

      {/* Visual Rejoin Delta Bar */}
      <div className="p-4 rounded-2xl bg-black/60 border border-zinc-800/80">
        <div className="flex items-center justify-between text-xs f-mono mb-3">
          <span className="text-zinc-400 font-bold uppercase">REJOINING TRACK PROJECTION</span>
          <span className="text-zinc-500">Pit Loss: {pitLossSec.toFixed(1)}s</span>
        </div>

        <div className="relative h-10 w-full bg-zinc-950 rounded-xl border border-zinc-800 p-1 flex items-center overflow-hidden">
          {/* Track line */}
          <div className="absolute inset-x-0 h-1 bg-zinc-800" />

          {/* Car A (Chaser) */}
          <motion.div
            className="absolute flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 text-white font-bold f-cond text-xs shadow-[0_0_12px_rgba(225,6,0,0.6)] z-10"
            animate={{
              left: result.isSuccessful ? "58%" : "34%",
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span>🏎️ CAR A (CHASER)</span>
          </motion.div>

          {/* Car B (Leader) */}
          <motion.div
            className="absolute flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-700 text-white font-bold f-cond text-xs shadow-md z-10"
            animate={{
              left: result.isSuccessful ? "38%" : "52%",
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span>🏎️ CAR B (LEADER)</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
