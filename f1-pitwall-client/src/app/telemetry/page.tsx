"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { F1, getTeamColor, tyre as tyreSpec, flagForCountry } from "../lib/f1-theme";
import PitwallBackground from "../components/PitwallBackground";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

declare global {
  interface Window {
    SockJS: new (url: string) => unknown;
    Stomp?: StompFactory;
    StompJs?: { Stomp: StompFactory };
  }
}

interface TelemetryFrame { body: string; }
interface StompSubscription { unsubscribe: () => void; }
interface StompClient {
  debug: ((message: string) => void) | null;
  connect: (headers: Record<string, string>, onConnect: () => void, onError?: (error: unknown) => void) => void;
  subscribe: (destination: string, callback: (message: TelemetryFrame) => void) => StompSubscription;
  disconnect: (callback?: () => void) => void;
}
interface StompFactory { over: (webSocketFactory: () => unknown) => StompClient; }

interface TelemetryData {
  driverName: string; teamName: string; teamColor: string;
  carNumber: number; lap: number; speed: number; rpm: number;
  gear: number; throttle: number; brake: number; drsActive: boolean;
  fuelLoad: number; tyreType: string; tyreTemp: number;
  lapTime: number; gap: number; position: number; timestamp: number;
}

interface LiveTyreData {
  driverNumber: number; driverName: string; teamName: string;
  teamColor: string; tyreCompound: string; tyreAge: number;
  lapStart: number; stintNumber: number; position: number;
  isLive: boolean; sessionName: string;
}

interface LiveStatus {
  isLive: boolean; sessionName: string; sessionType: string;
  circuitName: string; countryName: string; sessionEmoji: string;
  driversCount: number;
}

const MAX_HISTORY = 40;

// Tyre lifespan lookup (presentation only) — colors come from the shared `tyre()` helper.
const MAX_LAPS: Record<string, number> = {
  SOFT: 20, MEDIUM: 30, HARD: 40, INTERMEDIATE: 25, INTER: 25, WET: 30, UNKNOWN: 30,
};
const maxLapsFor = (t: string) => MAX_LAPS[(t || "").toUpperCase()] ?? 30;

/* ──────────────────────────────────────────────────────────────────────────
 * LIVE sparkline — kept on <canvas> for performance (≤10 drivers × 40 pts/sec).
 * Restyled: team-colored gradient stroke, soft glow, gradient fill, fine grid.
 * ────────────────────────────────────────────────────────────────────────── */
function SpeedChart({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, pad = 4, min = 150, max = 360;
    ctx.clearRect(0, 0, w, h);
    // gridlines
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
    // fill
    ctx.beginPath();
    data.forEach((v, i) => { const [x, y] = pt(v, i); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    const last = pt(data[data.length - 1], data.length - 1);
    ctx.lineTo(last[0], h); ctx.lineTo(0, h); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, color + "33"); fill.addColorStop(1, color + "00");
    ctx.fillStyle = fill; ctx.fill();
    // stroke with glow
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, color + "55"); grad.addColorStop(1, color);
    ctx.beginPath();
    data.forEach((v, i) => { const [x, y] = pt(v, i); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.stroke(); ctx.shadowBlur = 0;
    // leading dot
    ctx.beginPath(); ctx.arc(last[0], last[1], 2.2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }, [data, color]);
  return <canvas ref={canvasRef} width={220} height={50} className="w-full" />;
}

/* Recharts-backed detail chart (single + compare). Memoized rows keep it smooth. */
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

/* Radial-style gauge bar used for throttle / brake / tyre temp. */
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

/* Head-to-head split bar for COMPARE mode. */
function CompareRow({ label, v1, v2, color1, color2, unit = "" }: {
  label: string; v1: number; v2: number; color1: string; color2: string; unit?: string;
}) {
  const max = Math.max(v1, v2, 1);
  const lead = v1 === v2 ? 0 : v1 > v2 ? 1 : 2;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="f-cond font-black text-sm tabular-nums" style={{ color: color1, opacity: lead === 2 ? 0.55 : 1 }}>{v1.toFixed(0)}{unit}</span>
        <span className="f-mono text-[9px] tracking-widest text-zinc-600">{label}</span>
        <span className="f-cond font-black text-sm tabular-nums" style={{ color: color2, opacity: lead === 1 ? 0.55 : 1 }}>{v2.toFixed(0)}{unit}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="flex-1 flex justify-end">
          <motion.div className="h-1.5 rounded-full" initial={false} animate={{ width: `${(v1 / max) * 100}%` }}
            transition={{ type: "spring", stiffness: 130, damping: 20 }}
            style={{ background: color1, boxShadow: `0 0 6px ${color1}70` }} />
        </div>
        <div className="w-px h-3 bg-white/15" />
        <div className="flex-1">
          <motion.div className="h-1.5 rounded-full" initial={false} animate={{ width: `${(v2 / max) * 100}%` }}
            transition={{ type: "spring", stiffness: 130, damping: 20 }}
            style={{ background: color2, boxShadow: `0 0 6px ${color2}70` }} />
        </div>
      </div>
    </div>
  );
}

/* Small tyre compound chip. */
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

const STAGGER = { hidden: { opacity: 0, y: 14 }, show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.02, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } }) };
const PANEL = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const } };

export default function TelemetryPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [drivers, setDrivers] = useState<TelemetryData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [mode, setMode] = useState<"single" | "compare" | "tyres">("single");
  const [speedHistory, setSpeedHistory] = useState<Record<string, number[]>>({});
  const [rpmHistory, setRpmHistory] = useState<Record<string, number[]>>({});
  const [throttleHistory, setThrottleHistory] = useState<Record<string, number[]>>({});
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [liveTyreData, setLiveTyreData] = useState<LiveTyreData[]>([]);
  const stompRef = useRef<StompClient | null>(null);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
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
  }, [router]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkLiveStatus();
    const id = setInterval(checkLiveStatus, 15000);
    return () => clearInterval(id);
  }, []);

  const selectedDriver = drivers.find(d => d.driverName === selected) || drivers[0];
  const compareDriver = drivers.find(d => d.driverName === compareWith);

  // Derived recharts series. The React Compiler memoizes these automatically.
  const singleSpeedSeries: SeriesPoint[] =
    ((selectedDriver && speedHistory[selectedDriver.driverName]) || []).map((v, i) => ({ i, a: v }));

  const buildPair = (h: Record<string, number[]>): SeriesPoint[] => {
    const a = (selectedDriver && h[selectedDriver.driverName]) || [];
    const b = (compareDriver && h[compareDriver.driverName]) || [];
    const len = Math.max(a.length, b.length);
    const offA = len - a.length, offB = len - b.length;
    return Array.from({ length: len }, (_, i) => ({ i, a: i >= offA ? a[i - offA] : undefined, b: i >= offB ? b[i - offB] : undefined }));
  };
  const cmpSpeed = buildPair(speedHistory);
  const cmpThrottle = buildPair(throttleHistory);
  const cmpRpm = buildPair(rpmHistory);

  const MODES: { key: "single" | "compare" | "tyres"; label: string }[] = [
    { key: "single", label: "SINGLE" },
    { key: "compare", label: "COMPARE" },
    { key: "tyres", label: "TYRES" },
  ];
  const modeAccent = mode === "single" ? F1.red : mode === "compare" ? "#3671C6" : F1.orange;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <PitwallBackground glow="top-left" />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* ── Header ── */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-5 rise">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="inline-block w-8 h-[3px]" style={{ background: connected ? F1.green : F1.red }} />
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">
                REAL-TIME FEED · 2026 SEASON
              </span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(46px,7vw,82px)" }}>
              <span className="block text-white">LIVE</span>
              <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>TELEMETRY</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Segmented mode control */}
            <div className="relative flex gap-1 p-1 rounded-xl border border-white/8" style={{ background: "rgba(255,255,255,.03)" }}>
              {MODES.map(m => {
                const active = mode === m.key;
                const acc = m.key === "single" ? F1.red : m.key === "compare" ? "#3671C6" : F1.orange;
                return (
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className="relative px-4 py-2 rounded-lg f-cond text-xs font-black tracking-wide transition-colors"
                    style={{ color: active ? acc : "rgba(255,255,255,.45)" }}>
                    {active && (
                      <motion.span layoutId="modePill" className="absolute inset-0 rounded-lg border"
                        style={{ borderColor: `${acc}55`, background: `${acc}18` }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {m.label}
                      {m.key === "tyres" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: F1.red, animation: "live 1.6s infinite" }} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Connection status */}
            <div className="flex items-center gap-2 rounded-xl border px-3.5 py-2"
              style={{ borderColor: connected ? "rgba(0,230,118,.3)" : "rgba(225,6,0,.3)", background: connected ? "rgba(0,230,118,.06)" : "rgba(225,6,0,.06)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: connected ? F1.green : F1.red, animation: "live 1.6s infinite" }} />
              <span className="f-mono text-[11px] font-bold tracking-wider" style={{ color: connected ? F1.green : "#ff6a52" }}>
                {connected ? "LIVE" : "CONNECTING"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Live session banner ── */}
        {liveStatus && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="flex items-center justify-between mb-6 px-4 py-3 rounded-xl border chamfer-sm flex-wrap gap-3"
            style={{ borderColor: liveStatus.isLive ? "rgba(225,6,0,.25)" : F1.hairline, background: liveStatus.isLive ? "linear-gradient(90deg,rgba(225,6,0,.1),rgba(15,15,18,.6))" : "rgba(255,255,255,.02)" }}>
            <div className="flex items-center gap-3 flex-wrap">
              {liveStatus.isLive && <span className="w-2 h-2 rounded-full" style={{ background: F1.red, animation: "live 1.6s infinite" }} />}
              <span className="f-mono text-[11px] font-bold tracking-wider text-white">
                {liveStatus.isLive
                  ? `${liveStatus.sessionEmoji} ${liveStatus.sessionType?.toUpperCase()} · LIVE`
                  : "SIMULATOR FEED · NO SESSION LIVE"}
              </span>
              {liveStatus.isLive && (
                <span className="f-mono text-[11px] text-zinc-400">
                  {flagForCountry(liveStatus.countryName)} {liveStatus.countryName}
                  {liveStatus.circuitName ? ` · ${liveStatus.circuitName}` : ""}
                </span>
              )}
            </div>
            <button onClick={handleRefresh}
              className="f-mono text-[11px] border border-white/10 hover:border-[#E10600]/50 text-zinc-500 hover:text-[#ff6a52] px-3 py-1.5 rounded-lg transition-all tracking-wider">
              ↻ REFRESH
            </button>
          </motion.div>
        )}

        {!connected ? (
          /* ── Connecting state ── */
          <div className="flex flex-col items-center justify-center py-32 gap-5">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: "rgba(225,6,0,.18)" }} />
              <div className="absolute inset-0 border-2 border-transparent rounded-full" style={{ borderTopColor: F1.red, animation: "spin-slow .9s linear infinite" }} />
              <div className="absolute inset-[7px] border border-transparent rounded-full" style={{ borderBottomColor: "rgba(225,6,0,.5)", animation: "spin-slow .7s linear infinite reverse" }} />
              <div className="absolute inset-0 flex items-center justify-center f-cond font-black text-[10px]" style={{ color: F1.red }}>F1</div>
            </div>
            <p className="f-mono text-[11px] tracking-[0.3em] glow-pulse" style={{ color: "#ff6a52" }}>ESTABLISHING TELEMETRY LINK…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {mode === "tyres" ? (
              /* ════════════════════ TYRES MODE ════════════════════ */
              <motion.div key="tyres" {...PANEL}>
                {/* Compound summary strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {(liveStatus?.isLive ? ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE"] : ["SOFT", "MEDIUM", "HARD", "PIT"]).map((compound, i) => {
                    const isPit = compound === "PIT";
                    const spec = tyreSpec(compound);
                    const count = liveStatus?.isLive
                      ? liveTyreData.filter(d => (d.tyreCompound || "").toUpperCase() === compound).length
                      : isPit
                        ? drivers.filter(d => (maxLapsFor(d.tyreType) - d.lap) <= 5).length
                        : drivers.filter(d => (d.tyreType || "").toUpperCase() === compound).length;
                    const col = isPit ? F1.red : spec.color;
                    return (
                      <motion.div key={compound} variants={STAGGER} custom={i} initial="hidden" animate="show"
                        className="relative rounded-2xl border chamfer-sm overflow-hidden px-4 py-3.5"
                        style={{ borderColor: F1.hairline, background: F1.card }}>
                        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: col }} />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="f-cond font-black text-4xl tabular-nums leading-none" style={{ color: col }}>{count}</p>
                            <p className="f-mono text-[10px] text-zinc-500 mt-1.5 tracking-widest">{isPit ? "PIT WINDOW" : spec.label}</p>
                          </div>
                          {isPit
                            ? <span className="text-xl">⚠</span>
                            : <TyreChip type={compound} size="lg" />}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Per-driver tyre cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {(liveStatus?.isLive ? liveTyreData.map(d => ({
                    name: d.driverName, number: d.driverNumber, team: d.teamName, color: d.teamColor,
                    tyreType: d.tyreCompound, lap: d.tyreAge, pos: d.position, stint: d.stintNumber as number | null,
                  })) : [...drivers].sort((a, b) => a.position - b.position).map(d => ({
                    name: d.driverName, number: d.carNumber, team: d.teamName, color: d.teamColor,
                    tyreType: d.tyreType, lap: d.lap, pos: d.position, stint: null as number | null,
                  }))).map((d, idx) => {
                    const col = getTeamColor(d.team, d.color);
                    const spec = tyreSpec(d.tyreType);
                    const maxLaps = maxLapsFor(d.tyreType);
                    const life = Math.max(0, 100 - (d.lap / maxLaps) * 100);
                    const lifeColor = life < 20 ? F1.red : life < 50 ? F1.gold : spec.color;
                    const pitIn = Math.max(0, maxLaps - d.lap);
                    return (
                      <motion.div key={d.number} variants={STAGGER} custom={idx} initial="hidden" animate="show"
                        whileHover={{ y: -4 }}
                        className="group relative rounded-2xl border chamfer overflow-hidden transition-colors"
                        style={{ borderColor: F1.hairline, background: F1.card }}>
                        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />
                        <div className="absolute -bottom-4 -right-2 f-cond font-black select-none pointer-events-none"
                          style={{ fontSize: "6rem", lineHeight: .8, color: col, opacity: 0.07 }}>{d.number}</div>
                        <div className="relative z-10 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="f-cond font-black text-2xl text-zinc-600 leading-none">P{d.pos}</span>
                              <div>
                                <p className="f-cond font-black text-base text-white uppercase tracking-tight leading-none">{d.name.split(" ").pop()}</p>
                                <p className="f-mono text-[11px] mt-1" style={{ color: col }}>#{d.number}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: `${spec.color}18` }}>
                              <TyreChip type={d.tyreType} />
                              <span className="f-cond font-black text-xs" style={{ color: spec.color }}>{spec.label}</span>
                            </div>
                          </div>
                          {/* Tyre life bar */}
                          <div className="mb-3">
                            <div className="flex justify-between mb-1">
                              <span className="f-mono text-[9px] tracking-widest text-zinc-600">TYRE LIFE</span>
                              <span className="f-cond font-black text-sm tabular-nums" style={{ color: lifeColor }}>{life.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
                              <motion.div className="h-full rounded-full" initial={false} animate={{ width: `${life}%` }}
                                transition={{ type: "spring", stiffness: 120, damping: 22 }}
                                style={{ background: `linear-gradient(90deg,${lifeColor}99,${lifeColor})`, boxShadow: `0 0 8px ${lifeColor}70` }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "AGE", value: `${d.lap}L`, color: "#fff" },
                              { label: d.stint != null ? "STINT" : "LIFE", value: d.stint != null ? `#${d.stint}` : `${life.toFixed(0)}%`, color: lifeColor },
                              { label: "PIT IN", value: `${pitIn}`, color: pitIn <= 5 ? F1.red : pitIn <= 10 ? F1.gold : "#fff" },
                            ].map(stat => (
                              <div key={stat.label} className="rounded-xl py-2 text-center" style={{ background: "rgba(255,255,255,.03)" }}>
                                <p className="f-cond font-black text-base tabular-nums leading-none" style={{ color: stat.color }}>{stat.value}</p>
                                <p className="f-mono text-[9px] text-zinc-600 mt-1 tracking-widest">{stat.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

            ) : (
              /* ════════════════════ SINGLE / COMPARE MODE ════════════════════ */
              <motion.div key="detail" {...PANEL} className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Driver list (race order) ── */}
                <div className="lg:col-span-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-block w-5 h-[2px]" style={{ background: modeAccent }} />
                    <p className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">RACE ORDER</p>
                  </div>
                  {/* horizontal scroll on mobile, vertical stack on lg */}
                  <div className="flex lg:block gap-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:space-y-2 -mx-1 px-1">
                    {drivers.map((d, idx) => {
                      const col = getTeamColor(d.teamName, d.teamColor);
                      const isSelected = d.driverName === (selected || drivers[0]?.driverName);
                      const isCompare = d.driverName === compareWith;
                      return (
                        <motion.div key={d.driverName} variants={STAGGER} custom={idx} initial="hidden" animate="show"
                          onClick={() => mode === "single" ? setSelected(d.driverName) : (!isSelected && setCompareWith(d.driverName))}
                          whileHover={{ y: -2 }}
                          className="relative shrink-0 w-[230px] lg:w-auto rounded-xl p-3.5 cursor-pointer transition-colors overflow-hidden chamfer-sm"
                          style={{
                            border: `1px solid ${isSelected ? col : isCompare ? `${col}77` : F1.hairline}`,
                            background: isSelected ? `linear-gradient(135deg,${col}14,${F1.card})` : F1.card,
                            boxShadow: isSelected ? `0 0 22px ${col}22` : undefined,
                          }}>
                          {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />}
                          {isCompare && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `repeating-linear-gradient(0deg,${col} 0 4px,transparent 4px 8px)` }} />}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <span className="f-cond font-black text-xl text-zinc-600 w-6 leading-none">{d.position}</span>
                              <div>
                                <p className="f-cond font-black text-sm text-white uppercase tracking-tight leading-none">{d.driverName.split(" ").pop()}</p>
                                <p className="f-mono text-[11px] mt-1" style={{ color: col }}>#{d.carNumber}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="f-cond font-black text-xl text-white tabular-nums leading-none">{d.speed.toFixed(0)}</p>
                              <p className="f-mono text-[9px] text-zinc-600">km/h</p>
                            </div>
                          </div>
                          <SpeedChart data={speedHistory[d.driverName] || [d.speed]} color={col} />
                          <div className="flex justify-between mt-1.5 f-mono text-[10px] text-zinc-500">
                            <span>G{d.gear}</span>
                            <span>{(d.rpm / 1000).toFixed(1)}k</span>
                            <span style={d.drsActive ? { color: F1.green, fontWeight: 700 } : undefined}>DRS{d.drsActive ? "✓" : ""}</span>
                            <span>+{d.gap.toFixed(3)}s</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Detail panel ── */}
                <div className="lg:col-span-2 space-y-4">

                  {/* SINGLE */}
                  {mode === "single" && selectedDriver && (() => {
                    const col = getTeamColor(selectedDriver.teamName, selectedDriver.teamColor);
                    const t = tyreSpec(selectedDriver.tyreType);
                    return (
                      <motion.div key={selectedDriver.driverName} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="relative rounded-2xl border chamfer overflow-hidden" style={{ borderColor: F1.hairline, background: F1.card }}>
                        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: col, boxShadow: `0 0 14px ${col}` }} />
                        <div className="absolute -top-6 -right-3 f-cond font-black select-none pointer-events-none" style={{ fontSize: "11rem", lineHeight: .8, color: col, opacity: 0.06 }}>{selectedDriver.carNumber}</div>
                        <div className="relative z-10 p-5 sm:p-6">
                          {/* Hero */}
                          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                            <div>
                              <p className="f-mono text-[11px] mb-1.5 font-bold tracking-widest" style={{ color: col }}>
                                {selectedDriver.teamName} · #{selectedDriver.carNumber}
                              </p>
                              <h2 className="f-cond font-black text-4xl text-white uppercase tracking-tight leading-none">{selectedDriver.driverName}</h2>
                              <div className="flex items-center gap-2.5 mt-2.5">
                                <span className="f-mono text-[11px] text-zinc-500">P{selectedDriver.position}</span>
                                <span className="text-zinc-700">·</span>
                                <span className="f-mono text-[11px] text-zinc-500">LAP {selectedDriver.lap}</span>
                                <span className="text-zinc-700">·</span>
                                <span className="flex items-center gap-1.5"><TyreChip type={selectedDriver.tyreType} /><span className="f-mono text-[11px]" style={{ color: t.color }}>{t.label}</span></span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-baseline gap-2 justify-end">
                                <span className="f-cond font-black text-white tabular-nums leading-none" style={{ fontSize: "clamp(56px,9vw,84px)", textShadow: `0 0 40px ${col}55` }}>{selectedDriver.speed.toFixed(0)}</span>
                                <span className="f-mono text-xs text-zinc-500 mb-1">km/h</span>
                              </div>
                              {/* DRS pill */}
                              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border f-mono text-[11px] font-bold tracking-wider transition-colors"
                                style={selectedDriver.drsActive
                                  ? { borderColor: "rgba(0,230,118,.4)", background: "rgba(0,230,118,.12)", color: F1.green }
                                  : { borderColor: F1.hairline, background: "rgba(255,255,255,.03)", color: "#71717a" }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedDriver.drsActive ? F1.green : "#52525b" }} />
                                DRS {selectedDriver.drsActive ? "OPEN" : "CLOSED"}
                              </div>
                            </div>
                          </div>

                          {/* Speed detail chart (recharts) */}
                          <div className="rounded-xl p-3 mb-5 border" style={{ borderColor: F1.hairline, background: "rgba(255,255,255,.02)" }}>
                            <p className="f-mono text-[10px] text-zinc-500 mb-1 tracking-widest">SPEED · LAST {MAX_HISTORY}S</p>
                            <DetailChart data={singleSpeedSeries} colorA={col} labelA="km/h" height={170} domain={[120, 360]} />
                          </div>

                          {/* Stat tiles */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            {[
                              { label: "GEAR", value: `${selectedDriver.gear}`, big: true },
                              { label: "RPM", value: `${(selectedDriver.rpm / 1000).toFixed(1)}k`, big: false },
                              { label: "LAP TIME", value: `${Math.floor(selectedDriver.lapTime / 60)}:${(selectedDriver.lapTime % 60).toFixed(3).padStart(6, "0")}`, big: false },
                              { label: "FUEL", value: `${selectedDriver.fuelLoad.toFixed(1)}`, unit: "kg", big: false },
                            ].map(s => (
                              <div key={s.label} className="rounded-xl border chamfer-sm p-3 text-center" style={{ borderColor: F1.hairline, background: "rgba(255,255,255,.03)" }}>
                                <p className="f-mono text-[9px] text-zinc-600 mb-1 tracking-widest">{s.label}</p>
                                <p className={`f-cond font-black text-white tabular-nums leading-none ${s.big ? "text-3xl" : "text-xl"}`}>{s.value}{s.unit && <span className="text-xs text-zinc-500 ml-0.5">{s.unit}</span>}</p>
                              </div>
                            ))}
                          </div>

                          {/* Gauges */}
                          <div className="grid sm:grid-cols-3 gap-x-5 gap-y-3">
                            <GaugeBar value={selectedDriver.throttle} max={100} color={F1.green} label="THROTTLE" />
                            <GaugeBar value={selectedDriver.brake} max={100} color={F1.red} label="BRAKE" />
                            <GaugeBar value={selectedDriver.tyreTemp} max={140} color={F1.orange} label="TYRE TEMP" unit="°C" optimal={t.optimalTemp} />
                          </div>

                          {/* Gap footer */}
                          <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: F1.hairline }}>
                            <span className="f-mono text-[11px] text-zinc-500 tracking-widest">GAP TO LEADER</span>
                            <span className="f-cond font-black text-2xl tabular-nums" style={{ color: col }}>+{selectedDriver.gap.toFixed(3)}<span className="text-sm text-zinc-500 ml-0.5">s</span></span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {/* COMPARE */}
                  {mode === "compare" && (
                    !compareDriver ? (
                      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl border border-dashed chamfer p-16 text-center" style={{ borderColor: "rgba(255,255,255,.12)", background: "rgba(255,255,255,.015)" }}>
                        <p className="f-cond font-black text-5xl mb-3" style={{ color: "#3671C6" }}>VS</p>
                        <p className="f-cond font-bold text-xl text-zinc-300 mb-1.5">Select a driver to compare</p>
                        <p className="f-mono text-[11px] text-zinc-600 tracking-wider">Click any driver in the race order list</p>
                      </motion.div>
                    ) : (() => {
                      const colA = getTeamColor(selectedDriver?.teamName, selectedDriver?.teamColor);
                      const colB = getTeamColor(compareDriver.teamName, compareDriver.teamColor);
                      const pair = [selectedDriver, compareDriver];
                      return (
                        <>
                          {/* Driver header cards */}
                          <div className="grid grid-cols-2 gap-4">
                            {pair.map((d, i) => d && (
                              <motion.div key={d.driverName} initial={{ opacity: 0, x: i === 0 ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
                                className="relative rounded-2xl border chamfer-sm overflow-hidden" style={{ borderColor: F1.hairline, background: F1.card }}>
                                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: getTeamColor(d.teamName, d.teamColor), boxShadow: `0 0 10px ${getTeamColor(d.teamName, d.teamColor)}` }} />
                                <div className="p-4">
                                  <p className="f-mono text-[10px] mb-1 tracking-widest" style={{ color: getTeamColor(d.teamName, d.teamColor) }}>{d.teamName}</p>
                                  <h3 className="f-cond font-black text-xl text-white uppercase tracking-tight mb-3 leading-none">{d.driverName}</h3>
                                  <div className="grid grid-cols-4 gap-2">
                                    {[
                                      { label: "km/h", value: d.speed.toFixed(0), color: "#fff" },
                                      { label: "GEAR", value: `G${d.gear}`, color: "#fff" },
                                      { label: "DRS", value: d.drsActive ? "ON" : "OFF", color: d.drsActive ? F1.green : "#52525b" },
                                      { label: "POS", value: `P${d.position}`, color: "#fff" },
                                    ].map(s => (
                                      <div key={s.label} className="text-center">
                                        <p className="f-cond font-black text-lg tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
                                        <p className="f-mono text-[9px] text-zinc-600 mt-1 tracking-wider">{s.label}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          {/* Overlay charts */}
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
                            className="rounded-2xl border chamfer p-4 sm:p-5" style={{ borderColor: F1.hairline, background: F1.card }}>
                            <div className="flex items-center gap-4 mb-4 flex-wrap">
                              <p className="f-mono text-[11px] text-zinc-500 tracking-[0.3em]">OVERLAY</p>
                              {pair.map(d => d && (
                                <span key={d.driverName} className="flex items-center gap-1.5 f-cond text-xs font-bold" style={{ color: getTeamColor(d.teamName, d.teamColor) }}>
                                  <span className="w-5 h-[2px] inline-block rounded" style={{ background: getTeamColor(d.teamName, d.teamColor) }} />
                                  {d.driverName.split(" ").pop()}
                                </span>
                              ))}
                            </div>
                            <div className="space-y-4">
                              {[
                                { label: "SPEED (km/h)", data: cmpSpeed, domain: [120, 360] as [number, number] },
                                { label: "THROTTLE (%)", data: cmpThrottle, domain: [0, 100] as [number, number] },
                                { label: "RPM", data: cmpRpm, domain: undefined },
                              ].map(c => (
                                <div key={c.label}>
                                  <p className="f-mono text-[9px] text-zinc-600 mb-1 tracking-widest">{c.label}</p>
                                  <DetailChart data={c.data} colorA={colA} colorB={colB} labelA={selectedDriver?.driverName.split(" ").pop() || ""} labelB={compareDriver.driverName.split(" ").pop()} height={120} domain={c.domain} />
                                </div>
                              ))}
                            </div>
                          </motion.div>

                          {/* Head to head */}
                          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="rounded-2xl border chamfer p-4 sm:p-5" style={{ borderColor: F1.hairline, background: F1.card }}>
                            <p className="f-mono text-[11px] text-zinc-500 tracking-[0.3em] mb-4">HEAD TO HEAD</p>
                            {selectedDriver && (<>
                              <CompareRow label="SPEED" v1={selectedDriver.speed} v2={compareDriver.speed} color1={colA} color2={colB} unit="" />
                              <CompareRow label="THROTTLE" v1={selectedDriver.throttle} v2={compareDriver.throttle} color1={colA} color2={colB} unit="" />
                              <CompareRow label="BRAKE" v1={selectedDriver.brake} v2={compareDriver.brake} color1={colA} color2={colB} unit="" />
                              <CompareRow label="RPM" v1={selectedDriver.rpm} v2={compareDriver.rpm} color1={colA} color2={colB} unit="" />
                              <CompareRow label="TYRE °C" v1={selectedDriver.tyreTemp} v2={compareDriver.tyreTemp} color1={colA} color2={colB} unit="" />
                              <CompareRow label="FUEL kg" v1={selectedDriver.fuelLoad} v2={compareDriver.fuelLoad} color1={colA} color2={colB} unit="" />
                            </>)}
                            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4" style={{ borderColor: F1.hairline }}>
                              {pair.map(d => d && (
                                <div key={d.driverName} className="text-center">
                                  <p className="f-mono text-[9px] text-zinc-600 mb-1 tracking-widest">GAP TO LEADER</p>
                                  <p className="f-cond font-black text-2xl tabular-nums" style={{ color: getTeamColor(d.teamName, d.teamColor) }}>+{d.gap.toFixed(3)}s</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      );
                    })()
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
