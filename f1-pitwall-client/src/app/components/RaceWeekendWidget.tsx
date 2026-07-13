"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "../lib/pitwall-auth";
import { flagForCountry } from "../lib/f1-theme";
import { BASE_URL as API } from "../lib/api-client";
import type { WidgetSession, WeekendData } from "../types/f1";

const SESSION_COLORS: Record<string, string> = {
  "Practice 1":        "#3b82f6",
  "Practice 2":        "#3b82f6",
  "Practice 3":        "#3b82f6",
  "Sprint Qualifying": "#FFD200",
  "Sprint":            "#ff5a3c",
  "Qualifying":        "#FFD200",
  "Race":              "#E10600",
};

const SESSION_LABELS: Record<string, string> = {
  "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
  "Sprint Qualifying": "SQ", "Sprint": "SPR", "Qualifying": "QUALI", "Race": "RACE",
};

function formatDuration(seconds: number): string {
  if (seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatLocalTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  } catch { return "—"; }
}

function formatLocalDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return "—"; }
}

export default function RaceWeekendWidget() {
  const [data,    setData]    = useState<WeekendData | null>(null);
  const [loading, setLoading] = useState(true);
  // tick is used to trigger re-render every second for live countdowns
  const [, setTick] = useState(0);

  const fetchWeekend = useCallback(async () => {
    try {
      const res  = await authFetch(`${API}/api/openf1/weekend`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("[Weekend]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeekend();
    const dataInterval = setInterval(fetchWeekend, 5 * 60 * 1000);
    return () => clearInterval(dataInterval);
  }, [fetchWeekend]);

  useEffect(() => {
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(tickInterval);
  }, []);

  /* ── Loading skeleton ────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="chamfer border border-[rgba(255,255,255,0.06)] p-5 animate-pulse"
        style={{ background: "rgba(18,18,21,0.78)" }}
      >
        <div className="h-3 bg-zinc-800 rounded w-28 mb-4" />
        <div className="h-5 bg-zinc-800 rounded w-44 mb-5" />
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-zinc-800 rounded-full" />
              <div className="flex-1 h-8 bg-zinc-800 rounded-lg" />
              <div className="w-14 h-4 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty / error state ─────────────────────────────────────────────── */
  if (!data || data.error || !data.sessions?.length) {
    return (
      <div
        className="chamfer border border-[rgba(255,255,255,0.06)] p-5"
        style={{ background: "rgba(18,18,21,0.78)" }}
      >
        <p className="f-mono text-xs text-zinc-500 tracking-widest mb-2">RACE WEEKEND</p>
        <p className="text-zinc-600 text-sm">No upcoming sessions found</p>
      </div>
    );
  }

  /* ── Derive live/upcoming status client-side ─────────────────────────── */
  const now = Date.now();
  const sessions = data.sessions.map((s: WidgetSession) => {
    const start = s.dateStart ? new Date(s.dateStart).getTime() : 0;
    const end   = s.dateEnd   ? new Date(s.dateEnd).getTime()   : start + 3600000;
    let status: "LIVE" | "UPCOMING" | "COMPLETED" = s.status;
    const startsIn = Math.floor((start - now) / 1000);
    const endsIn   = Math.floor((end   - now) / 1000);
    if (now > end)              status = "COMPLETED";
    else if (now >= start && now <= end) status = "LIVE";
    else                        status = "UPCOMING";
    return { ...s, status, startsIn, endsIn };
  });

  const currentSession = sessions.find(s => s.status === "LIVE")     || null;
  const nextSession    = sessions.find(s => s.status === "UPCOMING") || null;
  const flag           = flagForCountry(data.countryName);

  return (
    <div
      className="chamfer border border-[rgba(255,255,255,0.06)] overflow-hidden"
      style={{ background: "rgba(18,18,21,0.78)", backdropFilter: "blur(18px)" }}
    >
      {/* ── Widget header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
        <div>
          <p className="f-mono text-xs text-zinc-500 tracking-widest">RACE WEEKEND</p>
          <p className="f-cond text-base font-black text-white mt-0.5">
            {flag} {data.countryName}{data.circuitName ? ` · ${data.circuitName}` : ""}
          </p>
        </div>
        {currentSession && (
          <div
            className="flex items-center gap-1.5 bg-[#E10600]/10 border border-[#E10600]/30 rounded-lg px-3 py-1.5"
            style={{ boxShadow: "0 0 10px rgba(225,6,0,0.25)" }}
          >
            <div className="w-2 h-2 rounded-full bg-[#E10600]" style={{ animation: "live 1.2s ease-in-out infinite" }} />
            <span className="f-mono text-xs font-black text-[#E10600]">LIVE</span>
          </div>
        )}
      </div>

      {/* ── Live session hero banner ────────────────────────────────────── */}
      <AnimatePresence>
        {currentSession && (
          <motion.div
            key="live-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)]"
            style={{
              backgroundColor: (SESSION_COLORS[currentSession.name] ?? "#E10600") + "12",
              borderLeft: `3px solid ${SESSION_COLORS[currentSession.name] ?? "#E10600"}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="f-mono text-xs text-zinc-500 mb-0.5">NOW LIVE</p>
                <p className="f-cond text-base font-black text-white">{currentSession.name}</p>
              </div>
              <div className="text-right">
                <p
                  className="f-cond text-2xl font-black tabular-nums"
                  style={{ color: SESSION_COLORS[currentSession.name] ?? "#E10600" }}
                >
                  -{formatDuration(currentSession.endsIn || 0)}
                </p>
                <p className="f-mono text-xs text-zinc-600">remaining</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Next session banner ─────────────────────────────────────────── */}
      <AnimatePresence>
        {!currentSession && nextSession && (
          <motion.div
            key="next-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-zinc-800/25"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="f-mono text-xs text-zinc-500 mb-0.5">NEXT SESSION</p>
                <p className="f-cond text-base font-black text-white">{nextSession.name}</p>
                <p className="f-mono text-xs text-zinc-600">{formatLocalDate(nextSession.dateStart)}</p>
              </div>
              <div className="text-right">
                <p className="f-cond text-2xl font-black text-white tabular-nums">
                  {formatDuration(nextSession.startsIn || 0)}
                </p>
                <p className="f-mono text-xs text-zinc-600">{formatLocalTime(nextSession.dateStart)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Session timeline ────────────────────────────────────────────── */}
      <div className="p-4 space-y-1">
        {sessions.map((session, idx) => {
          const color  = SESSION_COLORS[session.name] || "#666";
          const isLive = session.status === "LIVE";
          const isDone = session.status === "COMPLETED";
          const isNext = !currentSession && session === nextSession;
          const label  = SESSION_LABELS[session.name] || session.name;

          return (
            <motion.div
              key={session.sessionKey || idx}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isLive
                  ? "bg-[#E10600]/10 border border-[#E10600]/20"
                  : isNext
                  ? "bg-zinc-800/50 border border-zinc-700/50"
                  : "border border-transparent hover:bg-zinc-800/20"
              }`}
            >
              {/* Status dot */}
              <div className="w-6 flex items-center justify-center flex-shrink-0">
                {isDone ? (
                  <div className="w-4 h-4 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center">
                    <span className="text-green-400 text-[9px] leading-none">✓</span>
                  </div>
                ) : isLive ? (
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
                ) : (
                  <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: color + "55" }} />
                )}
              </div>

              {/* Session label chip */}
              <div
                className="w-10 flex-shrink-0 text-center f-mono text-[10px] font-black px-1 py-0.5 rounded"
                style={{
                  color: isDone ? "#52525b" : color,
                  backgroundColor: isDone ? "transparent" : color + "18",
                }}
              >
                {label}
              </div>

              {/* Name + date */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate f-cond ${isDone ? "text-zinc-600" : isLive ? "text-white" : "text-zinc-300"}`}>
                  {session.name}
                  {isLive && (
                    <span className="ml-2 f-mono text-[10px] bg-[#E10600] text-white px-1.5 py-0.5 rounded font-black">LIVE</span>
                  )}
                </p>
                <p className="f-mono text-[10px] text-zinc-600">
                  {formatLocalDate(session.dateStart)} · {formatLocalTime(session.dateStart)}
                </p>
              </div>

              {/* Countdown */}
              <div className="text-right flex-shrink-0">
                {isLive && (
                  <p className="f-cond text-sm font-black tabular-nums" style={{ color }}>
                    -{formatDuration(session.endsIn || 0)}
                  </p>
                )}
                {!isDone && !isLive && session.startsIn && session.startsIn > 0 && (
                  <p className={`f-mono text-xs tabular-nums ${isNext ? "text-white font-bold" : "text-zinc-600"}`}>
                    {formatDuration(session.startsIn)}
                  </p>
                )}
                {isDone && <p className="f-mono text-[10px] text-zinc-700">DONE</p>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
