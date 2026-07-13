"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { authFetch } from "../lib/pitwall-auth";
import { F1, getTeamColor, tyre as tyreSpec, flagForCountry } from "../lib/f1-theme";
import Navbar from "../components/Navbar";
import PitwallBackground from "../components/PitwallBackground";
import { BASE_URL as API } from "../lib/api-client";
import type { TelemetryData, LiveStatus } from "../types/f1";

/* ── WebSocket types (same globals as telemetry page) ───────────────────── */
interface TelemetryFrame { body: string; }
interface StompSubscription { unsubscribe: () => void; }
interface StompClient {
  debug: ((message: string) => void) | null;
  connect: (headers: Record<string, string>, onConnect: () => void, onError?: (error: unknown) => void) => void;
  subscribe: (destination: string, callback: (message: TelemetryFrame) => void) => StompSubscription;
  disconnect: (callback?: () => void) => void;
}
interface StompFactory { over: (webSocketFactory: () => unknown) => StompClient; }

declare global {
  interface Window {
    SockJS: new (url: string) => unknown;
    Stomp?: StompFactory;
    StompJs?: { Stomp: StompFactory };
  }
}

/* ── Timing-specific types ──────────────────────────────────────────────── */
interface TimingRow {
  position: number;
  prevPosition: number;
  driverName: string;
  driverCode: string;   // 3-letter abbreviation
  teamName: string;
  teamColor: string;
  carNumber: number;
  gapToLeader: number;
  intervalToAhead: number;
  lastLap: number;
  sector1: number;
  sector2: number;
  sector3: number;
  bestS1: number;
  bestS2: number;
  bestS3: number;
  tyreCompound: string;
  tyreAge: number;
  pitStops: number;
  drsActive: boolean;
  speed: number;
  gear: number;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function driverCode(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  // Last name first 3 chars
  const last = parts[parts.length - 1];
  return last.slice(0, 3).toUpperCase();
}

function formatGap(seconds: number): string {
  if (seconds <= 0) return "LEADER";
  return `${seconds.toFixed(3)}`;
}

function formatLapTime(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function formatSector(sec: number): string {
  if (!sec || sec <= 0) return "—";
  return sec.toFixed(3);
}

function sectorColor(
  current: number,
  personalBest: number,
  overallBest: number
): "purple" | "green" | "yellow" | "default" {
  if (!current || current <= 0) return "default";
  if (overallBest > 0 && current <= overallBest) return "purple";
  if (personalBest > 0 && current <= personalBest) return "green";
  return "yellow";
}

const SECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  purple:  { bg: "rgba(168,85,247,.22)", text: "#c084fc" },
  green:   { bg: "rgba(34,197,94,.18)",  text: "#4ade80" },
  yellow:  { bg: "rgba(234,179,8,.15)",  text: "#facc15" },
  default: { bg: "transparent",          text: "rgba(255,255,255,.45)" },
};

const STAGGER = {
  hidden: { opacity: 0, x: -8 },
  show: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.015, duration: 0.3 } }),
};

/* ═══════════════════════════════════════════════════════════════════════════
 * LIVE TIMING PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function LiveTimingPage() {
  const [connected, setConnected] = useState(false);
  const [drivers, setDrivers] = useState<TelemetryData[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [rows, setRows] = useState<TimingRow[]>([]);
  const stompRef = useRef<StompClient | null>(null);

  // Stateful tracking across updates
  const prevPositions = useRef<Record<string, number>>({});
  const sectorBests = useRef<Record<string, { s1: number; s2: number; s3: number }>>({});
  const overallBests = useRef<{ s1: number; s2: number; s3: number }>({ s1: Infinity, s2: Infinity, s3: Infinity });
  const tyreState = useRef<Record<string, { compound: string; age: number; stops: number }>>({});

  /* ── Sector time simulation ──────────────────────────────────────────── */
  const simulateSectors = useCallback((lapTimeSec: number, driverKey: string) => {
    if (!lapTimeSec || lapTimeSec <= 0) return { s1: 0, s2: 0, s3: 0 };

    // Split lap time into realistic sector proportions: S1 ~25%, S2 ~45%, S3 ~30%
    const base = lapTimeSec * 0.98; // leave room for variation
    const s1 = base * 0.25 + (Math.sin(Date.now() * 0.001 + driverKey.charCodeAt(0)) * 0.08);
    const s2 = base * 0.45 + (Math.cos(Date.now() * 0.0013 + driverKey.charCodeAt(2)) * 0.1);
    const s3 = Math.max(0.001, lapTimeSec - s1 - s2);

    return { s1: Math.max(15, s1), s2: Math.max(25, s2), s3: Math.max(15, s3) };
  }, []);

  /* ── WebSocket connection ────────────────────────────────────────────── */
  useEffect(() => {
    const connect = () => {
      const stompFactory = window.Stomp ?? window.StompJs?.Stomp;
      if (!stompFactory) { setTimeout(connect, 500); return; }
      const wsUrl = API + "/ws";
      const stompClient = stompFactory.over(() => new window.SockJS(wsUrl));
      stompClient.debug = null;
      stompClient.connect({}, () => {
        setConnected(true);
        stompClient.subscribe("/topic/telemetry", (msg: TelemetryFrame) => {
          const data: TelemetryData[] = JSON.parse(msg.body);
          setDrivers(data);
        });
      }, () => setConnected(false));
      stompRef.current = stompClient;
    };

    const s1 = document.createElement("script");
    s1.src = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";
    s1.onerror = () => console.warn("[LiveTiming] SockJS load failed");
    document.head.appendChild(s1);
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@6/bundles/stomp.umd.min.js";
      s2.onerror = () => console.warn("[LiveTiming] StompJS load failed");
      document.head.appendChild(s2);
      s2.onload = () => setTimeout(connect, 100);
    };
    return () => { stompRef.current?.disconnect(); };
  }, []);

  /* ── Live status polling ─────────────────────────────────────────────── */
  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const res = await authFetch(`${API}/api/openf1/status`);
        setLiveStatus(await res.json());
      } catch { /* silently fail */ }
    };
    checkLiveStatus();
    const id = setInterval(checkLiveStatus, 15000);
    return () => clearInterval(id);
  }, []);

  /* ── Build timing rows from telemetry data ───────────────────────────── */
  useEffect(() => {
    if (!drivers.length) return;

    const sorted = [...drivers].sort((a, b) => a.position - b.position);

    const newRows: TimingRow[] = sorted.map((d) => {
      const key = d.driverName;
      const code = driverCode(d.driverName);
      const prevPos = prevPositions.current[key] || d.position;

      // Sector simulation
      const { s1, s2, s3 } = simulateSectors(d.lapTime, key);

      // Personal bests
      const pb = sectorBests.current[key] || { s1: Infinity, s2: Infinity, s3: Infinity };
      if (s1 > 0 && s1 < pb.s1) pb.s1 = s1;
      if (s2 > 0 && s2 < pb.s2) pb.s2 = s2;
      if (s3 > 0 && s3 < pb.s3) pb.s3 = s3;
      sectorBests.current[key] = pb;

      // Overall bests
      if (s1 > 0 && s1 < overallBests.current.s1) overallBests.current.s1 = s1;
      if (s2 > 0 && s2 < overallBests.current.s2) overallBests.current.s2 = s2;
      if (s3 > 0 && s3 < overallBests.current.s3) overallBests.current.s3 = s3;

      // Tyre tracking
      const ts = tyreState.current[key] || { compound: d.tyreType, age: 0, stops: 0 };
      if (ts.compound !== d.tyreType) {
        ts.stops += 1;
        ts.compound = d.tyreType;
        ts.age = 0;
      }
      // Increment tyre age when lap changes (heuristic: gap changes indicate new lap)
      if (d.lap > 0) ts.age = d.lap - (ts.age > 0 ? d.lap - 1 : d.lap);
      tyreState.current[key] = ts;

      // Calculate tyre age properly: track lap changes per driver
      // Simple approach: age = current lap # - lap when tyre was fitted
      // Since we don't have stint start lap, we estimate from lap count

      // Interval to ahead
      const idx = sorted.indexOf(d);
      const ahead = idx > 0 ? sorted[idx - 1] : null;
      const interval = ahead ? Math.max(0, d.gap - ahead.gap) : 0;

      return {
        position: d.position,
        prevPosition: prevPos,
        driverName: d.driverName,
        driverCode: code,
        teamName: d.teamName,
        teamColor: getTeamColor(d.teamName, d.teamColor),
        carNumber: d.carNumber,
        gapToLeader: d.gap,
        intervalToAhead: interval,
        lastLap: d.lapTime,
        sector1: s1,
        sector2: s2,
        sector3: s3,
        bestS1: pb.s1 === Infinity ? s1 : pb.s1,
        bestS2: pb.s2 === Infinity ? s2 : pb.s2,
        bestS3: pb.s3 === Infinity ? s3 : pb.s3,
        tyreCompound: d.tyreType,
        tyreAge: ts.age,
        pitStops: ts.stops,
        drsActive: d.drsActive,
        speed: d.speed,
        gear: d.gear,
      };
    });

    // Update previous positions for next cycle
    sorted.forEach((d) => {
      prevPositions.current[d.driverName] = d.position;
    });

    setRows(newRows);
  }, [drivers, simulateSectors]);

  /* ── Column width constants ──────────────────────────────────────────── */
  const COL = {
    POS:    "w-[52px]",
    DRIVER: "flex-1 min-w-[140px]",
    GAP:    "w-[108px]",
    INT:    "w-[108px]",
    LAST:   "w-[108px]",
    S1:     "w-[72px]",
    S2:     "w-[72px]",
    S3:     "w-[72px]",
    TYRE:   "w-[82px]",
    PIT:    "w-[52px]",
    DRS:    "w-[52px]",
  };

  const overallBest = overallBests.current;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <PitwallBackground glow="top-left" streaks={3} />
      <Navbar />

      <main className="relative z-10 max-w-full mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4 rise">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="inline-block w-8 h-[3px]"
                style={{ background: connected ? F1.green : F1.red }}
              />
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">
                {liveStatus?.isLive ? "LIVE SESSION" : "TIMING FEED"}
              </span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(36px,6vw,64px)" }}>
              <span className="block text-white">LIVE</span>
              <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>
                TIMING TOWER
              </span>
            </h1>
            {liveStatus && (
              <p className="f-mono text-xs text-zinc-500 mt-2">
                {flagForCountry(liveStatus.countryName)} {liveStatus.circuitName} · {liveStatus.sessionName}
              </p>
            )}
          </div>

          {/* Connection badge */}
          <div
            className="flex items-center gap-2 rounded-xl border px-3.5 py-2"
            style={{
              borderColor: connected ? "rgba(0,230,118,.3)" : "rgba(225,6,0,.3)",
              background: connected ? "rgba(0,230,118,.06)" : "rgba(225,6,0,.06)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: connected ? F1.green : F1.red,
                animation: connected ? "live-pulse 1.6s infinite" : "none",
              }}
            />
            <span
              className="f-mono text-[11px] font-bold tracking-wider"
              style={{ color: connected ? F1.green : "#ff6a52" }}
            >
              {connected ? "LIVE" : "CONNECTING"}
            </span>
          </div>
        </div>

        {/* ── Session banner ──────────────────────────────────────────── */}
        {liveStatus?.isLive && (
          <div
            className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-xl border text-sm f-mono"
            style={{
              borderColor: "rgba(225,6,0,.25)",
              background: "linear-gradient(90deg,rgba(225,6,0,.1),rgba(15,15,18,.6))",
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: F1.red, animation: "live-pulse 1.6s infinite" }} />
            <span className="text-white font-bold">
              {liveStatus.sessionEmoji} {liveStatus.sessionType?.toUpperCase()} · {liveStatus.sessionName}
            </span>
            <span className="text-zinc-500">{liveStatus.driversCount} drivers on track</span>
          </div>
        )}

        {/* ── Not connected state ─────────────────────────────────────── */}
        {!connected && (
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: "rgba(225,6,0,.18)" }} />
              <div className="absolute inset-0 border-2 border-transparent rounded-full" style={{ borderTopColor: F1.red, animation: "spin-slow .9s linear infinite" }} />
              <div className="absolute inset-[7px] border border-transparent rounded-full" style={{ borderBottomColor: "rgba(225,6,0,.5)", animation: "spin-slow .7s linear infinite reverse" }} />
              <div className="absolute inset-0 flex items-center justify-center f-cond font-black text-[10px]" style={{ color: F1.red }}>F1</div>
            </div>
            <p className="f-mono text-[11px] tracking-[0.3em]" style={{ color: "#ff6a52" }}>ESTABLISHING TIMING LINK…</p>
            <p className="f-mono text-[10px] text-zinc-600">Waiting for telemetry feed</p>
          </div>
        )}

        {/* ── No data state ───────────────────────────────────────────── */}
        {connected && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-14 h-14 rounded-2xl border flex items-center justify-center"
              style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
              <span className="text-2xl">⏱</span>
            </div>
            <p className="f-cond font-black text-xl text-white">Waiting for Data</p>
            <p className="f-mono text-xs text-zinc-500">Timing data will appear once the session is live</p>
          </div>
        )}

        {/* ══════════════════ TIMING TOWER ══════════════════════════════ */}
        {connected && rows.length > 0 && (
          <div
            className="relative rounded-2xl border overflow-hidden"
            style={{ background: "rgba(18,18,21,.85)", borderColor: "rgba(255,255,255,.08)" }}
          >
            {/* Top accent line */}
            <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />

            {/* ═══ COLUMN HEADERS ═══ */}
            <div
              className="flex items-center gap-0 px-4 sm:px-5 py-3 border-b text-[10px] f-mono tracking-widest uppercase select-none sticky top-0 z-10"
              style={{
                borderColor: "rgba(255,255,255,.06)",
                background: "rgba(16,16,20,.95)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span className={`${COL.POS} text-zinc-500`}>POS</span>
              <span className={`${COL.DRIVER} text-zinc-500`}>DRIVER</span>
              <span className={`${COL.GAP} text-right text-zinc-500`}>GAP</span>
              <span className={`${COL.INT} text-right text-zinc-500 hidden sm:block`}>INT</span>
              <span className={`${COL.LAST} text-right text-zinc-500`}>LAST</span>
              <span className={`${COL.S1} text-right text-zinc-500 hidden md:block`}>S1</span>
              <span className={`${COL.S2} text-right text-zinc-500 hidden md:block`}>S2</span>
              <span className={`${COL.S3} text-right text-zinc-500 hidden md:block`}>S3</span>
              <span className={`${COL.TYRE} text-center text-zinc-500`}>TYRE</span>
              <span className={`${COL.PIT} text-center text-zinc-500 hidden sm:block`}>PIT</span>
              <span className={`${COL.DRS} text-center text-zinc-500`}>DRS</span>
            </div>

            {/* ═══ DRIVER ROWS ═══ */}
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {rows.map((row, i) => {
                const posUp = row.prevPosition > row.position;
                const posDown = row.prevPosition < row.position;
                const posSame = row.prevPosition === row.position;
                const isP1 = row.position === 1;
                const tSpec = tyreSpec(row.tyreCompound);
                const s1Type = sectorColor(row.sector1, row.bestS1, overallBest.s1);
                const s2Type = sectorColor(row.sector2, row.bestS2, overallBest.s2);
                const s3Type = sectorColor(row.sector3, row.bestS3, overallBest.s3);

                return (
                  <motion.div
                    key={row.driverName}
                    custom={i}
                    variants={STAGGER}
                    initial="hidden"
                    animate="show"
                    className="flex items-center gap-0 px-4 sm:px-5 py-3 border-b transition-colors group"
                    style={{
                      borderColor: "rgba(255,255,255,.04)",
                      background: isP1 ? "rgba(255,210,0,.03)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,.008)",
                    }}
                    whileHover={{ backgroundColor: "rgba(255,255,255,.025)" }}
                  >
                    {/* ── Position ──────────────────────────────────── */}
                    <div className={`${COL.POS} flex items-center gap-1`}>
                      <span
                        className="f-cond font-black text-xl tabular-nums leading-none"
                        style={{ color: isP1 ? F1.gold : row.position <= 3 ? "#9ca3af" : "#52525b" }}
                      >
                        {row.position}
                      </span>
                      {/* Position change indicator */}
                      {!posSame && (
                        <span
                          className="f-cond font-black text-xs leading-none"
                          style={{ color: posUp ? F1.green : F1.red }}
                        >
                          {posUp ? "▲" : "▼"}
                        </span>
                      )}
                    </div>

                    {/* ── Driver ────────────────────────────────────── */}
                    <div className={`${COL.DRIVER} flex items-center gap-3 min-w-0`}>
                      {/* Team color bar */}
                      <div
                        className="w-[3px] h-9 rounded-full flex-shrink-0"
                        style={{ background: row.teamColor, boxShadow: `0 0 8px ${row.teamColor}60` }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="f-cond font-black text-sm sm:text-base text-white uppercase tracking-tight leading-none truncate">
                            {row.driverCode}
                          </span>
                          <span className="f-mono text-[10px] text-zinc-600 hidden sm:inline">
                            {row.driverName}
                          </span>
                        </div>
                        <p className="f-mono text-[10px] mt-0.5" style={{ color: row.teamColor }}>
                          {row.teamName} · #{row.carNumber}
                        </p>
                      </div>
                    </div>

                    {/* ── Gap to leader ─────────────────────────────── */}
                    <div className={`${COL.GAP} text-right`}>
                      <span
                        className={`f-cond font-black text-sm tabular-nums ${isP1 ? "" : "text-zinc-300"}`}
                        style={{ color: isP1 ? F1.gold : undefined }}
                      >
                        {isP1 ? "LEADER" : `+${formatGap(row.gapToLeader)}`}
                      </span>
                    </div>

                    {/* ── Interval to ahead ─────────────────────────── */}
                    <div className={`${COL.INT} text-right hidden sm:block`}>
                      <span className="f-mono text-xs text-zinc-500 tabular-nums">
                        {isP1 ? "—" : `+${row.intervalToAhead.toFixed(3)}`}
                      </span>
                    </div>

                    {/* ── Last lap ───────────────────────────────────── */}
                    <div className={`${COL.LAST} text-right`}>
                      <span className={`f-mono text-xs font-bold tabular-nums ${row.lastLap > 0 ? "text-zinc-300" : "text-zinc-700"}`}>
                        {row.lastLap > 0 ? formatLapTime(row.lastLap) : "—"}
                      </span>
                    </div>

                    {/* ── S1 ─────────────────────────────────────────── */}
                    <div className={`${COL.S1} text-right hidden md:block`}>
                      {row.sector1 > 0 ? (
                        <span
                          className="f-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded"
                          style={{
                            color: SECTOR_COLORS[s1Type].text,
                            background: SECTOR_COLORS[s1Type].bg,
                          }}
                        >
                          {formatSector(row.sector1)}
                        </span>
                      ) : (
                        <span className="f-mono text-xs text-zinc-700">—</span>
                      )}
                    </div>

                    {/* ── S2 ─────────────────────────────────────────── */}
                    <div className={`${COL.S2} text-right hidden md:block`}>
                      {row.sector2 > 0 ? (
                        <span
                          className="f-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded"
                          style={{
                            color: SECTOR_COLORS[s2Type].text,
                            background: SECTOR_COLORS[s2Type].bg,
                          }}
                        >
                          {formatSector(row.sector2)}
                        </span>
                      ) : (
                        <span className="f-mono text-xs text-zinc-700">—</span>
                      )}
                    </div>

                    {/* ── S3 ─────────────────────────────────────────── */}
                    <div className={`${COL.S3} text-right hidden md:block`}>
                      {row.sector3 > 0 ? (
                        <span
                          className="f-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded"
                          style={{
                            color: SECTOR_COLORS[s3Type].text,
                            background: SECTOR_COLORS[s3Type].bg,
                          }}
                        >
                          {formatSector(row.sector3)}
                        </span>
                      ) : (
                        <span className="f-mono text-xs text-zinc-700">—</span>
                      )}
                    </div>

                    {/* ── Tyre ───────────────────────────────────────── */}
                    <div className={`${COL.TYRE} flex items-center justify-center gap-1.5`}>
                      {/* Tyre compound icon */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center f-cond font-black text-[10px] border-2 flex-shrink-0"
                        style={{
                          borderColor: tSpec.color,
                          background: `${tSpec.color}20`,
                          color: tSpec.color,
                        }}
                      >
                        {tSpec.letter}
                      </div>
                      {/* Tyre age */}
                      <span className="f-mono text-[10px] text-zinc-500 tabular-nums">
                        {row.tyreAge > 0 ? row.tyreAge : "0"}
                      </span>
                    </div>

                    {/* ── Pit stops ──────────────────────────────────── */}
                    <div className={`${COL.PIT} text-center hidden sm:block`}>
                      <span className="f-cond font-black text-sm tabular-nums" style={{ color: row.pitStops > 0 ? "#fff" : "#52525b" }}>
                        {row.pitStops}
                      </span>
                    </div>

                    {/* ── DRS ─────────────────────────────────────────── */}
                    <div className={`${COL.DRS} flex justify-center`}>
                      {row.drsActive ? (
                        <span
                          className="f-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            color: F1.green,
                            background: "rgba(0,230,118,.15)",
                            border: "1px solid rgba(0,230,118,.3)",
                          }}
                        >
                          DRS
                        </span>
                      ) : (
                        <span className="f-mono text-[10px] text-zinc-700">—</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Legend footer ──────────────────────────────────────── */}
            <div
              className="flex items-center gap-5 px-5 py-2.5 border-t f-mono text-[9px] tracking-widest flex-wrap"
              style={{ borderColor: "rgba(255,255,255,.06)", background: "rgba(8,8,10,.6)" }}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#c084fc" }} />
                <span className="text-zinc-500">PURPLE = OVERALL BEST</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4ade80" }} />
                <span className="text-zinc-500">GREEN = PERSONAL BEST</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#facc15" }} />
                <span className="text-zinc-500">YELLOW = NORMAL</span>
              </span>
              <span className="text-zinc-700 ml-auto">
                {rows.length} DRIVERS · {connected ? "LIVE" : "DISCONNECTED"}
              </span>
            </div>
          </div>
        )}

        <p className="text-center f-mono text-[10px] text-zinc-700 mt-6 tracking-widest">
          F1 PITWALL · LIVE TIMING · SECTOR TIMES SIMULATED
        </p>
      </main>

      {/* Keyframe animations */}
      <style>{`
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        @keyframes live-pulse{0%,100%{box-shadow:0 0 0 0 rgba(225,6,0,.6)}70%{box-shadow:0 0 0 6px rgba(225,6,0,0)}}
        @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes grid-pan{from{background-position:0 0}to{background-position:0 80px}}
        @keyframes streak{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(60vw);opacity:0}}
        .rise{animation:rise .45s cubic-bezier(.16,1,.3,1) both}
      `}</style>
    </div>
  );
}
