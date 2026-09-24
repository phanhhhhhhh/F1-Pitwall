"use client";

import { motion } from "framer-motion";
import { tyre } from "../lib/f1-theme";
import type { Stint, TyrePerfTable, TyreType } from "./model";

// ─── sub-components ───────────────────────────────────────────────────────────

/** Single animated stint bar segment */
export function StintBar({
  stint, pct, index, totalStints, hovered,
}: {
  stint: Stint; pct: number; index: number; totalStints: number; hovered: boolean;
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
export function LapAxis({ totalLaps }: { totalLaps: number }) {
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
export function CompoundChip({ tyreKey, perfTable }: { tyreKey: string; perfTable: TyrePerfTable }) {
  const spec = tyre(tyreKey);
  const perf = perfTable[tyreKey as TyreType];
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
