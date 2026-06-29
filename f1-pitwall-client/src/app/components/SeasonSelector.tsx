"use client";

import { useState, useRef, useEffect } from "react";
import { useSeason } from "../context/SeasonContext";

const AVAILABLE_SEASONS = [2026, 2025, 2024, 2023];

export default function SeasonSelector() {
  const { season, setSeason } = useSeason();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border f-mono text-[11px] font-bold tracking-wider transition-all"
        style={{
          borderColor: open ? "rgba(225,6,0,.4)" : "rgba(255,255,255,.08)",
          background: open ? "rgba(225,6,0,.08)" : "transparent",
          color: open ? "#ff6a52" : "#71717a",
        }}
      >
        <span className="text-sm">📅</span>
        {season}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/70 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[120px]"
        >
          <div className="h-px w-full" style={{ background: "linear-gradient(90deg,transparent,#E10600,transparent)" }} />
          {AVAILABLE_SEASONS.map((year) => (
            <button
              key={year}
              onClick={() => {
                setSeason(year);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 f-cond text-sm font-bold transition-colors border-l-2 ${
                season === year
                  ? "border-[#E10600] text-[#ff6a52] bg-white/[0.04]"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              {year === 2026 && "🚀 "}
              {year === 2025 && "🏆 "}
              {year === 2024 && "📖 "}
              {year === 2023 && "📖 "}
              {year} Season
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
