"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { tyre as tyreSpec } from "../lib/f1-theme";
import type { TrackSample } from "../types/f1";

/**
 * A modelled reading for one corner of the car.
 *
 * No public feed publishes per-wheel tyre data — OpenF1 and the timing feeds carry a single bulk
 * temperature per car and nothing else — so the four corners here are a model, not measurements.
 * What the model is fed is real: the measured bulk temperature, the stint age, and the circuit's
 * own corner balance read off a traced lap. The panel says so on its face.
 */
interface WheelThermalData {
  inner: number;
  middle: number;
  outer: number;
  /** Share of the lap's load this corner of the car carries, 0–1. */
  loadShare: number;
  wearPct: number;
}

interface TyreThermalDisplayProps {
  compound?: string;
  /** Bulk tyre temperature from the live feed — the one temperature that is actually measured. */
  measuredTempC?: number;
  tyreAge?: number;
  driverName?: string;
  /**
   * The circuit's traced lap. Its corner balance decides which side of the car works hardest, and
   * its braking-to-traction split decides how the load falls between front and rear.
   */
  trace?: TrackSample[];
  className?: string;
}

/** Representative stint lengths per compound, used to turn stint age into remaining tread. */
const COMPOUND_LIFE_LAPS: Record<string, number> = {
  SOFT: 20, MEDIUM: 30, HARD: 40, INTERMEDIATE: 25, INTER: 25, WET: 30,
};

/** How far the hardest-worked corner runs from the measured bulk temperature, in °C. */
const TEMP_SPREAD = 6;

function getThermalColor(temp: number): { color: string; status: string } {
  if (temp < 88) return { color: "#3B82F6", status: "COLD" };
  if (temp <= 104) return { color: "#00E676", status: "OPTIMAL" };
  if (temp <= 112) return { color: "#FACC15", status: "WARM" };
  if (temp <= 120) return { color: "#FB923C", status: "HOT" };
  return { color: "#EF4444", status: "OVERHEAT" };
}

/**
 * How the lap divides its work between the two sides and the two ends of the car.
 *
 * Right-hand corners load the left-hand tyres and braking loads the front, so the shares below are
 * read straight off the traced lap: the cornering load in each direction, and the split between
 * time spent slowing down and time spent accelerating.
 */
function loadBalance(trace: TrackSample[]) {
  let leftCorners = 0;
  let rightCorners = 0;
  let braking = 0;
  let traction = 0;

  for (const s of trace) {
    if (s.lateralG >= 0) rightCorners += s.lateralG;
    else leftCorners += -s.lateralG;
    if (s.longitudinalG < 0) braking += -s.longitudinalG;
    else traction += s.longitudinalG;
  }

  const cornering = leftCorners + rightCorners;
  const longitudinal = braking + traction;
  if (cornering <= 0 || longitudinal <= 0) {
    return { left: 0.5, right: 0.5, front: 0.5, rear: 0.5, measured: false };
  }

  return {
    // A right-hander leans the car onto its left-hand tyres, hence the crossover.
    left: rightCorners / cornering,
    right: leftCorners / cornering,
    front: braking / longitudinal,
    rear: traction / longitudinal,
    measured: true,
  };
}

function SingleWheel({
  label,
  position,
  data,
  specColor,
}: {
  label: string;
  position: "FL" | "FR" | "RL" | "RR";
  data: WheelThermalData;
  specColor: string;
}) {
  const innerInfo = getThermalColor(data.inner);
  const midInfo = getThermalColor(data.middle);
  const outerInfo = getThermalColor(data.outer);
  const avgTemp = Math.round((data.inner + data.middle + data.outer) / 3);
  const avgInfo = getThermalColor(avgTemp);

  return (
    <div className="flex flex-col items-center p-3 rounded-2xl bg-black/60 border border-zinc-800/80">
      <div className="w-full flex items-center justify-between text-[10px] f-mono font-bold mb-2">
        <span className="text-white px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
          {position}
        </span>
        <span className="text-zinc-400">{label}</span>
        <span style={{ color: avgInfo.color }} className="font-black">
          {avgInfo.status}
        </span>
      </div>

      <div className="relative w-28 h-20 bg-zinc-950 rounded-xl border border-zinc-800 p-1.5 flex flex-col justify-between shadow-inner">
        {/* Compound Ring accent */}
        <div
          className="absolute -top-1 left-2 right-2 h-1 rounded-full opacity-80"
          style={{ backgroundColor: specColor, boxShadow: `0 0 8px ${specColor}` }}
        />

        {/* 3 Bands: Inner, Middle, Outer */}
        <div className="grid grid-cols-3 gap-1 h-10 w-full rounded-lg overflow-hidden border border-zinc-900">
          <div
            className="flex flex-col items-center justify-center text-[9px] f-mono font-bold transition-colors duration-500"
            style={{ backgroundColor: innerInfo.color, color: "#000" }}
            title={`Inner: ${data.inner}°C`}
          >
            <span>{data.inner}°</span>
            <span className="text-[7px] opacity-75">IN</span>
          </div>

          <div
            className="flex flex-col items-center justify-center text-[9px] f-mono font-bold transition-colors duration-500"
            style={{ backgroundColor: midInfo.color, color: "#000" }}
            title={`Middle: ${data.middle}°C`}
          >
            <span>{data.middle}°</span>
            <span className="text-[7px] opacity-75">MID</span>
          </div>

          <div
            className="flex flex-col items-center justify-center text-[9px] f-mono font-bold transition-colors duration-500"
            style={{ backgroundColor: outerInfo.color, color: "#000" }}
            title={`Outer: ${data.outer}°C`}
          >
            <span>{data.outer}°</span>
            <span className="text-[7px] opacity-75">OUT</span>
          </div>
        </div>

        {/* Share of the lap's load this corner carries */}
        <div className="flex items-center justify-between text-[9px] f-mono text-zinc-400 px-1 pt-1">
          <span className="text-zinc-500">LOAD SHARE</span>
          <span className="font-bold text-white">{Math.round(data.loadShare * 100)}%</span>
        </div>
      </div>

      {/* Wear Bar */}
      <div className="w-full mt-2 space-y-1">
        <div className="flex items-center justify-between text-[9px] f-mono text-zinc-500">
          <span>TREAD LEFT</span>
          <span className="font-bold text-white">{data.wearPct}%</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: data.wearPct > 60 ? "#00E676" : data.wearPct > 35 ? "#FACC15" : "#EF4444",
            }}
            initial={{ width: "100%" }}
            animate={{ width: `${data.wearPct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>
    </div>
  );
}

export default function TyreThermalDisplay({
  compound = "SOFT",
  measuredTempC = 100,
  tyreAge = 0,
  driverName,
  trace = [],
  className = "",
}: TyreThermalDisplayProps) {
  const spec = tyreSpec(compound);
  const balance = useMemo(() => loadBalance(trace), [trace]);

  const wheels = useMemo(() => {
    const life = COMPOUND_LIFE_LAPS[(compound || "").toUpperCase()] ?? 30;

    const build = (side: number, end: number): WheelThermalData => {
      // Both shares sit either side of a half; averaging them keeps the neutral case neutral.
      const loadShare = (side + end) / 2;
      const middle = Math.round(measuredTempC + TEMP_SPREAD * (loadShare - 0.5) * 2);
      // The inside shoulder does the cornering work, so it runs hottest on the busiest corners.
      const shoulder = Math.round(1 + 5 * loadShare);

      // A harder-worked corner wears through its stint faster than a lightly loaded one.
      const used = (tyreAge / life) * (0.8 + 0.4 * loadShare * 2);

      return {
        inner: middle + shoulder,
        middle,
        outer: middle - shoulder,
        loadShare,
        wearPct: Math.max(0, Math.min(100, Math.round(100 * (1 - used)))),
      };
    };

    return {
      fl: build(balance.left, balance.front),
      fr: build(balance.right, balance.front),
      rl: build(balance.left, balance.rear),
      rr: build(balance.right, balance.rear),
    };
  }, [balance, compound, measuredTempC, tyreAge]);

  return (
    <div className={`p-5 rounded-3xl bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black f-cond text-sm border"
            style={{
              backgroundColor: `${spec.color}20`,
              borderColor: spec.color,
              color: spec.color,
            }}
          >
            {spec.letter}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="f-cond font-black text-sm uppercase text-white tracking-wider">
                4-WHEEL TYRE THERMAL MODEL
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-700/60 text-[10px] f-mono font-bold text-amber-400">
                MODELLED
              </span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-[10px] f-mono font-bold text-zinc-400">
                {compound} · {tyreAge} LAPS
              </span>
            </div>
            {driverName && (
              <p className="text-[10px] f-mono text-zinc-500">
                Bulk temperature {Math.round(measuredTempC)}°C · {driverName}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[9px] f-mono text-zinc-500 uppercase block">OPTIMAL WINDOW</span>
          <span className="text-xs f-mono font-bold text-emerald-400">95°C – 105°C</span>
        </div>
      </div>

      {/* 4 Wheels Grid Layout (Front Top, Rear Bottom) */}
      <div className="relative grid grid-cols-2 gap-4">
        {/* Car chassis silhouette outline in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-12 h-36 border-2 border-dashed border-zinc-600 rounded-2xl flex flex-col items-center justify-between py-2">
            <span className="text-[8px] f-mono text-zinc-400 font-bold">FRONT</span>
            <div className="w-6 h-0.5 bg-zinc-600" />
            <span className="text-[8px] f-mono text-zinc-400 font-bold">REAR</span>
          </div>
        </div>

        <SingleWheel label="Front Left" position="FL" data={wheels.fl} specColor={spec.color} />
        <SingleWheel label="Front Right" position="FR" data={wheels.fr} specColor={spec.color} />
        <SingleWheel label="Rear Left" position="RL" data={wheels.rl} specColor={spec.color} />
        <SingleWheel label="Rear Right" position="RR" data={wheels.rr} specColor={spec.color} />
      </div>

      <p className="mt-4 pt-3 border-t border-zinc-800/60 f-mono text-[9px] text-zinc-500 leading-relaxed">
        No public feed publishes per-wheel tyre data. These four corners are modelled from the
        measured bulk temperature, the stint age, and{" "}
        {balance.measured
          ? "this circuit's own corner balance, read off a traced lap."
          : "an even load split — no traced lap is available for this circuit."}{" "}
        Treat them as an estimate, not a reading.
      </p>
    </div>
  );
}
