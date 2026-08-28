/* ──────────────────────────────────────────────────────────────────────────
 * F1 PITWALL — Pit Wall OS design tokens & canonical assets
 * Single source of truth for colors, tyre data, flags, and circuit vectors.
 * ────────────────────────────────────────────────────────────────────────── */

// Brand palette
export const F1 = {
  red: "#E10600",
  redBright: "#ff2a1f",
  orange: "#FF8000",
  orangeSoft: "#ff9433",
  gold: "#FFD200",
  goldSoft: "#FFD23F",
  green: "#00E676",
  greenNeon: "#00FF66",
  purple: "#9C27B0",
  purpleBright: "#D500F9",
  cyan: "#00E5FF",
  blue: "#2979FF",
  bg: "#08080a",
  card: "rgba(14, 15, 19, 0.82)",
  cardSoft: "rgba(18, 19, 25, 0.7)",
  hairline: "rgba(255, 255, 255, 0.08)",
} as const;

// Canonical 2026 team colors
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
  "Audi": "#C3002F",
  "Audi F1 Team": "#C3002F",
  "Cadillac": "#E60000",
  "Cadillac F1": "#E60000",
};

/** Resolve a team color: prefer backend colorHex, else canonical map, else neutral. */
export function getTeamColor(teamName?: string | null, colorHex?: string | null): string {
  if (colorHex && /^#?[0-9a-fA-F]{6}$/.test(colorHex.replace("#", ""))) {
    return colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
  }
  if (teamName && TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];
  return "#9ca3af";
}

// Tyre compounds
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

// Flags by driver nationality
export const NATIONALITY_FLAGS: Record<string, string> = {
  British: "🇬🇧", Australian: "🇦🇺", Dutch: "🇳🇱", French: "🇫🇷", German: "🇩🇪",
  Spanish: "🇪🇸", Finnish: "🇫🇮", Canadian: "🇨🇦", Mexican: "🇲🇽", Brazilian: "🇧🇷",
  Italian: "🇮🇹", Monegasque: "🇲🇨", Thai: "🇹🇭", "New Zealander": "🇳🇿",
  "New Zealand": "🇳🇿", Argentine: "🇦🇷", Argentinian: "🇦🇷", American: "🇺🇸",
  Japanese: "🇯🇵", Danish: "🇩🇰", Chinese: "🇨🇳", Austrian: "🇦🇹", Swiss: "🇨🇭",
};

// Flags by country name
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

// Realistic 2026 Driver Skill Radar Ratings (0-100 scale)
export interface DriverSkill {
  pace: number;
  racecraft: number;
  tyreMgmt: number;
  experience: number;
  wetSkill: number;
}

export const DRIVER_SKILLS: Record<string, DriverSkill> = {
  "Max Verstappen":   { pace: 99, racecraft: 98, tyreMgmt: 95, experience: 94, wetSkill: 99 },
  "Lewis Hamilton":   { pace: 95, racecraft: 97, tyreMgmt: 96, experience: 99, wetSkill: 98 },
  "Charles Leclerc":  { pace: 98, racecraft: 94, tyreMgmt: 91, experience: 89, wetSkill: 93 },
  "Lando Norris":     { pace: 97, racecraft: 94, tyreMgmt: 93, experience: 88, wetSkill: 92 },
  "George Russell":   { pace: 95, racecraft: 93, tyreMgmt: 91, experience: 87, wetSkill: 91 },
  "Oscar Piastri":    { pace: 94, racecraft: 92, tyreMgmt: 90, experience: 82, wetSkill: 89 },
  "Fernando Alonso":  { pace: 94, racecraft: 99, tyreMgmt: 97, experience: 100, wetSkill: 96 },
  "Carlos Sainz":     { pace: 93, racecraft: 94, tyreMgmt: 94, experience: 92, wetSkill: 90 },
  "Alexander Albon":  { pace: 90, racecraft: 90, tyreMgmt: 89, experience: 86, wetSkill: 88 },
  "Pierre Gasly":     { pace: 89, racecraft: 88, tyreMgmt: 87, experience: 88, wetSkill: 86 },
  "Esteban Ocon":     { pace: 88, racecraft: 89, tyreMgmt: 86, experience: 87, wetSkill: 88 },
  "Yuki Tsunoda":     { pace: 89, racecraft: 87, tyreMgmt: 85, experience: 84, wetSkill: 85 },
  "Nico Hulkenberg":  { pace: 88, racecraft: 88, tyreMgmt: 87, experience: 93, wetSkill: 87 },
  "Gabriel Bortoleto":{ pace: 87, racecraft: 85, tyreMgmt: 82, experience: 75, wetSkill: 83 },
  "Andrea Kimi Antonelli": { pace: 92, racecraft: 88, tyreMgmt: 84, experience: 75, wetSkill: 88 },
  "Oliver Bearman":   { pace: 90, racecraft: 88, tyreMgmt: 84, experience: 76, wetSkill: 86 },
  "Liam Lawson":      { pace: 89, racecraft: 88, tyreMgmt: 85, experience: 78, wetSkill: 87 },
  "Jack Doohan":      { pace: 86, racecraft: 84, tyreMgmt: 82, experience: 75, wetSkill: 84 },
  "Valtteri Bottas":  { pace: 89, racecraft: 87, tyreMgmt: 90, experience: 95, wetSkill: 88 },
  "Sergio Perez":     { pace: 88, racecraft: 89, tyreMgmt: 93, experience: 95, wetSkill: 86 },
};

export function getDriverSkill(name: string): DriverSkill {
  return DRIVER_SKILLS[name] || { pace: 85, racecraft: 85, tyreMgmt: 85, experience: 80, wetSkill: 85 };
}

export { useCountUp } from "./useCountUp";
