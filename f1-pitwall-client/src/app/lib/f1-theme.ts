/* ──────────────────────────────────────────────────────────────────────────
 * F1 PITWALL — Pit Wall OS design tokens
 * Single source of truth for colors, tyre data, flags.
 * Client hooks (useCountUp) live in ./useCountUp.ts
 * ────────────────────────────────────────────────────────────────────────── */

// Brand palette
export const F1 = {
  red: "#E10600",
  redBright: "#ff2a1f",
  orange: "#ff5a3c",
  orangeSoft: "#ff6a52",
  gold: "#FFD200",
  goldSoft: "#FFD23F",
  green: "#00E676",
  bg: "#0a0a0c",
  card: "rgba(18,18,21,.78)",
  cardSoft: "rgba(18,18,21,.7)",
  hairline: "rgba(255,255,255,.06)",
} as const;

// Canonical 2026 team colors — used as a FALLBACK only.
// The backend already returns `colorHex` per team/driver; prefer that when present.
export const TEAM_COLORS: Record<string, string> = {
  "McLaren": "#FF8000",
  "Ferrari": "#E8002D",
  "Scuderia Ferrari": "#E8002D",
  "Red Bull Racing": "#3671C6",
  "Red Bull": "#3671C6",
  "Mercedes-AMG Petronas": "#27F4D2",
  "Mercedes": "#27F4D2",
  "Aston Martin": "#358C75",
  "Williams": "#005AFF",
  "Haas": "#B6BABD",
  "Haas F1 Team": "#B6BABD",
  "Racing Bulls": "#6692FF",
  "RB": "#6692FF",
  "Alpine": "#FF69B4",
  "Audi": "#BB0000",
  "Cadillac": "#CC0000",
};

/** Resolve a team color: prefer backend colorHex, else canonical map, else neutral. */
export function getTeamColor(teamName?: string | null, colorHex?: string | null): string {
  if (colorHex && /^#?[0-9a-fA-F]{6}$/.test(colorHex.replace("#", ""))) {
    return colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
  }
  if (teamName && TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];
  return "#9ca3af";
}

// Tyre compounds — color, lifespan, optimal temp window, display metadata.
export interface TyreSpec {
  color: string;
  maxLaps: number;
  optimalTemp: [number, number];
  letter: string;
  label: string;
}
export const TYRE_CONFIG: Record<string, TyreSpec> = {
  SOFT:         { color: "#ff2a2a", maxLaps: 20, optimalTemp: [80, 110],  letter: "S", label: "SOFT" },
  MEDIUM:       { color: "#FFD200", maxLaps: 30, optimalTemp: [90, 120],  letter: "M", label: "MEDIUM" },
  HARD:         { color: "#EDEDED", maxLaps: 40, optimalTemp: [100, 130], letter: "H", label: "HARD" },
  INTERMEDIATE: { color: "#43b047", maxLaps: 25, optimalTemp: [50, 80],   letter: "I", label: "INTER" },
  WET:          { color: "#1e6fff", maxLaps: 30, optimalTemp: [30, 60],   letter: "W", label: "WET" },
  UNKNOWN:      { color: "#666",    maxLaps: 30, optimalTemp: [80, 120],  letter: "?", label: "—" },
};
export function tyre(type?: string | null): TyreSpec {
  return TYRE_CONFIG[(type || "").toUpperCase()] || TYRE_CONFIG.UNKNOWN;
}

// Flags by driver nationality (adjective form)
export const NATIONALITY_FLAGS: Record<string, string> = {
  British: "🇬🇧", Australian: "🇦🇺", Dutch: "🇳🇱", French: "🇫🇷", German: "🇩🇪",
  Spanish: "🇪🇸", Finnish: "🇫🇮", Canadian: "🇨🇦", Mexican: "🇲🇽", Brazilian: "🇧🇷",
  Italian: "🇮🇹", Monegasque: "🇲🇨", Thai: "🇹🇭", "New Zealander": "🇳🇿",
  "New Zealand": "🇳🇿", Argentine: "🇦🇷", Argentinian: "🇦🇷", American: "🇺🇸",
  Japanese: "🇯🇵", Danish: "🇩🇰", Chinese: "🇨🇳", Austrian: "🇦🇹", Swiss: "🇨🇭",
};

// Flags by country name (circuits / GP locations)
export const COUNTRY_FLAGS: Record<string, string> = {
  Australia: "🇦🇺", China: "🇨🇳", Japan: "🇯🇵", Bahrain: "🇧🇭", "Saudi Arabia": "🇸🇦",
  "United States": "🇺🇸", USA: "🇺🇸", Canada: "🇨🇦", Monaco: "🇲🇨", Spain: "🇪🇸",
  Austria: "🇦🇹", "United Kingdom": "🇬🇧", UK: "🇬🇧", Belgium: "🇧🇪", Hungary: "🇭🇺",
  Netherlands: "🇳🇱", Italy: "🇮🇹", Azerbaijan: "🇦🇿", Singapore: "🇸🇬", Mexico: "🇲🇽",
  Brazil: "🇧🇷", UAE: "🇦🇪", "United Arab Emirates": "🇦🇪", Qatar: "🇶🇦",
  Switzerland: "🇨🇭", Germany: "🇩🇪", France: "🇫🇷",
};

export function flagForNationality(nat?: string | null): string {
  return (nat && NATIONALITY_FLAGS[nat]) || "🏁";
}
export function flagForCountry(country?: string | null): string {
  return (country && COUNTRY_FLAGS[country]) || "🏁";
}

export { useCountUp } from "./useCountUp";
