"use client";

import { ReactNode } from "react";
import { F1 } from "../../lib/f1-theme";

interface AuthLogoProps {
  subtitle: string;
  icon?: ReactNode;
  size?: "sm" | "md";
}

export function AuthLogo({ subtitle, icon, size = "md" }: AuthLogoProps) {
  const dims = size === "md" ? { outer: 72, middle: 56, badge: 56, badgeInner: 14, textSize: "clamp(2.2rem,6vw,2.8rem)" } : { outer: 60, middle: 48, badge: 48, badgeInner: 12, textSize: "clamp(1.9rem,5vw,2.4rem)" };
  const halfOuter = dims.outer / 2;
  const halfMiddle = dims.middle / 2;
  const rOuter = halfOuter - 3;
  const rMiddle = halfMiddle - 3;

  return (
    <div className="text-center mb-7">
      {/* Spinning rings */}
      <div className="relative inline-flex items-center justify-center mb-4">
        {/* Outer ring */}
        <svg
          className="absolute"
          width={dims.outer} height={dims.outer} viewBox={`0 0 ${dims.outer} ${dims.outer}`}
          style={{ animation: "spin-slow 9s linear infinite" }}
        >
          <circle cx={halfOuter} cy={halfOuter} r={rOuter} fill="none" stroke={F1.red} strokeWidth="1" strokeDasharray="8 6" opacity="0.4" strokeLinecap="round" />
        </svg>
        {/* Middle ring — counter-spin */}
        <svg
          className="absolute"
          width={dims.middle} height={dims.middle} viewBox={`0 0 ${dims.middle} ${dims.middle}`}
          style={{ animation: "spin-slow 6s linear infinite reverse" }}
        >
          <circle cx={halfMiddle} cy={halfMiddle} r={rMiddle} fill="none" stroke={F1.red} strokeWidth="0.8" strokeDasharray="6 12" opacity="0.3" strokeLinecap="round" />
        </svg>
        {/* Inner ring */}
        <svg
          className="absolute"
          width={dims.badgeInner * 3} height={dims.badgeInner * 3} viewBox={`0 0 ${dims.badgeInner * 3} ${dims.badgeInner * 3}`}
          style={{ animation: "spin-slow 3.5s linear infinite" }}
        >
          <circle cx={dims.badgeInner * 1.5} cy={dims.badgeInner * 1.5} r={dims.badgeInner * 1.3} fill="none" stroke={F1.red} strokeWidth="0.7" strokeDasharray="3 14" opacity="0.5" strokeLinecap="round" />
        </svg>

        {/* Centre badge */}
        <div
          className={`relative rounded-full flex items-center justify-center glow-pulse ${size === "md" ? "w-14 h-14 text-2xl" : "w-12 h-12 text-xl"}`}
          style={{
            background: "rgba(225,6,0,0.12)",
            border: "1px solid rgba(225,6,0,0.22)",
            boxShadow: "0 0 24px rgba(225,6,0,0.18)",
          }}
        >
          <span className="float">{icon || "🏎️"}</span>
        </div>
      </div>

      {/* Wordmark */}
      <h1
        className="f-cond font-black tracking-tight leading-none"
        style={{ fontSize: dims.textSize, letterSpacing: "-0.02em" }}
      >
        <span style={{ color: F1.red }}>PIT</span>
        <span className="text-white">WALL</span>
      </h1>
      <div
        className="mt-1 mx-auto h-px"
        style={{
          width: size === "md" ? "64px" : "48px",
          background: `linear-gradient(90deg,transparent,${F1.red},transparent)`,
        }}
      />
      <p className="f-mono text-zinc-500 text-[10px] tracking-[0.4em] uppercase mt-2">{subtitle}</p>
    </div>
  );
}
