"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

export interface DriverStandingEntry {
  position: number;
  driverName: string;
  totalPoints: number;
  teamColor: string;
  gapToLeader: number;
}

export interface ConstructorStandingEntry {
  position: number;
  teamName: string;
  totalPoints: number;
  teamColor: string;
  gapToLeader: number;
}

interface ChartEntry {
  name: string;
  shortName: string;
  points: number;
  gap: number;
  color: string;
  isLeader: boolean;
  position: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
}

const GapToLeaderTooltip = memo(function GapToLeaderTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="f-mono text-[11px] rounded-lg border px-3 py-2" style={{ background: "rgba(12,12,14,.95)", borderColor: `${d.color}40` }}>
      <p className="font-bold text-white mb-1">{d.name}</p>
      <p style={{ color: d.color }}>{d.points} PTS</p>
      {d.isLeader
        ? <p className="text-[#E10600] font-bold mt-0.5">LEADER</p>
        : <p className="text-zinc-400 mt-0.5">-{d.gap} from leader</p>
      }
    </div>
  );
});

interface GapChartProps {
  drivers: DriverStandingEntry[];
  constructors: ConstructorStandingEntry[];
  tab: "drivers" | "constructors";
}

const GapToLeaderChart = memo(function GapToLeaderChart({ drivers, constructors, tab }: GapChartProps) {
  const isDrivers = tab === "drivers";

  const driverData: ChartEntry[] = drivers.map((d) => ({
    name: d.driverName,
    shortName: d.driverName.split(" ").pop() ?? d.driverName,
    points: Math.round(d.totalPoints),
    gap: Math.round(d.gapToLeader),
    color: d.teamColor || "#9ca3af",
    isLeader: d.position === 1,
    position: d.position,
  }));

  const constructorData: ChartEntry[] = constructors.map((c) => ({
    name: c.teamName,
    shortName: c.teamName.split(" ").slice(-1)[0] ?? c.teamName,
    points: Math.round(c.totalPoints),
    gap: Math.round(c.gapToLeader),
    color: c.teamColor || "#9ca3af",
    isLeader: c.position === 1,
    position: c.position,
  }));

  const data = isDrivers ? driverData : constructorData;
  if (!data.length) return null;

  const maxPts = data[0]?.points || 1;

  return (
    <div className="rise relative overflow-hidden rounded-2xl border border-white/5" style={{ background: "rgba(18,18,21,.7)", animationDelay: "80ms" }}>
      {/* shimmer top line */}
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="h-full w-1/3" style={{ background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: "shimmer 2.4s ease-in-out infinite" }} />
      </div>

      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <div>
          <span className="f-mono text-[10px] tracking-[0.25em] text-zinc-500">GAP TO LEADER</span>
          <p className="f-cond font-black text-xl text-white mt-0.5 leading-none">
            POINTS VISUALIZATION
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#E10600" }} />
          <span className="f-mono text-[10px] text-zinc-500">LEADER</span>
          <span className="w-3 h-3 rounded-sm inline-block ml-2" style={{ background: "rgba(255,255,255,.15)" }} />
          <span className="f-mono text-[10px] text-zinc-500">OTHERS</span>
        </div>
      </div>

      <div style={{ width: "100%", height: data.length * 36 + 40, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, left: 8, bottom: 8 }}
            barSize={14}
          >
            <XAxis
              type="number"
              domain={[0, maxPts]}
              tick={{ fill: "#52525b", fontSize: 9, fontFamily: "var(--font-geist-mono),ui-monospace,monospace" }}
              axisLine={{ stroke: "rgba(255,255,255,.06)" }}
              tickLine={false}
              tickCount={5}
            />
            <YAxis
              type="category"
              dataKey="shortName"
              width={72}
              tick={{ fill: "#a1a1aa", fontSize: 11, fontFamily: "'Saira Condensed','Saira',system-ui,sans-serif", fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<GapToLeaderTooltip />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
            <Bar dataKey="points" radius={[0, 3, 3, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isLeader ? "#E10600" : entry.color}
                  fillOpacity={entry.isLeader ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gap indicators row */}
      <div className="px-5 pb-5 pt-2 border-t border-white/[0.04]">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {data.slice(0, 8).map((d) => (
            <div key={d.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="f-mono text-[10px] text-zinc-500">{d.shortName}</span>
              {d.isLeader
                ? <span className="f-mono text-[10px] text-[#E10600] font-bold">LEAD</span>
                : <span className="f-mono text-[10px] text-zinc-600">-{d.gap}</span>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default GapToLeaderChart;
