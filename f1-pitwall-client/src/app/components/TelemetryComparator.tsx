"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getTeamColor } from "../lib/f1-theme";

interface DriverOption {
  id: string;
  name: string;
  team: string;
  carNumber: number;
}

const AVAILABLE_DRIVERS: DriverOption[] = [
  { id: "1", name: "Max Verstappen", team: "Red Bull Racing", carNumber: 1 },
  { id: "4", name: "Lando Norris", team: "McLaren", carNumber: 4 },
  { id: "16", name: "Charles Leclerc", team: "Ferrari", carNumber: 16 },
  { id: "44", name: "Lewis Hamilton", team: "Ferrari", carNumber: 44 },
  { id: "81", name: "Oscar Piastri", team: "McLaren", carNumber: 81 },
  { id: "63", name: "George Russell", team: "Mercedes-AMG Petronas", carNumber: 63 },
  { id: "14", name: "Fernando Alonso", team: "Aston Martin", carNumber: 14 },
  { id: "55", name: "Carlos Sainz", team: "Williams", carNumber: 55 },
];

export default function TelemetryComparator() {
  const [driverAId, setDriverAId] = useState<string>("1");
  const [driverBId, setDriverBId] = useState<string>("16");
  const [metric, setMetric] = useState<"speed" | "throttle" | "brake">("speed");

  const driverA = AVAILABLE_DRIVERS.find((d) => d.id === driverAId) || AVAILABLE_DRIVERS[0];
  const driverB = AVAILABLE_DRIVERS.find((d) => d.id === driverBId) || AVAILABLE_DRIVERS[2];

  const colorA = getTeamColor(driverA.team);
  const colorB = getTeamColor(driverB.team);

  // Generate 40 simulated track distance points for telemetry comparison
  const telemetryData = Array.from({ length: 40 }).map((_, i) => {
    const dist = (i * 140).toFixed(0);
    // Base speed profile with 3 braking zones
    const phase = i % 13;
    const isBraking = phase >= 3 && phase <= 6;
    const speedBase = isBraking ? 130 + (phase - 3) * 15 : 290 + (phase - 7) * 8;

    const speedA = Math.round(speedBase + Math.sin(i * 0.8) * 6);
    const speedB = Math.round(speedBase + Math.cos(i * 0.7) * 7);

    const throttleA = isBraking ? 0 : Math.min(100, Math.round(70 + Math.sin(i) * 30));
    const throttleB = isBraking ? 0 : Math.min(100, Math.round(65 + Math.cos(i) * 35));

    const brakeA = isBraking ? Math.round(85 + Math.sin(i) * 15) : 0;
    const brakeB = isBraking ? Math.round(92 + Math.cos(i) * 8) : 0;

    const delta = Number((((speedA - speedB) / 300) * 0.4).toFixed(3));

    return {
      distance: `${dist}m`,
      speedA,
      speedB,
      throttleA,
      throttleB,
      brakeA,
      brakeB,
      delta,
    };
  });

  return (
    <div className="w-full bg-gradient-to-b from-[#121319] to-[#090a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden">
      {/* Header & Selectors */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-800">
        <div>
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 live-pulse" />
            TELEMETRY GHOST COMPARATOR (H2H)
          </h3>
          <p className="text-xs text-zinc-400 f-mono">
            Synchronized apex speed, throttle application, and delta trace
          </p>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-zinc-800">
          {(["speed", "throttle", "brake"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 text-xs font-bold f-orbitron uppercase rounded-lg transition-all ${
                metric === m
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Driver Duel Header Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Driver A */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black f-orbitron text-sm shadow-md"
              style={{ background: colorA, color: "#000" }}
            >
              {driverA.carNumber}
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase f-cond">{driverA.name}</div>
              <div className="text-[10px] text-zinc-400">{driverA.team}</div>
            </div>
          </div>
          <select
            value={driverAId}
            onChange={(e) => setDriverAId(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500"
          >
            {AVAILABLE_DRIVERS.map((d) => (
              <option key={d.id} value={d.id} disabled={d.id === driverBId}>
                {d.name} (#{d.carNumber})
              </option>
            ))}
          </select>
        </div>

        {/* Driver B */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black f-orbitron text-sm shadow-md"
              style={{ background: colorB, color: "#000" }}
            >
              {driverB.carNumber}
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase f-cond">{driverB.name}</div>
              <div className="text-[10px] text-zinc-400">{driverB.team}</div>
            </div>
          </div>
          <select
            value={driverBId}
            onChange={(e) => setDriverBId(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500"
          >
            {AVAILABLE_DRIVERS.map((d) => (
              <option key={d.id} value={d.id} disabled={d.id === driverAId}>
                {d.name} (#{d.carNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Recharts Synchronized Telemetry Graph ───────────────────────────── */}
      <div className="w-full h-64 bg-black/60 rounded-2xl border border-zinc-800/80 p-3 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="distance" stroke="#52525b" fontSize={10} />
            <YAxis stroke="#52525b" fontSize={10} domain={metric === "speed" ? [100, 360] : [0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(12, 13, 16, 0.95)",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            {metric === "speed" && (
              <>
                <Line
                  type="monotone"
                  dataKey="speedA"
                  name={`${driverA.name} Speed`}
                  stroke={colorA}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="speedB"
                  name={`${driverB.name} Speed`}
                  stroke={colorB}
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </>
            )}
            {metric === "throttle" && (
              <>
                <Line
                  type="monotone"
                  dataKey="throttleA"
                  name={`${driverA.name} Throttle`}
                  stroke={colorA}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="throttleB"
                  name={`${driverB.name} Throttle`}
                  stroke={colorB}
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </>
            )}
            {metric === "brake" && (
              <>
                <Line
                  type="monotone"
                  dataKey="brakeA"
                  name={`${driverA.name} Brake`}
                  stroke={colorA}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="brakeB"
                  name={`${driverB.name} Brake`}
                  stroke={colorB}
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Apex Speed & Delta Summary ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 f-mono">APEX 1 (TURN 1)</span>
          <div className="text-xs font-bold text-zinc-200 mt-1">
            <span style={{ color: colorA }}>124 KM/H</span> vs <span style={{ color: colorB }}>121 KM/H</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 f-mono">TOP SPEED (SPEED TRAP)</span>
          <div className="text-xs font-bold text-zinc-200 mt-1">
            <span style={{ color: colorA }}>342 KM/H</span> vs <span style={{ color: colorB }}>339 KM/H</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 f-mono">MIN SPEED (HAIRPIN)</span>
          <div className="text-xs font-bold text-zinc-200 mt-1">
            <span style={{ color: colorA }}>78 KM/H</span> vs <span style={{ color: colorB }}>81 KM/H</span>
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800">
          <span className="text-[10px] text-zinc-500 f-mono">SECTOR DELTA</span>
          <div className="text-xs font-bold text-emerald-400 mt-1 f-mono">
            -0.082s (CAR #{driverA.carNumber} AHEAD)
          </div>
        </div>
      </div>
    </div>
  );
}
