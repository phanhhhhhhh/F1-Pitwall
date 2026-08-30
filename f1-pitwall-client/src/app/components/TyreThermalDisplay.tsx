"use client";

import { motion } from "framer-motion";
import { tyre as tyreSpec } from "../lib/f1-theme";

interface WheelThermalData {
  inner: number;
  middle: number;
  outer: number;
  carcass: number;
  pressurePsi: number;
  wearPct: number;
}

interface TyreThermalDisplayProps {
  compound?: string;
  baseTemp?: number;
  tyreAge?: number;
  driverName?: string;
  className?: string;
}

function getThermalColor(temp: number): { color: string; status: string } {
  if (temp < 88) return { color: "#3B82F6", status: "COLD" };
  if (temp <= 104) return { color: "#00E676", status: "OPTIMAL" };
  if (temp <= 112) return { color: "#FACC15", status: "WARM" };
  if (temp <= 120) return { color: "#FB923C", status: "HOT" };
  return { color: "#EF4444", status: "OVERHEAT" };
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

      {/* 3D-styled Tyre Cross-section with 3 thermal bands */}
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

        {/* Pressure & Carcass */}
        <div className="flex items-center justify-between text-[9px] f-mono text-zinc-400 px-1 pt-1">
          <span>{data.pressurePsi} PSI</span>
          <span className="text-zinc-500">CARC: {data.carcass}°C</span>
        </div>
      </div>

      {/* Wear Bar */}
      <div className="w-full mt-2 space-y-1">
        <div className="flex items-center justify-between text-[9px] f-mono text-zinc-500">
          <span>TREAD WEAR</span>
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
  baseTemp = 101,
  tyreAge = 12,
  driverName,
  className = "",
}: TyreThermalDisplayProps) {
  const spec = tyreSpec(compound);

  // Simulated 4-corner tyre physics based on baseTemp and tyre age
  const wear = Math.max(15, 100 - tyreAge * 3.8);

  const fl: WheelThermalData = {
    inner: baseTemp + 4,
    middle: baseTemp + 1,
    outer: baseTemp - 2,
    carcass: baseTemp + 2,
    pressurePsi: 23.2,
    wearPct: Math.round(wear - 3),
  };

  const fr: WheelThermalData = {
    inner: baseTemp + 5,
    middle: baseTemp + 3,
    outer: baseTemp,
    carcass: baseTemp + 3,
    pressurePsi: 23.4,
    wearPct: Math.round(wear - 5),
  };

  const rl: WheelThermalData = {
    inner: baseTemp + 2,
    middle: baseTemp - 1,
    outer: baseTemp - 3,
    carcass: baseTemp,
    pressurePsi: 21.8,
    wearPct: Math.round(wear + 2),
  };

  const rr: WheelThermalData = {
    inner: baseTemp + 3,
    middle: baseTemp,
    outer: baseTemp - 2,
    carcass: baseTemp + 1,
    pressurePsi: 22.0,
    wearPct: Math.round(wear),
  };

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
            <div className="flex items-center gap-2">
              <h3 className="f-cond font-black text-sm uppercase text-white tracking-wider">
                4-WHEEL TYRE THERMAL MATRIX
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-[10px] f-mono font-bold text-zinc-400">
                {compound} · {tyreAge} LAPS
              </span>
            </div>
            {driverName && <p className="text-[10px] f-mono text-zinc-500">Live telemetry: {driverName}</p>}
          </div>
        </div>

        {/* Operating Window Badge */}
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

        {/* Front Left */}
        <SingleWheel label="Front Left" position="FL" data={fl} specColor={spec.color} />

        {/* Front Right */}
        <SingleWheel label="Front Right" position="FR" data={fr} specColor={spec.color} />

        {/* Rear Left */}
        <SingleWheel label="Rear Left" position="RL" data={rl} specColor={spec.color} />

        {/* Rear Right */}
        <SingleWheel label="Rear Right" position="RR" data={rr} specColor={spec.color} />
      </div>
    </div>
  );
}
