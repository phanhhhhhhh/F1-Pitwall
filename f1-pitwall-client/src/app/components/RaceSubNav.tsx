"use client";

import Link from "next/link";
import { F1, flagForCountry } from "../lib/f1-theme";

interface RaceSubNavProps {
  raceId: string;
  raceName?: string;
  roundNumber?: number;
  country?: string;
  date?: string;
  activeTab: "weekend" | "qualifying" | "results";
}

const TABS = [
  { key: "weekend", label: "Weekend", accent: "#3b82f6" },
  { key: "qualifying", label: "Qualifying", accent: F1.gold },
  { key: "results", label: "Results", accent: F1.red },
] as const;

export default function RaceSubNav({ raceId, raceName, roundNumber, country, date, activeTab }: RaceSubNavProps) {
  const countryFlag = flagForCountry(country);
  const year = date?.slice(0, 4);

  return (
    <div className="mb-6 sm:mb-8">
      {/* Top row: back link + race context */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <Link
          href="/races"
          className="f-mono text-[11px] tracking-widest text-zinc-600 hover:text-[#ff6a52] transition-colors inline-flex items-center gap-1.5"
        >
          ← CALENDAR
        </Link>
        <div className="f-mono text-[10px] tracking-widest text-zinc-600 flex items-center gap-2 flex-wrap justify-end">
          {country && <span>{countryFlag} {country.toUpperCase()}</span>}
          {roundNumber && <span>· R{roundNumber}</span>}
          {year && <span>· {year}</span>}
        </div>
      </div>

      {/* Race name */}
      {raceName && (
        <h2 className="f-cond font-black text-white text-xl sm:text-2xl tracking-wide mb-4 truncate">
          {raceName.toUpperCase()}
        </h2>
      )}

      {/* Tab bar */}
      <div
        className="flex border-b overflow-x-auto gap-1"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/races/${raceId}/${tab.key === "weekend" ? "weekend" : tab.key}`}
              className={`relative flex-shrink-0 px-4 sm:px-6 py-3 f-cond font-bold text-sm tracking-wide transition-colors ${
                isActive ? "text-white" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full"
                  style={{
                    background: tab.accent,
                    boxShadow: `0 0 10px ${tab.accent}80`,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
