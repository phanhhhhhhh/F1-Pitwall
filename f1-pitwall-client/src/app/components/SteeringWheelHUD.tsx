"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getTeamColor } from "../lib/f1-theme";
import { playShiftBeep, playDrsBeep } from "../lib/f1-sound";
import type { TelemetryData } from "../types/f1";

interface SteeringWheelHUDProps {
  telemetry?: TelemetryData | null;
  driverName?: string;
  carNumber?: number;
  teamName?: string;
  teamColor?: string;
}

export default function SteeringWheelHUD({
  telemetry,
  driverName = "Max Verstappen",
  carNumber = 1,
  teamName = "Red Bull Racing",
  teamColor,
}: SteeringWheelHUDProps) {
  const [prevGear, setPrevGear] = useState<number>(telemetry?.gear ?? 1);
  const [prevDrs, setPrevDrs] = useState<boolean>(telemetry?.drsActive ?? false);
  const [now, setNow] = useState<number>(0);

  const speed = telemetry?.speed ?? 284;
  const rpm = telemetry?.rpm ?? 11200;
  const gear = telemetry?.gear ?? 7;
  const throttle = telemetry?.throttle ?? 0.88;
  const brake = telemetry?.brake ?? 0.0;
  const drs = telemetry?.drsActive ?? false;
  const tyreTemp = telemetry?.tyreTemp ?? 102;

  const resolvedColor = getTeamColor(teamName, teamColor);

  // Trigger audio on shift and DRS
  useEffect(() => {
    if (telemetry?.gear && telemetry.gear !== prevGear) {
      if (telemetry.rpm && telemetry.rpm > 11500) {
        playShiftBeep();
      }
      setPrevGear(telemetry.gear);
    }
  }, [telemetry?.gear, telemetry?.rpm, prevGear]);

  useEffect(() => {
    if (telemetry?.drsActive !== undefined && telemetry.drsActive !== prevDrs) {
      if (telemetry.drsActive) {
        playDrsBeep();
      }
      setPrevDrs(telemetry.drsActive);
    }
  }, [telemetry?.drsActive, prevDrs]);

  // Drive the animated G-force readout without reading a clock during render
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  // Compute 15 Shift Lights (5 Green, 5 Red, 5 Purple)
  const minRpm = 8000;
  const maxRpm = 12500;
  const rpmFraction = Math.max(0, Math.min(1, (rpm - minRpm) / (maxRpm - minRpm)));
  const activeLeds = Math.round(rpmFraction * 15);
  const isRevLimiter = rpm >= 12200;

  // G-force estimation from speed and cornering
  const gLat = (Math.sin(now / 1500) * 3.2).toFixed(1);
  const gLong = (brake > 0.1 ? -4.5 * brake : throttle > 0.5 ? 1.8 * throttle : 0.2).toFixed(1);

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-gradient-to-b from-[#14151a] to-[#0a0a0d] border border-zinc-700/60 rounded-3xl p-5 shadow-2xl overflow-hidden font-sans">
      {/* Carbon fiber top trim */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 via-amber-400 to-red-600 opacity-80" />

      {/* Driver & Team Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black f-orbitron text-lg shadow-md"
            style={{ background: resolvedColor, color: "#000" }}
          >
            {carNumber}
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide text-zinc-100 uppercase f-cond">{driverName}</div>
            <div className="text-[11px] font-medium text-zinc-400">{teamName}</div>
          </div>
        </div>

        {/* ERS Deployment & Mode */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-[10px] font-black f-orbitron tracking-wider rounded bg-zinc-800/90 text-amber-400 border border-amber-500/30">
            SOC 86%
          </span>
          <span className="px-2.5 py-1 text-[10px] font-black f-orbitron tracking-wider rounded bg-zinc-800/90 text-emerald-400 border border-emerald-500/30">
            STRAT 2
          </span>
          <span
            className={`px-2.5 py-1 text-[10px] font-black f-orbitron tracking-wider rounded transition-all duration-200 ${
              drs
                ? "bg-emerald-500 text-black shadow-[0_0_12px_#00E676]"
                : "bg-zinc-800/80 text-zinc-500 border border-zinc-700/40"
            }`}
          >
            DRS {drs ? "ACTIVE" : "AVAIL"}
          </span>
        </div>
      </div>

      {/* ── 15-LED Shift Light Array ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-1 mb-4 p-2 bg-black/60 rounded-xl border border-zinc-800">
        {Array.from({ length: 15 }).map((_, i) => {
          const isActive = i < activeLeds;
          let activeBg = "bg-emerald-500 shadow-[0_0_8px_#00E676]";
          if (i >= 5 && i < 10) activeBg = "bg-red-500 shadow-[0_0_8px_#EF4444]";
          if (i >= 10) activeBg = "bg-fuchsia-500 shadow-[0_0_10px_#D500F9]";

          return (
            <div
              key={i}
              className={`flex-1 h-3.5 rounded-full transition-all duration-75 ${
                isActive
                  ? isRevLimiter && i >= 10
                    ? `${activeBg} rev-strobe`
                    : activeBg
                  : "bg-zinc-800/60"
              }`}
            />
          );
        })}
      </div>

      {/* ── Central LCD Gauges Matrix ───────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-3 mb-4">
        {/* Left Side: Throttle & Brake Dual Vertical Meters */}
        <div className="col-span-3 flex items-center justify-around bg-black/50 p-3 rounded-2xl border border-zinc-800/80">
          {/* Throttle */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-emerald-400 mb-1 f-mono">THR</span>
            <div className="w-4 h-24 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-700">
              <div
                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-full transition-all duration-75 shadow-[0_0_8px_#00E676]"
                style={{ height: `${Math.round(throttle * 100)}%`, marginTop: `${100 - Math.round(throttle * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-bold mt-1 text-zinc-300 f-mono">{Math.round(throttle * 100)}%</span>
          </div>

          {/* Brake */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-red-400 mb-1 f-mono">BRK</span>
            <div className="w-4 h-24 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-700">
              <div
                className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-full transition-all duration-75 shadow-[0_0_8px_#EF4444]"
                style={{ height: `${Math.round(brake * 100)}%`, marginTop: `${100 - Math.round(brake * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-bold mt-1 text-zinc-300 f-mono">{Math.round(brake * 100)}%</span>
          </div>
        </div>

        {/* Center: Giant Gear & Speed Readout */}
        <div className="col-span-6 flex flex-col items-center justify-center bg-black/70 p-4 rounded-2xl border border-zinc-800/90 relative overflow-hidden">
          {/* Background Rev Pulse */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-150"
            style={{ background: resolvedColor }}
          />

          <div className="text-[11px] font-bold tracking-widest text-zinc-400 f-orbitron uppercase mb-1">
            GEAR & TELEMETRY
          </div>

          {/* Huge Gear Display */}
          <motion.div
            key={gear}
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="text-7xl font-black f-orbitron leading-none text-white my-1 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
          >
            {gear === 0 ? "N" : gear === -1 ? "R" : gear}
          </motion.div>

          {/* Speed Indicator */}
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-black f-orbitron tracking-tight text-amber-400">
              {Math.round(speed)}
            </span>
            <span className="text-xs font-bold text-zinc-400 f-mono">KM/H</span>
          </div>

          {/* RPM Readout */}
          <div className="text-xs font-semibold text-zinc-400 f-mono mt-1">
            {rpm.toLocaleString()} <span className="text-[10px] text-zinc-500">RPM</span>
          </div>
        </div>

        {/* Right Side: G-Force Radar Ball & Fuel */}
        <div className="col-span-3 flex flex-col items-center justify-between bg-black/50 p-3 rounded-2xl border border-zinc-800/80">
          <div className="text-[10px] font-bold text-zinc-400 f-mono text-center">G-FORCE</div>

          {/* Circular G-Force Crosshair */}
          <div className="relative w-16 h-16 rounded-full border border-zinc-700/80 bg-zinc-900/60 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-zinc-800" />
              <div className="h-full w-px bg-zinc-800 absolute" />
            </div>
            {/* Moving G Ball */}
            <motion.div
              className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00E5FF] absolute"
              animate={{
                x: Math.min(22, Math.max(-22, Number(gLat) * 6)),
                y: Math.min(22, Math.max(-22, -Number(gLong) * 5)),
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          </div>

          <div className="text-[10px] font-bold text-cyan-300 f-mono mt-1">
            {gLat}G / {gLong}G
          </div>
        </div>
      </div>

      {/* ── Bottom Tyre Heatmap & Car Health ────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 bg-black/40 p-2.5 rounded-2xl border border-zinc-800/70">
        {[
          { pos: "FL", temp: tyreTemp + 1, psi: "23.4" },
          { pos: "FR", temp: tyreTemp + 3, psi: "23.5" },
          { pos: "RL", temp: tyreTemp - 2, psi: "21.8" },
          { pos: "RR", temp: tyreTemp,     psi: "22.0" },
        ].map((t) => {
          let tempColor = "text-emerald-400 border-emerald-500/30";
          if (t.temp > 108) tempColor = "text-red-400 border-red-500/40";
          else if (t.temp < 85) tempColor = "text-blue-400 border-blue-500/30";

          return (
            <div
              key={t.pos}
              className={`flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/80 border ${tempColor}`}
            >
              <span className="text-[10px] font-bold text-zinc-400 f-mono">{t.pos}</span>
              <span className="text-sm font-black f-orbitron my-0.5">{Math.round(t.temp)}°C</span>
              <span className="text-[9px] text-zinc-500 f-mono">{t.psi} PSI</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
