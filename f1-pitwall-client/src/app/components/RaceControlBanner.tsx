"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";

type RaceFlag = "GREEN" | "YELLOW" | "VSC" | "SC" | "RED";

interface RaceControlBannerProps {
  flag?: RaceFlag;
  airTemp?: number;
  trackTemp?: number;
  humidity?: number;
  windSpeed?: number;
}

export default function RaceControlBanner({
  flag = "GREEN",
  airTemp = 24.8,
  trackTemp = 38.2,
  humidity = 58,
  windSpeed = 14,
}: RaceControlBannerProps) {
  const [currentFlag, setCurrentFlag] = useState<RaceFlag>(flag);
  const [tickerIndex, setTickerIndex] = useState(0);

  const announcements = [
    "🏁 FIA RACE CONTROL: TRACK CLEAR — DRS ENABLED",
    "⏱️ SECTOR 2: CAR 16 (LEC) PURPLE SECTOR 27.841s",
    "⚠️ TURN 4: TRACK LIMITS WARNING GIVEN TO CAR 4 (NOR)",
    "🔧 PIT LANE OPEN — AVERAGE PIT STOP TIME 2.4s",
    "🌧️ METEOROLOGY: 0% RAIN PROBABILITY IN NEXT 30 MINS",
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(id);
  }, [announcements.length]);

  const flagConfigs: Record<RaceFlag, { label: string; bg: string; text: string; border: string; pulseColor: string }> = {
    GREEN: {
      label: "TRACK CLEAR / GREEN FLAG",
      bg: "bg-emerald-950/70",
      text: "text-emerald-400",
      border: "border-emerald-500/40",
      pulseColor: "bg-emerald-500",
    },
    YELLOW: {
      label: "YELLOW FLAG — SECTOR 2 HAZARD",
      bg: "bg-amber-950/70",
      text: "text-amber-400",
      border: "border-amber-500/40",
      pulseColor: "bg-amber-500",
    },
    VSC: {
      label: "VIRTUAL SAFETY CAR DEPLOYED",
      bg: "bg-amber-950/80",
      text: "text-amber-300",
      border: "border-amber-400/50",
      pulseColor: "bg-amber-400",
    },
    SC: {
      label: "SAFETY CAR DEPLOYED",
      bg: "bg-orange-950/80",
      text: "text-orange-400",
      border: "border-orange-500/50",
      pulseColor: "bg-orange-500",
    },
    RED: {
      label: "SESSION SUSPENDED — RED FLAG",
      bg: "bg-red-950/80",
      text: "text-red-400",
      border: "border-red-500/50",
      pulseColor: "bg-red-600",
    },
  };

  const cfg = flagConfigs[currentFlag];

  return (
    <div className="w-full bg-gradient-to-r from-[#111217] via-[#161822] to-[#111217] border border-zinc-800/80 rounded-2xl p-3 sm:p-4 shadow-xl overflow-hidden mb-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Left: Interactive Flag Status Indicator */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border ${cfg.bg} ${cfg.border} shadow-sm`}
          >
            <span className={`w-3 h-3 rounded-full ${cfg.pulseColor} live-pulse`} />
            <span className={`text-xs font-black f-orbitron tracking-wider uppercase ${cfg.text}`}>
              {cfg.label}
            </span>
          </div>

          {/* Quick Flag Selector (Demo / Simulation toggle) */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-zinc-800">
            {(["GREEN", "YELLOW", "VSC", "SC", "RED"] as RaceFlag[]).map((f) => (
              <button
                key={f}
                onClick={() => setCurrentFlag(f)}
                className={`px-2 py-0.5 text-[10px] font-bold f-cond rounded transition-all ${
                  currentFlag === f
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Middle: Broadcast Event Ticker */}
        <div className="w-full lg:flex-1 max-w-xl overflow-hidden py-1 px-3 bg-black/50 rounded-xl border border-zinc-800/70">
          <AnimatePresence mode="wait">
            <m.div
              key={tickerIndex}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-medium text-zinc-300 f-mono truncate text-center lg:text-left"
            >
              {announcements[tickerIndex]}
            </m.div>
          </AnimatePresence>
        </div>

        {/* Right: Real-time Weather Telemetry */}
        <div className="flex items-center gap-4 text-xs font-semibold text-zinc-300 f-mono bg-black/40 px-3 py-1.5 rounded-xl border border-zinc-800/60">
          <div className="flex items-center gap-1.5" title="Air Temperature">
            <span className="text-zinc-500">AIR</span>
            <span className="text-white font-bold">{airTemp}°C</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5" title="Track Surface Temperature">
            <span className="text-amber-500 font-bold">TRK</span>
            <span className="text-amber-400 font-bold">{trackTemp}°C</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5" title="Humidity">
            <span className="text-cyan-400">💧</span>
            <span>{humidity}%</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5" title="Wind">
            <span className="text-zinc-400">💨</span>
            <span>{windSpeed} km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
