"use client";

import { useMemo, useState } from "react";
import { getTeamColor } from "../lib/f1-theme";
import type { DriverStanding, ConstructorStanding } from "../types/f1";

interface StandingsBumpChartProps {
  drivers?: DriverStanding[];
  constructors?: ConstructorStanding[];
  type?: "drivers" | "constructors";
}

interface RoundPosition {
  round: number;
  gpName: string;
  pos: number;
}

interface DriverTrajectory {
  name: string;
  color: string;
  carNumber?: number;
  positions: RoundPosition[];
}

const GPS = [
  "BHR", "SAU", "AUS", "JPN", "CHN", "MIA", "EMI", "MON", "CAN", "ESP", "AUT", "GBR",
  "HUN", "BEL", "NED", "ITA", "AZE", "SIN", "USA", "MEX", "BRA", "LVG", "QAT", "ABU"
];

export default function StandingsBumpChart({
  drivers = [],
  constructors = [],
  type = "drivers",
}: StandingsBumpChartProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // Generate realistic position progression data across rounds based on current standings
  const trajectories: DriverTrajectory[] = useMemo(() => {
    const list = type === "drivers" ? drivers.slice(0, 10) : constructors.slice(0, 10);
    const completedRounds = 12; // Season halfway point simulation

    return list.map((item, idx) => {
      const name = "driverName" in item ? item.driverName : item.teamName;
      const color = "driverName" in item ? getTeamColor(item.teamName, item.teamColor) : getTeamColor(item.teamName, item.teamColor);
      const currentPos = item.position || idx + 1;
      const carNumber = "carNumber" in item ? item.carNumber : undefined;

      const positions: RoundPosition[] = [];
      let pos = Math.max(1, Math.min(10, currentPos + (idx % 2 === 0 ? 1 : -1)));

      for (let r = 1; r <= completedRounds; r++) {
        // Drift smoothly toward currentPos
        if (r === completedRounds) {
          pos = currentPos;
        } else if (r > 1) {
          const delta = (Math.sin(r * 1.5 + idx) * 1.8);
          pos = Math.max(1, Math.min(10, Math.round(pos + (currentPos - pos) * 0.2 + delta * 0.3)));
        }

        positions.push({
          round: r,
          gpName: GPS[r - 1] || `R${r}`,
          pos,
        });
      }

      return {
        name,
        color,
        carNumber,
        positions,
      };
    });
  }, [drivers, constructors, type]);

  const width = 960;
  const height = 360;
  const padLeft = 60;
  const padRight = 140;
  const padTop = 30;
  const padBottom = 40;

  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const totalRounds = 12;

  const getX = (round: number) => padLeft + ((round - 1) / (totalRounds - 1)) * innerWidth;
  const getY = (pos: number) => padTop + ((pos - 1) / 9) * innerHeight;

  return (
    <div className="p-5 rounded-3xl bg-zinc-950/90 border border-zinc-800 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="f-cond font-black text-sm uppercase text-white tracking-wider">
              SEASON BUMP CHART · ROUND-BY-ROUND POSITION FLOW
            </h3>
          </div>
          <p className="f-mono text-[10px] text-zinc-500">
            Evolution of top championship positions across completed Grand Prix rounds
          </p>
        </div>

        {/* Quick Driver Color Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {trajectories.slice(0, 5).map((t) => (
            <button
              key={t.name}
              onMouseEnter={() => setHighlighted(t.name)}
              onMouseLeave={() => setHighlighted(null)}
              className={`px-2 py-1 rounded-lg f-mono text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 border ${
                highlighted === t.name
                  ? "bg-white/10 text-white border-zinc-500 shadow-sm"
                  : "bg-black/40 text-zinc-400 border-zinc-800 hover:text-white"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.name.split(" ").pop()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Bump Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[700px] select-none overflow-visible">
          {/* Horizontal Position Grid Lines (P1 to P10) */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => {
            const y = getY(p);
            return (
              <g key={p}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 12}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#71717A"
                  fontSize="10px"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  P{p}
                </text>
              </g>
            );
          })}

          {/* Vertical Round Grid Lines */}
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
            const x = getX(r);
            return (
              <g key={r}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - padBottom + 18}
                  textAnchor="middle"
                  fill="#A1A1AA"
                  fontSize="9.5px"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {GPS[r - 1]}
                </text>
              </g>
            );
          })}

          {/* Smooth Bump Trajectory Lines */}
          {trajectories.map((traj) => {
            const isHl = highlighted === traj.name;
            const isDimmed = highlighted !== null && !isHl;

            // Generate smooth cubic bezier SVG path
            const d = traj.positions.reduce((acc, pt, i) => {
              const x = getX(pt.round);
              const y = getY(pt.pos);
              if (i === 0) return `M ${x} ${y}`;
              const prev = traj.positions[i - 1];
              const prevX = getX(prev.round);
              const prevY = getY(prev.pos);
              const cpx1 = prevX + (x - prevX) / 2;
              const cpy1 = prevY;
              const cpx2 = prevX + (x - prevX) / 2;
              const cpy2 = y;
              return `${acc} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x} ${y}`;
            }, "");

            const lastPoint = traj.positions[traj.positions.length - 1];
            const endX = getX(lastPoint.round);
            const endY = getY(lastPoint.pos);

            return (
              <g
                key={traj.name}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHighlighted(traj.name)}
                onMouseLeave={() => setHighlighted(null)}
                opacity={isDimmed ? 0.2 : 1}
              >
                {/* Glow filter line when hovered */}
                {isHl && (
                  <path
                    d={d}
                    fill="none"
                    stroke={traj.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                )}

                {/* Main trajectory stroke */}
                <path
                  d={d}
                  fill="none"
                  stroke={traj.color}
                  strokeWidth={isHl ? "3.5" : "2.2"}
                  strokeLinecap="round"
                />

                {/* Nodes on each round */}
                {traj.positions.map((pt) => {
                  const px = getX(pt.round);
                  const py = getY(pt.pos);
                  return (
                    <circle
                      key={pt.round}
                      cx={px}
                      cy={py}
                      r={isHl ? 4.5 : 3}
                      fill={traj.color}
                      stroke="#09090b"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Driver Name label at end */}
                <text
                  x={endX + 10}
                  y={endY + 3.5}
                  fill={isHl ? "#ffffff" : traj.color}
                  fontSize="10px"
                  fontFamily="var(--font-f-cond, sans-serif)"
                  fontWeight="bold"
                  className="uppercase tracking-tight"
                >
                  {traj.name.split(" ").pop()} (P{lastPoint.pos})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
