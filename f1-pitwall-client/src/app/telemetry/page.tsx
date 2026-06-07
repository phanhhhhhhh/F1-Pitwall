"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
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

const TYRE_CONFIG: Record<string, { maxLaps: number; color: string; optimalTemp: [number, number] }> = {
  SOFT: { maxLaps: 20, color: "#ef4444", optimalTemp: [80, 110] },
  MEDIUM: { maxLaps: 30, color: "#eab308", optimalTemp: [90, 120] },
  HARD: { maxLaps: 40, color: "#e2e8f0", optimalTemp: [100, 130] },
  INTERMEDIATE: { maxLaps: 25, color: "#22c55e", optimalTemp: [50, 80] },
  WET: { maxLaps: 30, color: "#3b82f6", optimalTemp: [30, 60] },
  UNKNOWN: { maxLaps: 30, color: "#666", optimalTemp: [80, 120] },
};

function SpeedChart({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const min = 150, max = 360, w = canvas.width, h = canvas.height, pad = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (h - pad * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, color + "40");
    grad.addColorStop(1, color);
    ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.lineJoin = "round";
    data.forEach((v, i) => {
      const x = (i / (MAX_HISTORY - 1)) * w;
      const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = color + "10"; ctx.fill();
  }, [data, color]);
  return <canvas ref={canvasRef} width={200} height={50} className="w-full" />;
}

function DualChart({ data1, data2, color1, color2, label }: {
  data1: number[]; data2: number[]; color1: string; color2: string; label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const min = 100, max = 380, w = canvas.width, h = canvas.height, pad = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (h - pad * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const drawLine = (data: number[], color: string) => {
      if (data.length < 2) return;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round";
      data.forEach((v, i) => {
        const x = (i / (MAX_HISTORY - 1)) * w;
        const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    drawLine(data1, color1);
    drawLine(data2, color2 + "CC");
  }, [data1, data2, color1, color2]);
  return (
    <div>
      <p className="text-xs text-zinc-600 font-mono mb-1.5">{label}</p>
      <canvas ref={canvasRef} width={500} height={60} className="w-full" />
    </div>
  );
}

function GaugeBar({ value, max, color, label, showPct = true }: {
  value: number; max: number; color: string; label: string; showPct?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-500 font-mono">{label}</span>
        <span className="font-bold font-mono" style={{ color }}>{value.toFixed(0)}{showPct ? "%" : ""}</span>
      </div>
      <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

function CompareRow({ label, v1, v2, color1, color2, unit = "" }: {
  label: string; v1: number; v2: number; color1: string; color2: string; unit?: string;
}) {
  const max = Math.max(v1, v2, 1);
  return (
    <div className="mb-3">
      <p className="text-xs text-zinc-600 font-mono mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono w-14 text-right font-bold" style={{ color: color1 }}>{v1.toFixed(0)}{unit}</span>
        <div className="flex-1 flex gap-1 items-center">
          <div className="flex-1 flex justify-end">
            <div className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${(v1 / max) * 100}%`, backgroundColor: color1, boxShadow: `0 0 4px ${color1}60` }} />
          </div>
          <div className="w-px h-3 bg-zinc-700" />
          <div className="flex-1">
            <div className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${(v2 / max) * 100}%`, backgroundColor: color2, boxShadow: `0 0 4px ${color2}60` }} />
          </div>
        </div>
        <span className="text-xs font-mono w-14 font-bold" style={{ color: color2 }}>{v2.toFixed(0)}{unit}</span>
      </div>
    </div>
  );
}

function TyreLifeBar({ tyre, lap, tyreType }: { tyre: typeof TYRE_CONFIG[string]; lap: number; tyreType: string }) {
  const life = Math.max(0, 100 - (lap / tyre.maxLaps) * 100);
  const color = life < 20 ? "#ef4444" : life < 50 ? "#eab308" : tyre.color;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-600">TYRE LIFE</span>
        <span className="font-bold font-mono" style={{ color }}>{life.toFixed(0)}%</span>
      </div>
      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${life}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

function getFlagEmoji(countryName: string): string {
  const flags: Record<string, string> = {
    "United States": "🇺🇸", "Australia": "🇦🇺", "China": "🇨🇳", "Japan": "🇯🇵",
    "Bahrain": "🇧🇭", "Saudi Arabia": "🇸🇦", "Canada": "🇨🇦", "Monaco": "🇲🇨",
    "Spain": "🇪🇸", "Austria": "🇦🇹", "United Kingdom": "🇬🇧", "Belgium": "🇧🇪",
    "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹", "Azerbaijan": "🇦🇿",
    "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷", "UAE": "🇦🇪", "Qatar": "🇶🇦",
  };
  return flags[countryName] || "🏁";
}

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

  const MODES = [
    { key: "single", label: "SINGLE", activeClass: "border-red-500 text-red-400 bg-red-500/10" },
    { key: "compare", label: "COMPARE", activeClass: "border-blue-500 text-blue-400 bg-blue-500/10" },
    { key: "tyres", label: "TYRES 🔴", activeClass: "border-orange-500 text-orange-400 bg-orange-500/10" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes glowPulse { 0%,100%{opacity:.3} 50%{opacity:.8} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        .slide-up { animation: slideUp .4s ease-out both; }
        .glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 left-0 w-[500px] h-[400px] bg-red-500/4 rounded-full blur-[150px] glow-pulse" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-blue-900/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.012]" style={{
          backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 slide-up">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <p className={`font-mono text-xs tracking-[0.3em] ${connected ? "text-green-500/60" : "text-red-500/60"}`}>
                LIVE · 2026 SEASON
              </p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              LIVE<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">TELEMETRY</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode tabs */}
            <div className="flex gap-1.5 bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-xl p-1">
              {MODES.map(m => (
                <button key={m.key} onClick={() => setMode(m.key as "single" | "compare" | "tyres")}
                  className={`px-4 py-2 rounded-lg text-xs font-black border transition-all duration-200 ${mode === m.key ? m.activeClass : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}>
                  {m.label}
                </button>
              ))}
            </div>
            {/* Connection status */}
            <div className={`flex items-center gap-2 border rounded-xl px-4 py-2 ${connected ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
              }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
              <span className={`text-xs font-mono font-bold ${connected ? "text-green-400" : "text-red-400"}`}>
                {connected ? "LIVE" : "CONNECTING..."}
              </span>
            </div>
          </div>
        </div>

        {/* Live session banner */}
        {liveStatus && (
          <div className={`flex items-center justify-between mb-6 p-4 rounded-xl border slide-up ${liveStatus.isLive ? "bg-red-500/5 border-red-500/20" : "bg-zinc-900/50 border-zinc-800/50"
            }`} style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 flex-wrap">
              {liveStatus.isLive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              <span className="text-xs font-mono font-bold text-white">
                {liveStatus.isLive
                  ? `${liveStatus.sessionEmoji} ${liveStatus.sessionType.toUpperCase()} · LIVE`
                  : "SIMULATOR DATA · No session live"}
              </span>
              {liveStatus.isLive && (
                <span className="text-xs text-zinc-400 font-mono">
                  {getFlagEmoji(liveStatus.countryName)} {liveStatus.countryName}
                  {liveStatus.circuitName ? ` · ${liveStatus.circuitName}` : ""}
                </span>
              )}
            </div>
            <button onClick={handleRefresh}
              className="text-xs border border-zinc-700 hover:border-red-500/50 text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-all font-mono">
              ↻ REFRESH
            </button>
          </div>
        )}

        {!connected ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
              <div className="absolute inset-2 border border-red-500/40 rounded-full border-b-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
            </div>
            <p className="text-red-500/70 font-mono text-xs tracking-widest animate-pulse">CONNECTING TO TELEMETRY FEED...</p>
          </div>
        ) : mode === "tyres" ? (

          /* ── TYRES MODE ── */
          <div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(liveStatus?.isLive ? ["SOFT", "MEDIUM", "HARD", "INTER"] : ["SOFT", "MEDIUM", "HARD", "PIT⚠"]).map(compound => {
                const cfg = TYRE_CONFIG[compound];
                const count = liveStatus?.isLive
                  ? liveTyreData.filter(d => d.tyreCompound === compound).length
                  : compound === "PIT⚠"
                    ? drivers.filter(d => { const c = TYRE_CONFIG[d.tyreType] || TYRE_CONFIG.HARD; return (c.maxLaps - d.lap) <= 5; }).length
                    : drivers.filter(d => d.tyreType === compound).length;
                return (
                  <div key={compound} className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-4 text-center slide-up">
                    <p className="text-3xl font-black tabular-nums" style={{ color: cfg?.color || "#ef4444" }}>{count}</p>
                    <p className="text-xs text-zinc-600 font-mono mt-1">{compound}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(liveStatus?.isLive ? liveTyreData.map(d => ({
                name: d.driverName, number: d.driverNumber, team: d.teamName, color: d.teamColor,
                tyreType: d.tyreCompound, lap: d.tyreAge, pos: d.position, stint: d.stintNumber,
              })) : drivers.sort((a, b) => a.position - b.position).map(d => ({
                name: d.driverName, number: d.carNumber, team: d.teamName, color: d.teamColor,
                tyreType: d.tyreType, lap: d.lap, pos: d.position, stint: null,
              }))).map((d, idx) => {
                const cfg = TYRE_CONFIG[d.tyreType] || TYRE_CONFIG.HARD;
                const life = Math.max(0, 100 - (d.lap / cfg.maxLaps) * 100);
                const lifeColor = life < 20 ? "#ef4444" : life < 50 ? "#eab308" : cfg.color;
                const pitIn = Math.max(0, cfg.maxLaps - d.lap);
                return (
                  <div key={d.number} className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-600/50 transition-all duration-200 slide-up"
                    style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className="h-0.5" style={{ backgroundColor: d.color }} />
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-zinc-600">P{d.pos}</span>
                          <div>
                            <p className="text-xs font-black text-white">{d.name.split(" ").pop()}</p>
                            <p className="text-xs font-mono" style={{ color: d.color }}>#{d.number}</p>
                          </div>
                        </div>
                        <span className="text-xs font-black px-2 py-0.5 rounded-lg" style={{ color: cfg.color, backgroundColor: `${cfg.color}20` }}>
                          {d.tyreType}
                        </span>
                      </div>
                      <div className="mb-3">
                        <TyreLifeBar tyre={cfg} lap={d.lap} tyreType={d.tyreType} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "AGE", value: `${d.lap}L` },
                          { label: d.stint ? "STINT" : "LIFE", value: d.stint ? `#${d.stint}` : `${life.toFixed(0)}%`, color: lifeColor },
                          { label: "PIT IN", value: pitIn, color: pitIn <= 5 ? "#ef4444" : pitIn <= 10 ? "#eab308" : "white" },
                        ].map(stat => (
                          <div key={stat.label} className="bg-zinc-800/40 rounded-xl p-2 text-center">
                            <p className="text-sm font-black" style={{ color: stat.color || "white" }}>{stat.value}</p>
                            <p className="text-xs text-zinc-600 font-mono">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        ) : (
          /* ── SINGLE / COMPARE MODE ── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Driver list */}
            <div className="lg:col-span-1 space-y-2">
              <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">RACE ORDER</p>
              {drivers.map((d, idx) => {
                const isSelected = d.driverName === (selected || drivers[0]?.driverName);
                const isCompare = d.driverName === compareWith;
                return (
                  <div key={d.driverName}
                    onClick={() => mode === "single" ? setSelected(d.driverName) : (!isSelected && setCompareWith(d.driverName))}
                    className={`relative bg-zinc-900/80 backdrop-blur rounded-xl p-3.5 cursor-pointer transition-all duration-200 border slide-up ${isSelected ? "border-2" : isCompare ? "border-2 border-dashed" : "border-zinc-800/50 hover:border-zinc-600/50"
                      }`}
                    style={{
                      animationDelay: `${idx * 20}ms`,
                      borderColor: isSelected ? d.teamColor : isCompare ? `${d.teamColor}88` : undefined,
                      boxShadow: isSelected ? `0 0 15px ${d.teamColor}15` : undefined,
                    }}>
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl" style={{ backgroundColor: d.teamColor }} />}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-black text-zinc-600 w-5">{d.position}</span>
                        <div>
                          <p className="text-xs font-black text-white">{d.driverName.split(" ").pop()}</p>
                          <p className="text-xs font-mono" style={{ color: d.teamColor }}>#{d.carNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white tabular-nums">{d.speed.toFixed(0)}</p>
                        <p className="text-xs text-zinc-600">km/h</p>
                      </div>
                    </div>
                    <SpeedChart data={speedHistory[d.driverName] || [d.speed]} color={d.teamColor} />
                    <div className="flex justify-between mt-1.5 text-xs text-zinc-600 font-mono">
                      <span>G{d.gear}</span>
                      <span>{(d.rpm / 1000).toFixed(1)}k RPM</span>
                      <span className={d.drsActive ? "text-green-400 font-bold" : ""}>DRS{d.drsActive ? "✓" : ""}</span>
                      <span>+{d.gap.toFixed(3)}s</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2 space-y-4">

              {/* SINGLE MODE */}
              {mode === "single" && selectedDriver && (
                <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up">
                  <div className="h-0.5" style={{ backgroundColor: selectedDriver.teamColor, boxShadow: `0 0 10px ${selectedDriver.teamColor}` }} />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                      <div>
                        <p className="text-xs font-mono mb-1.5 font-bold" style={{ color: selectedDriver.teamColor }}>
                          {selectedDriver.teamName} · #{selectedDriver.carNumber}
                        </p>
                        <h2 className="text-3xl font-black text-white">{selectedDriver.driverName}</h2>
                        <p className="text-zinc-500 text-sm mt-1.5 font-mono">
                          P{selectedDriver.position} · Lap {selectedDriver.lap} · {selectedDriver.tyreType}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-6xl font-black text-white tabular-nums leading-none"
                          style={{ textShadow: `0 0 30px ${selectedDriver.teamColor}30` }}>
                          {selectedDriver.speed.toFixed(0)}
                        </p>
                        <p className="text-xs text-zinc-500 font-mono mt-1">km/h</p>
                      </div>
                    </div>

                    {/* Speed chart */}
                    <div className="bg-zinc-800/30 rounded-xl p-4 mb-5 border border-zinc-700/20">
                      <p className="text-xs text-zinc-500 font-mono mb-2">SPEED · LAST {MAX_HISTORY}s</p>
                      <canvas ref={el => {
                        if (!el) return;
                        const ctx = el.getContext("2d"); if (!ctx) return;
                        const data = speedHistory[selectedDriver.driverName] || []; if (data.length < 2) return;
                        ctx.clearRect(0, 0, el.width, el.height);
                        const min = 150, max = 360, w = el.width, h = el.height, pad = 8;
                        ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
                        [0, 1, 2, 3, 4].forEach(i => {
                          const y = pad + (h - pad * 2) * (i / 4);
                          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                          ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "9px monospace";
                          ctx.fillText(`${Math.round(max - (max - min) * (i / 4))}`, 4, y - 2);
                        });
                        const grad = ctx.createLinearGradient(0, 0, w, 0);
                        grad.addColorStop(0, selectedDriver.teamColor + "40");
                        grad.addColorStop(1, selectedDriver.teamColor);
                        ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
                        data.forEach((v, i) => {
                          const x = (i / (MAX_HISTORY - 1)) * w, y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
                          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                        });
                        ctx.stroke(); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
                        ctx.fillStyle = selectedDriver.teamColor + "15"; ctx.fill();
                      }} width={600} height={80} className="w-full" />
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-3 mb-5">
                      {[
                        { label: "GEAR", value: `G${selectedDriver.gear}`, big: true },
                        { label: "RPM", value: `${(selectedDriver.rpm / 1000).toFixed(1)}k`, big: false },
                        { label: "LAP TIME", value: `${Math.floor(selectedDriver.lapTime / 60)}:${(selectedDriver.lapTime % 60).toFixed(3).padStart(6, "0")}`, big: false },
                        { label: "FUEL", value: `${selectedDriver.fuelLoad.toFixed(1)}kg`, big: false },
                      ].map(s => (
                        <div key={s.label} className="bg-zinc-800/40 border border-zinc-700/20 rounded-xl p-3 text-center">
                          <p className="text-xs text-zinc-500 font-mono mb-1">{s.label}</p>
                          <p className={`font-black text-white ${s.big ? "text-3xl" : "text-base"}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Gauges */}
                    <div className="space-y-3 mb-4">
                      <GaugeBar value={selectedDriver.throttle} max={100} color="#22c55e" label="THROTTLE" />
                      <GaugeBar value={selectedDriver.brake} max={100} color="#ef4444" label="BRAKE" />
                      <GaugeBar value={selectedDriver.tyreTemp} max={120} color="#f97316" label={`TYRE TEMP (${selectedDriver.tyreType})`} showPct={false} />
                    </div>

                    {/* DRS + Gap */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`px-4 py-2 rounded-xl border font-mono text-sm font-black transition-all ${selectedDriver.drsActive
                        ? "bg-green-500/15 border-green-500/40 text-green-400"
                        : "bg-zinc-800/50 border-zinc-700/50 text-zinc-600"
                        }`}>
                        DRS {selectedDriver.drsActive ? "ACTIVE ✓" : "INACTIVE"}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">
                        Gap to leader: <span className="text-white font-bold">+{selectedDriver.gap.toFixed(3)}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPARE MODE */}
              {mode === "compare" && (
                <>
                  {!compareDriver ? (
                    <div className="bg-zinc-900/60 border border-dashed border-zinc-700/50 rounded-2xl p-16 text-center slide-up">
                      <p className="text-4xl mb-4">🏎️</p>
                      <p className="text-zinc-400 font-bold text-lg mb-2">Select a driver to compare</p>
                      <p className="text-zinc-600 text-sm font-mono">Click any driver in the list on the left</p>
                    </div>
                  ) : (
                    <>
                      {/* Driver header cards */}
                      <div className="grid grid-cols-2 gap-4">
                        {[selectedDriver, compareDriver].map(d => d && (
                          <div key={d.driverName} className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up">
                            <div className="h-0.5" style={{ backgroundColor: d.teamColor, boxShadow: `0 0 8px ${d.teamColor}` }} />
                            <div className="p-4">
                              <p className="text-xs font-mono mb-1" style={{ color: d.teamColor }}>{d.teamName}</p>
                              <h3 className="text-xl font-black text-white mb-3">{d.driverName}</h3>
                              <div className="grid grid-cols-4 gap-2">
                                {[
                                  { label: "km/h", value: d.speed.toFixed(0) },
                                  { label: "GEAR", value: `G${d.gear}` },
                                  { label: "DRS", value: d.drsActive ? "ON" : "OFF", color: d.drsActive ? "#22c55e" : "#666" },
                                  { label: "POS", value: `P${d.position}` },
                                ].map(s => (
                                  <div key={s.label} className="text-center">
                                    <p className="text-lg font-black" style={{ color: s.color || "white" }}>{s.value}</p>
                                    <p className="text-xs text-zinc-600 font-mono">{s.label}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Overlay charts */}
                      <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-5 slide-up" style={{ animationDelay: "100ms" }}>
                        <div className="flex items-center gap-4 mb-5">
                          <p className="text-xs font-mono text-zinc-500 tracking-widest">OVERLAY CHARTS</p>
                          {[selectedDriver, compareDriver].map(d => d && (
                            <span key={d.driverName} className="flex items-center gap-1.5 text-xs font-bold" style={{ color: d.teamColor }}>
                              <span className="w-5 h-0.5 inline-block rounded" style={{ backgroundColor: d.teamColor }} />
                              {d.driverName.split(" ").pop()}
                            </span>
                          ))}
                        </div>
                        <div className="space-y-5">
                          <DualChart data1={speedHistory[selectedDriver?.driverName || ""] || []} data2={speedHistory[compareDriver.driverName] || []} color1={selectedDriver?.teamColor || "#fff"} color2={compareDriver.teamColor} label="SPEED (km/h)" />
                          <DualChart data1={throttleHistory[selectedDriver?.driverName || ""] || []} data2={throttleHistory[compareDriver.driverName] || []} color1={selectedDriver?.teamColor || "#fff"} color2={compareDriver.teamColor} label="THROTTLE (%)" />
                          <DualChart data1={rpmHistory[selectedDriver?.driverName || ""] || []} data2={rpmHistory[compareDriver.driverName] || []} color1={selectedDriver?.teamColor || "#fff"} color2={compareDriver.teamColor} label="RPM" />
                        </div>
                      </div>

                      {/* Head to head */}
                      <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-5 slide-up" style={{ animationDelay: "150ms" }}>
                        <p className="text-xs font-mono text-zinc-500 tracking-widest mb-4">HEAD TO HEAD</p>
                        {selectedDriver && (<>
                          <CompareRow label="SPEED" v1={selectedDriver.speed} v2={compareDriver.speed} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit=" km/h" />
                          <CompareRow label="THROTTLE" v1={selectedDriver.throttle} v2={compareDriver.throttle} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="%" />
                          <CompareRow label="BRAKE" v1={selectedDriver.brake} v2={compareDriver.brake} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="%" />
                          <CompareRow label="RPM (×100)" v1={selectedDriver.rpm / 100} v2={compareDriver.rpm / 100} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="00" />
                          <CompareRow label="TYRE TEMP" v1={selectedDriver.tyreTemp} v2={compareDriver.tyreTemp} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="°C" />
                          <CompareRow label="FUEL" v1={selectedDriver.fuelLoad} v2={compareDriver.fuelLoad} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="kg" />
                        </>)}
                        <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-2 gap-4">
                          {[selectedDriver, compareDriver].map(d => d && (
                            <div key={d.driverName} className="text-center">
                              <p className="text-xs text-zinc-600 font-mono mb-1">GAP TO LEADER</p>
                              <p className="text-2xl font-black" style={{ color: d.teamColor }}>+{d.gap.toFixed(3)}s</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}