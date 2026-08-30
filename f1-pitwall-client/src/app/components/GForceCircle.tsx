"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrackSample } from "../types/f1";

interface GForceCircleProps {
  /**
   * The lap to play back, one entry per point of the circuit's racing line. Both G axes come from
   * the trace: lateral from how tightly the line curves where the car was, longitudinal from how
   * the speed changed along it. Without a trace the widget says so rather than animating a
   * plausible-looking one.
   */
  trace?: TrackSample[];
  /** Where the lap came from, so what is on screen stays attributable. */
  sourceLabel?: string;
  size?: number;
  className?: string;
}

/** How long each point of the lap is held on screen. */
const STEP_MS = 110;
/** Points of history drawn behind the marker. */
const TRAIL_LENGTH = 14;

export default function GForceCircle({
  trace = [],
  sourceLabel,
  size = 260,
  className = "",
}: GForceCircleProps) {
  const center = size / 2;
  const radius = size * 0.42;
  const [cursor, setCursor] = useState(0);

  /**
   * The rings are scaled to the lap rather than to a fixed maximum, so a street circuit's trace
   * fills the circle instead of huddling in the middle of one drawn for a high-speed track.
   */
  const { peakLateral, peakBraking, peakAccel, maxG } = useMemo(() => {
    let lateral = 0;
    let braking = 0;
    let accel = 0;
    for (const s of trace) {
      lateral = Math.max(lateral, Math.abs(s.lateralG));
      braking = Math.max(braking, -s.longitudinalG);
      accel = Math.max(accel, s.longitudinalG);
    }
    return {
      peakLateral: lateral,
      peakBraking: braking,
      peakAccel: accel,
      maxG: Math.max(1, Math.ceil(Math.max(lateral, braking, accel))),
    };
  }, [trace]);

  useEffect(() => {
    if (trace.length === 0) return;
    const id = setInterval(() => setCursor((c) => c + 1), STEP_MS);
    return () => clearInterval(id);
  }, [trace.length]);

  // The cursor counts on without bound and is wrapped on read, so a trace that changes length
  // mid-playback lands somewhere valid instead of needing to be reset from an effect.
  const position = trace.length === 0 ? 0 : cursor % trace.length;

  const trail = useMemo(() => {
    if (trace.length === 0) return [];
    const depth = Math.min(TRAIL_LENGTH, trace.length);
    return Array.from({ length: depth }, (_, k) => {
      const index = (position - (depth - 1 - k) + trace.length * 2) % trace.length;
      return { index, sample: trace[index], fade: (k + 1) / depth };
    });
  }, [trace, position]);

  const current = trace[position];

  const coordsOf = (latG: number, longG: number) => ({
    x: center + (latG / maxG) * radius,
    // Inverted so acceleration goes up and braking goes down, as a driver would read it.
    y: center - (longG / maxG) * radius,
  });

  if (trace.length === 0) {
    return (
      <div
        className={`p-4 rounded-3xl bg-zinc-950/90 border border-zinc-800 shadow-2xl flex flex-col items-center justify-center backdrop-blur-xl ${className}`}
        style={{ minHeight: size }}
      >
        <span className="text-2xl mb-2 opacity-40">◎</span>
        <h3 className="f-cond font-black text-xs uppercase tracking-wider text-zinc-400">
          G-FORCE TRACTION CIRCLE
        </h3>
        <p className="f-mono text-[10px] text-zinc-600 mt-2 text-center max-w-[220px]">
          No lap telemetry recorded for this circuit, so there are no loads to plot.
        </p>
      </div>
    );
  }

  const marker = coordsOf(current.lateralG, current.longitudinalG);

  return (
    <div
      className={`p-4 rounded-3xl bg-zinc-950/90 border border-zinc-800 shadow-2xl flex flex-col items-center backdrop-blur-xl ${className}`}
    >
      <div className="w-full flex items-center justify-between mb-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22D3EE]" />
          <h3 className="f-cond font-black text-xs uppercase tracking-wider text-white">
            G-FORCE TRACTION CIRCLE
          </h3>
        </div>
        <span className="f-mono text-[10px] text-cyan-400 font-bold">KAMM&apos;S DIAGRAM</span>
      </div>

      <div className="relative">
        <svg width={size} height={size} className="overflow-visible select-none">
          <defs>
            <radialGradient id="gCircleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={center} cy={center} r={radius} fill="url(#gCircleGlow)" />

          {/* One ring per G, out to the hardest load this lap recorded */}
          {Array.from({ length: maxG }, (_, i) => i + 1).map((g) => {
            const r = (g / maxG) * radius;
            return (
              <g key={g}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={g === maxG ? "1.5" : "1"}
                  strokeDasharray={g === maxG ? undefined : "3 3"}
                />
                <text
                  x={center + 3}
                  y={center - r + 9}
                  fill="rgba(255,255,255,0.3)"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {g}G
                </text>
              </g>
            );
          })}

          <line
            x1={center - radius}
            y1={center}
            x2={center + radius}
            y2={center}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />
          <line
            x1={center}
            y1={center - radius}
            x2={center}
            y2={center + radius}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />

          <text
            x={center}
            y={center - radius - 8}
            textAnchor="middle"
            fill="#22D3EE"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            ACCEL (+G)
          </text>
          <text
            x={center}
            y={center + radius + 14}
            textAnchor="middle"
            fill="#EF4444"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            BRAKE (-G)
          </text>
          <text
            x={center - radius - 6}
            y={center + 3}
            textAnchor="end"
            fill="#A1A1AA"
            fontSize="8"
            fontFamily="monospace"
            fontWeight="bold"
          >
            LEFT
          </text>
          <text
            x={center + radius + 6}
            y={center + 3}
            textAnchor="start"
            fill="#A1A1AA"
            fontSize="8"
            fontFamily="monospace"
            fontWeight="bold"
          >
            RIGHT
          </text>

          {trail.map((point) => {
            const coords = coordsOf(point.sample.lateralG, point.sample.longitudinalG);
            return (
              <circle
                key={point.index}
                cx={coords.x}
                cy={coords.y}
                r="2.5"
                fill="#22D3EE"
                opacity={point.fade * 0.45}
              />
            );
          })}

          <circle
            cx={marker.x}
            cy={marker.y}
            r="8"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.5"
            className="animate-ping opacity-75"
          />
          <circle
            cx={marker.x}
            cy={marker.y}
            r="5"
            fill="#22D3EE"
            stroke="#000"
            strokeWidth="1.5"
            style={{ filter: "drop-shadow(0 0 8px #22D3EE)" }}
          />
        </svg>
      </div>

      <div className="w-full grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-zinc-800/80 text-center text-xs f-mono">
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">
            Lateral {current.lateralG >= 0 ? "R" : "L"}
          </span>
          <span className="font-black text-cyan-400">
            {Math.abs(current.lateralG).toFixed(2)}G
          </span>
        </div>
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">Longitudinal</span>
          <span
            className={`font-black ${
              current.longitudinalG < 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {current.longitudinalG.toFixed(2)}G
          </span>
        </div>
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">Speed</span>
          <span className="font-black text-white">
            {Math.round(current.speedKmh)}
            <span className="text-[8px] text-zinc-500"> KM/H</span>
          </span>
        </div>
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">Lap peaks</span>
          <span className="font-black text-amber-400">
            {peakLateral.toFixed(1)}
            <span className="text-zinc-600">/</span>
            {peakBraking.toFixed(1)}
            <span className="text-zinc-600">/</span>
            {peakAccel.toFixed(1)}
          </span>
        </div>
      </div>

      <p className="w-full mt-2 pt-2 border-t border-zinc-800/60 f-mono text-[9px] text-zinc-600 leading-relaxed">
        {sourceLabel ? `${sourceLabel}. ` : ""}
        Loads derived from the racing line — points sit tens of metres apart, so the tightest
        corners read lower than the car actually pulled.
      </p>
    </div>
  );
}
