"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { F1 } from "../lib/f1-theme";

export type SeriesPoint = { i: number; a?: number; b?: number };
export default function DetailChart({
  data, colorA, colorB, labelA, labelB, height = 220, domain,
}: {
  data: SeriesPoint[]; colorA: string; colorB?: string;
  labelA: string; labelB?: string; height?: number; domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="strokeA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colorA} stopOpacity={0.45} />
            <stop offset="100%" stopColor={colorA} stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="i" hide />
        <YAxis
          domain={domain ?? ["auto", "auto"]} width={38}
          tick={{ fill: "rgba(255,255,255,0.32)", fontSize: 9, fontFamily: "var(--font-geist-mono),monospace" }}
          axisLine={false} tickLine={false}
        />
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
          contentStyle={{
            background: "rgba(10,10,12,.92)", border: `1px solid ${F1.hairline}`,
            borderRadius: 10, fontSize: 11, fontFamily: "var(--font-geist-mono),monospace",
            boxShadow: "0 8px 30px rgba(0,0,0,.6)",
          }}
          labelStyle={{ display: "none" }}
          itemStyle={{ padding: 0 }}
        />
        <Line type="monotone" dataKey="a" name={labelA} stroke="url(#strokeA)" strokeWidth={2.5}
          dot={false} isAnimationActive={false} connectNulls />
        {colorB && (
          <Line type="monotone" dataKey="b" name={labelB} stroke={colorB} strokeWidth={2.5}
            dot={false} isAnimationActive={false} connectNulls strokeDasharray="0" />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
