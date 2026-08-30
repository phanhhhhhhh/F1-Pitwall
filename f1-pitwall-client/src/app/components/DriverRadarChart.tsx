"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { DriverSkills } from "../types/f1";

interface DriverRadarChartProps {
  driver1: {
    name: string;
    teamColor: string;
    skills?: DriverSkills;
  };
  driver2: {
    name: string;
    teamColor: string;
    skills?: DriverSkills;
  };
  size?: number;
}

interface Axis {
  key: keyof Omit<DriverSkills, "overall">;
  label: string;
  angle: number;
}

const AXES: { key: keyof Omit<DriverSkills, "overall">; label: string }[] = [
  { key: "pace", label: "QUALIFYING PACE" },
  { key: "racecraft", label: "RACECRAFT & OVERTAKING" },
  { key: "tyreMgmt", label: "TYRE PRESERVATION" },
  { key: "experience", label: "CONSISTENCY / EXP" },
  { key: "wetSkill", label: "WET WEATHER SKILL" },
];

export default function DriverRadarChart({
  driver1,
  driver2,
  size = 360,
}: DriverRadarChartProps) {
  const center = size / 2;
  const radius = size * 0.38;
  const totalAxes = AXES.length;

  // Calculate polygon points for grid rings (20%, 40%, 60%, 80%, 100%)
  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0];

  const axesWithAngles: Axis[] = useMemo(() => {
    return AXES.map((axis, i) => {
      // Start from top (-90 deg / -PI/2)
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
      return { ...axis, angle };
    });
  }, [totalAxes]);

  // Compute coordinate from value (0-100) and angle
  const getCoordinates = (value: number, angle: number) => {
    const r = (Math.max(10, Math.min(100, value)) / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Build polygon path string for a set of skills
  const getPolygonPath = (skills?: DriverSkills) => {
    if (!skills) return "";
    const points = axesWithAngles.map((axis) => {
      const val = skills[axis.key] ?? 70;
      const { x, y } = getCoordinates(val, axis.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return points.join(" ");
  };

  const defaultSkills: DriverSkills = {
    pace: 75,
    racecraft: 75,
    tyreMgmt: 75,
    experience: 75,
    wetSkill: 75,
    overall: 75,
  };

  const s1 = driver1.skills ?? defaultSkills;
  const s2 = driver2.skills ?? defaultSkills;

  const path1 = getPolygonPath(s1);
  const path2 = getPolygonPath(s2);

  return (
    <div className="relative flex flex-col items-center justify-center p-4 bg-black/40 rounded-3xl border border-zinc-800/80 backdrop-blur-md">
      <div className="w-full flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shadow-[0_0_8px]"
            style={{ backgroundColor: driver1.teamColor, boxShadow: `0 0 10px ${driver1.teamColor}` }}
          />
          <span className="f-cond text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
            {driver1.name}
          </span>
        </div>
        <span className="f-mono text-[10px] text-zinc-500 font-bold">5-AXIS TELEMETRY RADAR</span>
        <div className="flex items-center gap-2">
          <span className="f-cond text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
            {driver2.name}
          </span>
          <span
            className="w-3 h-3 rounded-full shadow-[0_0_8px]"
            style={{ backgroundColor: driver2.teamColor, boxShadow: `0 0 10px ${driver2.teamColor}` }}
          />
        </div>
      </div>

      <svg width={size} height={size} className="overflow-visible select-none">
        <defs>
          {/* Gradients */}
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow background */}
        <circle cx={center} cy={center} r={radius * 1.15} fill="url(#radar-glow)" />

        {/* Concentric Grid Rings */}
        {gridRings.map((factor, idx) => {
          const ringPoints = axesWithAngles
            .map((axis) => {
              const r = factor * radius;
              const x = center + r * Math.cos(axis.angle);
              const y = center + r * Math.sin(axis.angle);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");

          return (
            <g key={idx}>
              <polygon
                points={ringPoints}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={idx === gridRings.length - 1 ? "1.5" : "1"}
                strokeDasharray={idx === gridRings.length - 1 ? undefined : "3 3"}
              />
              <text
                x={center + 4}
                y={center - factor * radius + 11}
                fill="rgba(255,255,255,0.25)"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {factor * 100}
              </text>
            </g>
          );
        })}

        {/* Radial Axis Spoke Lines */}
        {axesWithAngles.map((axis, i) => {
          const outer = getCoordinates(100, axis.angle);
          const labelDist = radius + 26;
          const lx = center + labelDist * Math.cos(axis.angle);
          const ly = center + labelDist * Math.sin(axis.angle);

          // Calculate text anchor based on angle
          let textAnchor: "start" | "middle" | "end" = "middle";
          if (Math.cos(axis.angle) > 0.3) textAnchor = "start";
          else if (Math.cos(axis.angle) < -0.3) textAnchor = "end";

          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
              {/* Axis Label */}
              <text
                x={lx}
                y={ly + 3}
                fill="#A1A1AA"
                fontSize="10"
                fontWeight="800"
                fontFamily="var(--font-f-mono, monospace)"
                textAnchor={textAnchor}
                className="tracking-wider uppercase"
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        {/* Polygon 1 (Driver 1) */}
        {path1 && (
          <motion.polygon
            points={path1}
            fill={`${driver1.teamColor}33`}
            stroke={driver1.teamColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}

        {/* Polygon 2 (Driver 2) */}
        {path2 && (
          <motion.polygon
            points={path2}
            fill={`${driver2.teamColor}33`}
            stroke={driver2.teamColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          />
        )}

        {/* Data points for Driver 1 */}
        {axesWithAngles.map((axis, i) => {
          const val = s1[axis.key] ?? 70;
          const { x, y } = getCoordinates(val, axis.angle);
          return (
            <circle
              key={`d1-${i}`}
              cx={x}
              cy={y}
              r="4.5"
              fill={driver1.teamColor}
              stroke="#000"
              strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 6px ${driver1.teamColor})` }}
            />
          );
        })}

        {/* Data points for Driver 2 */}
        {axesWithAngles.map((axis, i) => {
          const val = s2[axis.key] ?? 70;
          const { x, y } = getCoordinates(val, axis.angle);
          return (
            <circle
              key={`d2-${i}`}
              cx={x}
              cy={y}
              r="4.5"
              fill={driver2.teamColor}
              stroke="#000"
              strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 6px ${driver2.teamColor})` }}
            />
          );
        })}
      </svg>

      {/* Numerical breakdown bar below */}
      <div className="w-full grid grid-cols-5 gap-2 mt-4 pt-3 border-t border-zinc-800/80">
        {AXES.map((axis) => {
          const v1 = s1[axis.key] ?? 0;
          const v2 = s2[axis.key] ?? 0;
          const diff = v1 - v2;

          return (
            <div key={axis.key} className="flex flex-col items-center text-center p-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
              <span className="text-[9px] f-mono text-zinc-500 font-bold uppercase truncate max-w-full">
                {axis.label.split(" ")[0]}
              </span>
              <div className="flex items-center gap-1 mt-1 text-xs f-mono font-black">
                <span style={{ color: driver1.teamColor }}>{v1}</span>
                <span className="text-zinc-600 text-[10px]">vs</span>
                <span style={{ color: driver2.teamColor }}>{v2}</span>
              </div>
              <span
                className={`text-[9px] f-mono font-bold mt-0.5 ${
                  diff > 0
                    ? "text-emerald-400"
                    : diff < 0
                    ? "text-amber-400"
                    : "text-zinc-500"
                }`}
              >
                {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "="}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
