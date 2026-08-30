"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

interface GForceCircleProps {
  speed?: number;
  throttle?: number;
  brake?: number;
  gear?: number;
  size?: number;
  className?: string;
}

interface GPoint {
  x: number; // Lateral G (-5 to +5)
  y: number; // Longitudinal G (-5.5 to +2.0)
  id: number;
}

export default function GForceCircle({
  speed = 280,
  throttle = 85,
  brake = 0,
  gear = 6,
  size = 260,
  className = "",
}: GForceCircleProps) {
  const center = size / 2;
  const maxG = 5.5; // Max G scale
  const radius = size * 0.42;

  // Trail history
  const [trail, setTrail] = useState<GPoint[]>([]);
  const [peakG, setPeakG] = useState({ lateral: 4.2, braking: 5.1, accel: 1.8 });
  const pointCounter = useRef(0);

  // Derive current G from telemetry physics
  const currentLongG = brake > 10 ? -(brake / 100) * 5.2 : (throttle / 100) * 1.6;
  // Lateral G oscillation simulating cornering forces
  const currentLatG =
    speed > 100
      ? Math.sin(Date.now() * 0.002) * (speed / 300) * (gear < 5 ? 4.5 : 3.2)
      : 0;

  useEffect(() => {
    const id = setInterval(() => {
      pointCounter.current += 1;
      const pt: GPoint = {
        x: currentLatG + (Math.random() - 0.5) * 0.3,
        y: currentLongG + (Math.random() - 0.5) * 0.2,
        id: pointCounter.current,
      };

      setTrail((prev) => [...prev.slice(-12), pt]);

      setPeakG((p) => ({
        lateral: Math.max(p.lateral, Math.abs(pt.x)),
        braking: Math.max(p.braking, Math.abs(Math.min(0, pt.y))),
        accel: Math.max(p.accel, Math.max(0, pt.y)),
      }));
    }, 120);

    return () => clearInterval(id);
  }, [currentLatG, currentLongG]);

  // Convert G values to SVG pixel coordinates
  const getCoords = (latG: number, longG: number) => {
    const px = center + (latG / maxG) * radius;
    // Invert Y so positive G (acceleration) goes UP, negative G (braking) goes DOWN
    const py = center - (longG / maxG) * radius;
    return { x: px, y: py };
  };

  const currentCoords = getCoords(currentLatG, currentLongG);

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
        <span className="f-mono text-[10px] text-cyan-400 font-bold">KAMM'S DIAGRAM</span>
      </div>

      {/* SVG Canvas */}
      <div className="relative">
        <svg width={size} height={size} className="overflow-visible select-none">
          <defs>
            <radialGradient id="gCircleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background glow */}
          <circle cx={center} cy={center} r={radius} fill="url(#gCircleGlow)" />

          {/* Concentric rings: 1G, 2G, 3G, 4G, 5G */}
          {[1, 2, 3, 4, 5].map((g) => {
            const r = (g / maxG) * radius;
            return (
              <g key={g}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={g === 5 ? "1.5" : "1"}
                  strokeDasharray={g === 5 ? undefined : "3 3"}
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

          {/* Crosshair Axes */}
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

          {/* Axis Labels */}
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

          {/* Trail Points */}
          {trail.map((pt, idx) => {
            const coords = getCoords(pt.x, pt.y);
            const opacity = (idx + 1) / trail.length;
            return (
              <circle
                key={pt.id}
                cx={coords.x}
                cy={coords.y}
                r="2.5"
                fill="#22D3EE"
                opacity={opacity * 0.45}
              />
            );
          })}

          {/* Current Live G-Force Marker */}
          <circle
            cx={currentCoords.x}
            cy={currentCoords.y}
            r="8"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="1.5"
            className="animate-ping opacity-75"
          />
          <circle
            cx={currentCoords.x}
            cy={currentCoords.y}
            r="5"
            fill="#22D3EE"
            stroke="#000"
            strokeWidth="1.5"
            style={{ filter: "drop-shadow(0 0 8px #22D3EE)" }}
          />
        </svg>
      </div>

      {/* Live Readout Bar */}
      <div className="w-full grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-zinc-800/80 text-center text-xs f-mono">
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">LATERAL</span>
          <span className="font-black text-cyan-400">
            {Math.abs(currentLatG).toFixed(2)}G
          </span>
        </div>
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">LONGITUDINAL</span>
          <span
            className={`font-black ${
              currentLongG < 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {currentLongG.toFixed(2)}G
          </span>
        </div>
        <div className="p-1.5 rounded-xl bg-black/50 border border-zinc-800">
          <span className="text-[8px] text-zinc-500 block uppercase">PEAK BRAKE</span>
          <span className="font-black text-amber-400">{peakG.braking.toFixed(1)}G</span>
        </div>
      </div>
    </div>
  );
}
