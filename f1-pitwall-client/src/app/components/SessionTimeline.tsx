"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authFetch } from "../lib/pitwall-auth";
import { F1, getTeamColor, tyre as tyreSpec } from "../lib/f1-theme";
import { BASE_URL as API } from "../lib/api-client";
import type { PitStopEvent, RaceIncident, WeatherChange, TimelineEvent } from "../types/f1";

/* ── Event kind config ─────────────────────────────────────────────────── */
const EVENT_CONFIG: Record<TimelineEvent["kind"], { icon: string; label: string; accent: string; bg: string }> = {
  "pit-stop":     { icon: "🔧", label: "PIT STOP",    accent: "#f97316", bg: "rgba(249,115,22,.08)" },
  incident:       { icon: "⚠",  label: "INCIDENT",    accent: "#ef4444", bg: "rgba(239,68,68,.08)" },
  weather:        { icon: "🌧", label: "WEATHER",      accent: "#3b82f6", bg: "rgba(59,130,246,.08)" },
  "fastest-lap":  { icon: "⚡", label: "FASTEST LAP",  accent: "#a855f7", bg: "rgba(168,85,247,.08)" },
};

const INCIDENT_ICONS: Record<string, string> = {
  RETIREMENT:          "🅳",
  ACCIDENT:            "💥",
  YELLOW_FLAG:         "🟨",
  RED_FLAG:            "🟥",
  SAFETY_CAR:          "🚗",
  VIRTUAL_SAFETY_CAR:  "🅥",
};

const WEATHER_ICONS: Record<string, string> = {
  DRY:          "☀️",
  WET:          "🌧",
  INTERMEDIATE: "🌤",
  MIXED:        "⛅",
};

function formatDuration(ms: number): string {
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SessionTimeline — chronologically ordered race events
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function SessionTimeline({ raceId }: { raceId: string | number }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchAll = async () => {
    setLoading(true);

    const all: TimelineEvent[] = [];

    // Fetch pit stops
    try {
      const res = await authFetch(`${API}/api/races/${raceId}/pit-stops`);
      if (res.ok) {
        const data: PitStopEvent[] = await res.json();
        data.forEach((d) => all.push({ kind: "pit-stop", lap: d.lap, data: d }));
      }
    } catch { /* endpoint may not exist yet */ }

    // Fetch incidents
    try {
      const res = await authFetch(`${API}/api/races/${raceId}/incidents`);
      if (res.ok) {
        const data: RaceIncident[] = await res.json();
        data.forEach((d) => all.push({ kind: "incident", lap: d.lap, data: d }));
      }
    } catch { /* endpoint may not exist yet */ }

    // Fetch weather changes
    try {
      const res = await authFetch(`${API}/api/races/${raceId}/weather`);
      if (res.ok) {
        const data: WeatherChange[] = await res.json();
        data.forEach((d) => all.push({ kind: "weather", lap: d.lap, data: d }));
      }
    } catch { /* endpoint may not exist yet */ }

    // Fallback: if no backend data, generate synthetic events from race results
    if (all.length === 0) {
      setLoading(false);
      setEvents([]);
      return;
    }

    // Sort by lap, then by kind priority within same lap
    const kindOrder: Record<string, number> = { weather: 0, incident: 1, "pit-stop": 2, "fastest-lap": 3 };
    all.sort((a, b) => {
      if (a.lap !== b.lap) return a.lap - b.lap;
      return (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
    });

    setEvents(all);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  const filtered = filter === "all"
    ? events
    : events.filter((e) => e.kind === filter);

  // Unique laps for timeline markers
  const laps = [...new Set(filtered.map((e) => e.lap))].sort((a, b) => a - b);
  const maxLap = laps.length > 0 ? Math.max(...laps) : 1;

  /* ── Loading state ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{ background: F1.card, borderColor: F1.hairline }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${F1.red}50,transparent)` }} />
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-8 bg-zinc-800 rounded" />
              <div className="w-20 h-3 bg-zinc-800 rounded" />
              <div className="flex-1 h-8 bg-zinc-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty state ────────────────────────────────────────────────────── */
  if (events.length === 0) {
    return (
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{ background: F1.card, borderColor: F1.hairline }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${F1.red}50,transparent)` }} />
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <span className="text-2xl">📋</span>
          <p className="f-cond font-black text-white text-lg">No Timeline Data</p>
          <p className="f-mono text-xs text-zinc-500 text-center max-w-xs">
            Pit stop, incident, and weather data will appear here once synced from OpenF1
          </p>
        </div>
      </div>
    );
  }

  /* ── Filter tabs ────────────────────────────────────────────────────── */
  const FILTERS = [
    { key: "all",          label: "ALL",        count: events.length },
    { key: "pit-stop",     label: "PIT STOPS",  count: events.filter((e) => e.kind === "pit-stop").length },
    { key: "incident",     label: "INCIDENTS",  count: events.filter((e) => e.kind === "incident").length },
    { key: "weather",      label: "WEATHER",    count: events.filter((e) => e.kind === "weather").length },
    { key: "fastest-lap",  label: "FASTEST",    count: events.filter((e) => e.kind === "fastest-lap").length },
  ].filter((f) => f.count > 0 || f.key === "all");

  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{ background: F1.card, borderColor: F1.hairline }}
    >
      {/* Top accent */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${F1.red}50,transparent)` }} />

      <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block w-5 h-[2px]" style={{ background: F1.red }} />
          <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500 uppercase">
            RACE TIMELINE
          </span>
          <span className="f-mono text-[10px] text-zinc-700">
            {events.length} events
          </span>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const cfg = EVENT_CONFIG[f.key as TimelineEvent["kind"]];
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="f-mono text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all"
                style={{
                  color: active ? (cfg?.accent ?? "#fff") : "#71717a",
                  borderColor: active ? (cfg?.accent ?? "rgba(255,255,255,.3)") : "rgba(255,255,255,.08)",
                  background: active ? (cfg?.bg ?? "transparent") : "transparent",
                }}
              >
                {f.label} <span className="opacity-50 ml-0.5">{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Timeline ═══ */}
      <div className="px-5 pb-5">
        {/* Lap scale bar */}
        <div className="relative h-3 mb-3">
          {(() => {
            const ticks = laps.length <= 12
              ? laps
              : Array.from({ length: 8 }, (_, i) => laps[Math.floor((i / 7) * (laps.length - 1))]);
            return ticks.map((lap) => (
              <div
                key={lap}
                className="absolute top-0"
                style={{ left: `${((lap - 1) / maxLap) * 100}%`, transform: "translateX(-50%)" }}
              >
                <div className="w-px h-2 bg-white/10" />
                <span className="f-mono text-[8px] text-zinc-600 block text-center mt-0.5">
                  L{lap}
                </span>
              </div>
            ));
          })()}
        </div>

        {/* Event rows */}
        <div className="space-y-1.5">
          {filtered.map((event, idx) => {
            const cfg = EVENT_CONFIG[event.kind];

            return (
              <motion.div
                key={`${event.kind}-${event.lap}-${idx}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.015, 0.2) }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors group"
                style={{
                  background: cfg.bg,
                  borderLeft: `3px solid ${cfg.accent}`,
                }}
              >
                {/* Lap badge */}
                <div
                  className="w-10 flex-shrink-0 text-center"
                >
                  <span className="f-cond font-black text-sm tabular-nums text-zinc-400">
                    L{event.lap}
                  </span>
                </div>

                {/* Event icon + label */}
                <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                  <span className="text-sm">{cfg.icon}</span>
                  <span
                    className="f-mono text-[9px] font-bold tracking-widest"
                    style={{ color: cfg.accent }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Event detail */}
                <div className="flex-1 min-w-0">
                  {event.kind === "pit-stop" && (() => {
                    const d = event.data as PitStopEvent;
                    const tSpec = tyreSpec(d.tyreCompound);
                    const tc = getTeamColor(d.teamName, d.teamColor);
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: tc }}
                        />
                        <span className="f-cond font-bold text-sm text-white">{d.driverName.split(" ").pop()}</span>
                        <span className="f-mono text-[10px] text-zinc-500">{d.teamName}</span>
                        <span className="text-zinc-700">→</span>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded f-cond font-black text-[10px]"
                          style={{ background: `${tSpec.color}22`, color: tSpec.color }}
                        >
                          <span className="w-3 h-3 rounded-full border" style={{ borderColor: tSpec.color, background: tSpec.color }} />
                          {tSpec.label}
                        </span>
                        <span className="f-mono text-[11px] font-bold text-zinc-300 ml-auto tabular-nums">
                          {formatDuration(d.durationMs)}
                        </span>
                      </div>
                    );
                  })()}

                  {event.kind === "incident" && (() => {
                    const d = event.data as RaceIncident;
                    const icon = INCIDENT_ICONS[d.type] || "⚠";
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm">{icon}</span>
                        {d.driverName && (
                          <span className="f-cond font-bold text-sm text-white">{d.driverName.split(" ").pop()}</span>
                        )}
                        <span
                          className="f-mono text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            color: d.type.includes("FLAG") || d.type.includes("SAFETY") ? "#facc15" : "#ef4444",
                            background: d.type.includes("FLAG") || d.type.includes("SAFETY")
                              ? "rgba(234,179,8,.12)"
                              : "rgba(239,68,68,.1)",
                          }}
                        >
                          {d.type.replace(/_/g, " ")}
                        </span>
                        <span className="f-mono text-[11px] text-zinc-400">{d.description}</span>
                      </div>
                    );
                  })()}

                  {event.kind === "weather" && (() => {
                    const d = event.data as WeatherChange;
                    const icon = WEATHER_ICONS[d.condition] || "🌤";
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="f-cond font-bold text-sm text-white">{d.condition}</span>
                        <span className="f-mono text-[11px] text-zinc-500">{d.trackTempC}°C track</span>
                      </div>
                    );
                  })()}

                  {event.kind === "fastest-lap" && (() => {
                    const d = event as Extract<TimelineEvent, { kind: "fastest-lap" }>;
                    const tc = getTeamColor(undefined, d.teamColor);
                    const m = Math.floor(d.time / 60);
                    const s = (d.time % 60).toFixed(3).padStart(6, "0");
                    return (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: tc }} />
                        <span className="f-cond font-bold text-sm text-white">{d.driverName.split(" ").pop()}</span>
                        <span className="f-mono text-[11px] font-bold" style={{ color: "#a855f7" }}>
                          {m}:{s}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Lap position indicator on the right */}
                <div className="flex-shrink-0 w-16 hidden sm:block">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(event.lap / maxLap) * 100}%`,
                        background: cfg.accent,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
