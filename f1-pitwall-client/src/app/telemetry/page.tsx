"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { authFetch } from "../lib/pitwall-auth";
import { F1, getTeamColor, tyre as tyreSpec, flagForCountry } from "../lib/f1-theme";
import PitwallBackground from "../components/PitwallBackground";
import Navbar from "../components/Navbar";
import SteeringWheelHUD from "../components/SteeringWheelHUD";
import LiveTrackMap from "../components/LiveTrackMap";
import TelemetryComparator from "../components/TelemetryComparator";
import TyreThermalDisplay from "../components/TyreThermalDisplay";
import GForceCircle from "../components/GForceCircle";
import { BASE_URL as API } from "../lib/api-client";
import { fetchCircuitGeometry } from "../lib/f1-data";
import type {
  TelemetryData,
  LiveTyreData,
  LiveStatus,
  CircuitInfo,
  CircuitGeometry,
} from "../types/f1";

declare global {
  interface Window {
    SockJS: new (url: string) => unknown;
    Stomp?: StompFactory;
    StompJs?: { Stomp: StompFactory };
  }
}

interface TelemetryFrame { body: string; }
interface StompClient {
  debug: ((message: string) => void) | null;
  connect: (headers: Record<string, string>, onConnect: () => void, onError?: (error: unknown) => void) => void;
  subscribe: (destination: string, callback: (message: TelemetryFrame) => void) => { unsubscribe: () => void };
  disconnect: (callback?: () => void) => void;
}
interface StompFactory { over: (webSocketFactory: () => unknown) => StompClient; }

const MAX_HISTORY = 40;

const MAX_LAPS: Record<string, number> = {
  SOFT: 20, MEDIUM: 30, HARD: 40, INTERMEDIATE: 25, INTER: 25, WET: 30, UNKNOWN: 30,
};
const maxLapsFor = (t: string) => MAX_LAPS[(t || "").toUpperCase()] ?? 30;

// Static fallback grid shown before the live feed connects.
const MOCK_RUNNING_ORDER: TelemetryData[] = [
  { driverName: "Max Verstappen", teamName: "Red Bull Racing", teamColor: "#3671C6", carNumber: 1, position: 1, speed: 312, gear: 7, rpm: 11800, drsActive: true, gap: 0, throttle: 94, brake: 0, tyreTemp: 104, fuelLoad: 42, lap: 28, lapTime: 81.42, tyreType: "SOFT", timestamp: 0 },
  { driverName: "Charles Leclerc", teamName: "Ferrari", teamColor: "#E8002D", carNumber: 16, position: 2, speed: 308, gear: 7, rpm: 11600, drsActive: true, gap: 1.2, throttle: 90, brake: 0, tyreTemp: 101, fuelLoad: 41, lap: 28, lapTime: 81.65, tyreType: "MEDIUM", timestamp: 0 },
  { driverName: "Lando Norris", teamName: "McLaren", teamColor: "#FF8000", carNumber: 4, position: 3, speed: 306, gear: 7, rpm: 11500, drsActive: false, gap: 2.8, throttle: 88, brake: 0, tyreTemp: 99, fuelLoad: 43, lap: 28, lapTime: 81.98, tyreType: "HARD", timestamp: 0 },
];

function SpeedChart({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, pad = 4, min = 150, max = 360;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.045)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (h - pad * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    if (data.length < 2) return;
    const pt = (v: number, i: number): [number, number] => [
      (i / (MAX_HISTORY - 1)) * w,
      h - pad - ((v - min) / (max - min)) * (h - pad * 2),
    ];
    ctx.beginPath();
    data.forEach((v, i) => { const [x, y] = pt(v, i); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    const last = pt(data[data.length - 1], data.length - 1);
    ctx.lineTo(last[0], h); ctx.lineTo(0, h); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, color + "33"); fill.addColorStop(1, color + "00");
    ctx.fillStyle = fill; ctx.fill();
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, color + "55"); grad.addColorStop(1, color);
    ctx.beginPath();
    data.forEach((v, i) => { const [x, y] = pt(v, i); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(last[0], last[1], 2.2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }, [data, color]);
  return <canvas ref={canvasRef} width={220} height={50} className="w-full" />;
}

type SeriesPoint = { i: number; a?: number; b?: number };
function DetailChart({
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

function GaugeBar({ value, max, color, label, unit = "%", optimal }: {
  value: number; max: number; color: string; label: string; unit?: string;
  optimal?: [number, number];
}) {
  const pct = Math.min((value / max) * 100, 100);
  const inWindow = optimal ? value >= optimal[0] && value <= optimal[1] : true;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="f-mono text-[10px] tracking-widest text-zinc-500">{label}</span>
        <span className="f-cond font-black text-lg tabular-nums" style={{ color }}>
          {value.toFixed(0)}<span className="text-[10px] text-zinc-600 ml-0.5 f-mono">{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden relative" style={{ background: "rgba(255,255,255,.06)" }}>
        <motion.div className="h-full rounded-full"
          initial={false} animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          style={{ background: `linear-gradient(90deg,${color}99,${color})`, boxShadow: `0 0 10px ${color}70` }} />
        {optimal && !inWindow && (
          <span className="absolute top-1/2 -translate-y-1/2 right-1 w-1.5 h-1.5 rounded-full bg-[#FFD200]" />
        )}
      </div>
    </div>
  );
}

function TyreChip({ type, size = "sm" }: { type: string; size?: "sm" | "lg" }) {
  const t = tyreSpec(type);
  const dim = size === "lg" ? "w-7 h-7 text-sm" : "w-5 h-5 text-[10px]";
  return (
    <span className={`inline-flex items-center justify-center rounded-full border-2 f-cond font-black ${dim}`}
      style={{ borderColor: t.color, color: t.color, background: `${t.color}14` }}>
      {t.letter}
    </span>
  );
}

/** Words shared by most circuit names, which therefore say nothing about which one this is. */
const CIRCUIT_STOPWORDS = new Set([
  "circuit", "international", "autodromo", "autodrome", "street", "racing",
  "grand", "prix", "the", "and", "park", "ring", "speedway",
]);

function nameTokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !CIRCUIT_STOPWORDS.has(word));
  return new Set(words);
}

/**
 * The circuit a live session is being held at.
 *
 * Matching on shared name words rather than on the country is deliberate: several countries host
 * more than one Grand Prix, and country alone would happily put a neighbouring circuit's racing
 * line and lap trace on screen. No shared word means no match rather than a guess.
 */
function matchCircuit(circuits: CircuitInfo[], sessionCircuit?: string): CircuitInfo | null {
  if (!sessionCircuit) return null;
  const wanted = nameTokens(sessionCircuit);

  let best: CircuitInfo | null = null;
  let bestScore = 0;
  for (const circuit of circuits) {
    const shared = [...nameTokens(`${circuit.name} ${circuit.city}`)]
      .filter((token) => wanted.has(token)).length;
    if (shared > bestScore) {
      best = circuit;
      bestScore = shared;
    }
  }
  return best;
}

const STAGGER = { hidden: { opacity: 0, y: 14 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.02, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } }) };
const PANEL = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const } };

export default function TelemetryPage() {
  const [connected, setConnected] = useState(false);
  const [drivers, setDrivers] = useState<TelemetryData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "compare" | "radar" | "tyres">("single");
  const [speedHistory, setSpeedHistory] = useState<Record<string, number[]>>({});
  const [rpmHistory, setRpmHistory] = useState<Record<string, number[]>>({});
  const [throttleHistory, setThrottleHistory] = useState<Record<string, number[]>>({});
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [liveTyreData, setLiveTyreData] = useState<LiveTyreData[]>([]);
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [geometry, setGeometry] = useState<CircuitGeometry | null>(null);
  const stompRef = useRef<StompClient | null>(null);

  useEffect(() => {
    const connect = () => {
      const stompFactory = window.Stomp ?? window.StompJs?.Stomp;
      if (!stompFactory) { setTimeout(connect, 500); return; }
      const wsUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/ws";
      const stompClient = stompFactory.over(() => new window.SockJS(wsUrl));
      stompClient.debug = null;
      stompClient.connect({}, () => {
        setConnected(true);
        stompClient.subscribe("/topic/telemetry", (msg: TelemetryFrame) => {
          const data: TelemetryData[] = JSON.parse(msg.body);
          setDrivers(data);
          setSpeedHistory(prev => { const n = { ...prev }; data.forEach(d => { n[d.driverName] = [...(n[d.driverName] || []).slice(-(MAX_HISTORY - 1)), d.speed]; }); return n; });
          setRpmHistory(prev => { const n = { ...prev }; data.forEach(d => { n[d.driverName] = [...(n[d.driverName] || []).slice(-(MAX_HISTORY - 1)), d.rpm]; }); return n; });
          setThrottleHistory(prev => { const n = { ...prev }; data.forEach(d => { n[d.driverName] = [...(n[d.driverName] || []).slice(-(MAX_HISTORY - 1)), d.throttle]; }); return n; });
        });
      }, () => setConnected(false));
      stompRef.current = stompClient;
    };
    const s1 = document.createElement("script");
    s1.src = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";
    s1.onerror = () => console.warn("[Telemetry] SockJS load failed");
    document.head.appendChild(s1);
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@6/bundles/stomp.umd.min.js";
      s2.onerror = () => console.warn("[Telemetry] StompJS load failed");
      document.head.appendChild(s2);
      s2.onload = () => setTimeout(connect, 100);
    };
    return () => { stompRef.current?.disconnect(); };
  }, []);

  const checkLiveStatus = async () => {
    try {
      const res = await authFetch(`${API}/api/openf1/status`);
      const status: LiveStatus = await res.json();
      setLiveStatus(status);
      if (status.isLive) {
        const tyreRes = await authFetch(`${API}/api/openf1/tyres`);
        setLiveTyreData(await tyreRes.json());
      }
    } catch (e) { console.error(e); }
  };

  const handleRefresh = async () => {
    try {
      await authFetch(`${API}/api/openf1/fetch`, { method: "POST" });
      await checkLiveStatus();
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    checkLiveStatus();
    const id = setInterval(checkLiveStatus, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    authFetch(`${API}/api/circuits`)
      .then((res) => res.json())
      .then(setCircuits)
      .catch(() => setCircuits([]));
  }, []);

  /**
   * The circuit whose racing line and lap trace the map and the G-force plot read. Between
   * sessions there is no live circuit to match, so the first one on record stands in until the
   * viewer picks another from the map's own switcher.
   */
  const activeCircuit = useMemo(
    () => matchCircuit(circuits, liveStatus?.circuitName) ?? circuits[0] ?? null,
    [circuits, liveStatus?.circuitName]
  );

  useEffect(() => {
    if (!activeCircuit) return;
    let cancelled = false;

    fetchCircuitGeometry(activeCircuit.id)
      .then((data) => { if (!cancelled) setGeometry(data); })
      .catch(() => { if (!cancelled) setGeometry(null); });

    return () => { cancelled = true; };
  }, [activeCircuit]);

  const selectedDriver = drivers.find(d => d.driverName === selected) || drivers[0];

  const singleSpeedSeries: SeriesPoint[] =
    ((selectedDriver && speedHistory[selectedDriver.driverName]) || []).map((v, i) => ({ i, a: v }));

  const MODES: { key: "single" | "compare" | "radar" | "tyres"; label: string }[] = [
    { key: "single", label: "STEERING & CAR" },
    { key: "compare", label: "H2H GHOST" },
    { key: "radar", label: "TRACK RADAR" },
    { key: "tyres", label: "TYRES" },
  ];

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <PitwallBackground glow="top-left" />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header Bar */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4 rise">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-block w-8 h-[3px] rounded-full" style={{ background: connected ? F1.green : F1.red, boxShadow: `0 0 8px ${connected ? F1.green : F1.red}` }} />
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-400 font-bold">
                REAL-TIME TELEMETRY SUITE
              </span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82] text-4xl sm:text-6xl">
              <span className="block text-white">PIT WALL <span className="text-[#E10600]">TELEMETRY</span></span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Segmented mode control */}
            <div className="relative flex gap-1 p-1 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
              {MODES.map(m => {
                const active = mode === m.key;
                const acc = m.key === "single" ? F1.red : m.key === "compare" ? "#3671C6" : m.key === "radar" ? "#00E5FF" : F1.orange;
                return (
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className="relative px-3.5 py-1.5 rounded-xl f-cond text-xs font-black tracking-wide transition-colors"
                    style={{ color: active ? acc : "rgba(255,255,255,.55)" }}>
                    {active && (
                      <motion.span layoutId="modePill" className="absolute inset-0 rounded-xl border"
                        style={{ borderColor: `${acc}66`, background: `${acc}22` }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Connection status */}
            <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 bg-black/50"
              style={{ borderColor: connected ? "rgba(0,230,118,.3)" : "rgba(225,6,0,.3)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? F1.green : F1.red, animation: "live 1.6s infinite" }} />
              <span className="f-mono text-[10px] font-black tracking-wider" style={{ color: connected ? F1.green : "#ff6a52" }}>
                {connected ? "LIVE STOMP 24ms" : "CONNECTING"}
              </span>
            </div>
          </div>
        </div>

        {/* Live session banner */}
        {liveStatus && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="flex items-center justify-between mb-6 px-4 py-3 rounded-2xl border bg-black/40 backdrop-blur-md flex-wrap gap-3 border-zinc-800">
            <div className="flex items-center gap-3 flex-wrap">
              {liveStatus.isLive && <span className="w-2 h-2 rounded-full bg-red-600 live-pulse" />}
              <span className="f-mono text-[11px] font-bold tracking-wider text-white">
                {liveStatus.isLive
                  ? `${liveStatus.sessionEmoji} ${liveStatus.sessionType?.toUpperCase()} · LIVE BROADCAST`
                  : "SIMULATOR STREAM · NO ACTIVE REAL-LIFE SESSION"}
              </span>
              {liveStatus.isLive && (
                <span className="f-mono text-[11px] text-zinc-400">
                  {flagForCountry(liveStatus.countryName)} {liveStatus.countryName}
                  {liveStatus.circuitName ? ` · ${liveStatus.circuitName}` : ""}
                </span>
              )}
            </div>
            <button onClick={handleRefresh}
              className="f-mono text-[11px] border border-zinc-700 hover:border-red-500 text-zinc-400 hover:text-white px-3 py-1 rounded-lg transition-all tracking-wider bg-zinc-900/60">
              ↻ SYNC NOW
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {mode === "radar" && (
            <motion.div key="radar" {...PANEL}>
              <LiveTrackMap
                telemetryList={drivers}
                selectedDriverId={selectedDriver?.driverName}
                onSelectDriver={(name) => setSelected(name)}
                circuits={circuits}
                circuitId={activeCircuit?.id}
              />
            </motion.div>
          )}

          {mode === "compare" && (
            <motion.div key="compare" {...PANEL}>
              <TelemetryComparator />
            </motion.div>
          )}

          {mode === "tyres" && (
            <motion.div key="tyres" {...PANEL}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {["SOFT", "MEDIUM", "HARD", "INTERMEDIATE"].map((compound, i) => {
                  const spec = tyreSpec(compound);
                  const count = drivers.filter(d => (d.tyreType || "").toUpperCase() === compound).length;
                  return (
                    <motion.div key={compound} variants={STAGGER} custom={i} initial="hidden" animate="show"
                      className="relative rounded-2xl border border-zinc-800 bg-black/60 overflow-hidden px-4 py-3.5 shadow-xl">
                      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: spec.color }} />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="f-cond font-black text-4xl tabular-nums leading-none" style={{ color: spec.color }}>{count}</p>
                          <p className="f-mono text-[10px] text-zinc-500 mt-1.5 tracking-widest">{spec.label}</p>
                        </div>
                        <TyreChip type={compound} size="lg" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...drivers].sort((a, b) => a.position - b.position).map((d, idx) => {
                  const col = getTeamColor(d.teamName, d.teamColor);
                  const spec = tyreSpec(d.tyreType);
                  const maxLaps = maxLapsFor(d.tyreType);
                  const life = Math.max(0, 100 - (d.lap / maxLaps) * 100);
                  const lifeColor = life < 20 ? F1.red : life < 50 ? F1.gold : spec.color;
                  const pitIn = Math.max(0, maxLaps - d.lap);
                  return (
                    <motion.div key={d.carNumber} variants={STAGGER} custom={idx} initial="hidden" animate="show"
                      whileHover={{ y: -4 }}
                      className="group relative rounded-2xl border border-zinc-800 bg-black/70 overflow-hidden shadow-xl p-4">
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="f-cond font-black text-2xl text-zinc-500 leading-none">P{d.position}</span>
                          <div>
                            <p className="f-cond font-black text-base text-white uppercase tracking-tight leading-none">{d.driverName.split(" ").pop()}</p>
                            <p className="f-mono text-[11px] mt-0.5" style={{ color: col }}>#{d.carNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
                          <TyreChip type={d.tyreType} />
                          <span className="f-cond font-black text-xs" style={{ color: spec.color }}>{spec.label}</span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="f-mono text-[9px] tracking-widest text-zinc-500">TYRE INTEGRITY</span>
                          <span className="f-cond font-black text-sm tabular-nums" style={{ color: lifeColor }}>{life.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-zinc-900">
                          <motion.div className="h-full rounded-full" initial={false} animate={{ width: `${life}%` }}
                            style={{ background: `linear-gradient(90deg,${lifeColor}99,${lifeColor})` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl py-1.5 text-center bg-zinc-900/80 border border-zinc-800">
                          <p className="f-cond font-black text-sm text-white">{d.lap}L</p>
                          <p className="f-mono text-[8px] text-zinc-500">AGE</p>
                        </div>
                        <div className="rounded-xl py-1.5 text-center bg-zinc-900/80 border border-zinc-800">
                          <p className="f-cond font-black text-sm" style={{ color: lifeColor }}>{life.toFixed(0)}%</p>
                          <p className="f-mono text-[8px] text-zinc-500">LIFE</p>
                        </div>
                        <div className="rounded-xl py-1.5 text-center bg-zinc-900/80 border border-zinc-800">
                          <p className="f-cond font-black text-sm text-amber-400">{pitIn}L</p>
                          <p className="f-mono text-[8px] text-zinc-500">PIT IN</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {mode === "single" && (
            <motion.div key="single" {...PANEL} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Driver Selection List (col-span-4) */}
              <div className="lg:col-span-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-block w-5 h-[2px] bg-red-600 shadow-[0_0_6px_#E10600]" />
                  <p className="f-mono text-[11px] tracking-[0.3em] text-zinc-400 font-bold">RACE RUNNING ORDER</p>
                </div>
                <div className="space-y-2.5 max-h-[780px] overflow-y-auto pr-1">
                  {(drivers.length > 0 ? drivers : MOCK_RUNNING_ORDER).map((d, idx) => {
                    const col = getTeamColor(d.teamName, d.teamColor);
                    const isSelected = d.driverName === (selected || (drivers[0]?.driverName || "Max Verstappen"));
                    return (
                      <motion.div key={d.driverName} variants={STAGGER} custom={idx} initial="hidden" animate="show"
                        onClick={() => setSelected(d.driverName)}
                        whileHover={{ y: -2 }}
                        className={`relative rounded-2xl p-3.5 cursor-pointer transition-all border shadow-md ${
                          isSelected
                            ? "bg-zinc-900 border-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                            : "bg-black/60 border-zinc-800/80 hover:border-zinc-700"
                        }`}>
                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-2xl" style={{ background: col, boxShadow: `0 0 10px ${col}` }} />}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="f-cond font-black text-xl text-zinc-500 w-6 leading-none">P{d.position}</span>
                            <div>
                              <p className="f-cond font-black text-sm text-white uppercase tracking-tight leading-none">{d.driverName}</p>
                              <p className="f-mono text-[11px] mt-0.5" style={{ color: col }}>{d.teamName} #{d.carNumber}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="f-orbitron font-black text-lg text-white tabular-nums leading-none">{d.speed.toFixed(0)}</p>
                            <p className="f-mono text-[9px] text-zinc-500">KM/H</p>
                          </div>
                        </div>
                        <SpeedChart data={speedHistory[d.driverName] || [d.speed]} color={col} />
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Digital Steering Wheel HUD & Deep Diagnostics (col-span-8) */}
              <div className="lg:col-span-8 space-y-6">
                {selectedDriver && (
                  <>
                    <SteeringWheelHUD
                      telemetry={selectedDriver}
                      driverName={selectedDriver.driverName}
                      carNumber={selectedDriver.carNumber}
                      teamName={selectedDriver.teamName}
                      teamColor={selectedDriver.teamColor}
                    />

                    {/* Speed Chart Graph */}
                    <div className="rounded-3xl border border-zinc-800 bg-black/60 p-5 shadow-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="f-mono text-xs font-bold text-zinc-400 tracking-widest">
                          SPEED TRACE TELEMETRY · LIVE ({MAX_HISTORY}S BUFFER)
                        </span>
                        <span className="f-orbitron text-xs font-black text-emerald-400">
                          {selectedDriver.speed.toFixed(0)} KM/H
                        </span>
                      </div>
                      <DetailChart
                        data={singleSpeedSeries}
                        colorA={getTeamColor(selectedDriver.teamName, selectedDriver.teamColor)}
                        labelA="KM/H"
                        height={180}
                        domain={[100, 360]}
                      />
                    </div>

                    {/* 4-Wheel Tyre Thermal Matrix & G-Force Kamm's Diagram */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-7">
                        <TyreThermalDisplay
                          compound={selectedDriver.tyreType}
                          measuredTempC={selectedDriver.tyreTemp}
                          tyreAge={selectedDriver.lap}
                          driverName={selectedDriver.driverName}
                          trace={geometry?.samples ?? []}
                        />
                      </div>
                      <div className="md:col-span-5">
                        <GForceCircle
                          trace={geometry?.samples ?? []}
                          sourceLabel={
                            geometry
                              ? `${geometry.circuitName} · ${geometry.sourceLabel}`
                              : undefined
                          }
                          size={280}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
