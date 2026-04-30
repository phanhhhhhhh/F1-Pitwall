"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";
import { authFetch } from "../lib/pitwall-auth";

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
interface StompFactory {
  over: (webSocketFactory: () => unknown) => StompClient;
}

interface TelemetryData {
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number;
  lap: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drsActive: boolean;
  fuelLoad: number;
  tyreType: string;
  tyreTemp: number;
  lapTime: number;
  gap: number;
  position: number;
  timestamp: number;
}

interface LiveTyreData {
  driverNumber: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  tyreCompound: string;
  tyreAge: number;
  lapStart: number;
  stintNumber: number;
  position: number;
  isLive: boolean;
}


const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const MAX_HISTORY = 40;

const TYRE_CONFIG: Record<string, { maxLaps: number; color: string; optimalTemp: [number, number] }> = {
  SOFT: { maxLaps: 20, color: "#ef4444", optimalTemp: [80, 110] },
  MEDIUM: { maxLaps: 30, color: "#eab308", optimalTemp: [90, 120] },
  HARD: { maxLaps: 40, color: "#e2e8f0", optimalTemp: [100, 130] },
  INTERMEDIATE: { maxLaps: 25, color: "#22c55e", optimalTemp: [50, 80] },
  WET: { maxLaps: 30, color: "#3b82f6", optimalTemp: [30, 60] },
};

function DualSpeedChart({ data1, data2, color1, color2, label }: {
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
      <p className="text-xs text-zinc-600 font-mono mb-1">{label}</p>
      <canvas ref={canvasRef} width={500} height={70} className="w-full" />
    </div>
  );
}

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
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round";
    data.forEach((v, i) => {
      const x = (i / (MAX_HISTORY - 1)) * w;
      const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = color + "15"; ctx.fill();
  }, [data, color]);
  return <canvas ref={canvasRef} width={200} height={60} className="w-full" />;
}

function GaugeBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-500 mb-1">
        <span>{label}</span>
        <span style={{ color }}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
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
      <p className="text-xs text-zinc-600 font-mono mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono w-12 text-right" style={{ color: color1 }}>{v1.toFixed(0)}{unit}</span>
        <div className="flex-1 flex gap-1">
          <div className="flex-1 flex justify-end">
            <div className="h-2 rounded-full" style={{ width: `${(v1 / max) * 100}%`, backgroundColor: color1 }} />
          </div>
          <div className="w-px bg-zinc-700" />
          <div className="flex-1">
            <div className="h-2 rounded-full" style={{ width: `${(v2 / max) * 100}%`, backgroundColor: color2 }} />
          </div>
        </div>
        <span className="text-xs font-mono w-12" style={{ color: color2 }}>{v2.toFixed(0)}{unit}</span>
      </div>
    </div>
  );
}

function TyreCard({ driver }: { driver: TelemetryData }) {
  const config = TYRE_CONFIG[driver.tyreType] || TYRE_CONFIG.HARD;
  const tyreLife = Math.max(0, 100 - (driver.lap / config.maxLaps) * 100);
  const isOverheat = driver.tyreTemp > config.optimalTemp[1];
  const isUnderTemp = driver.tyreTemp < config.optimalTemp[0];
  const tempStatus = isOverheat ? "OVERHEATING" : isUnderTemp ? "COLD" : "OPTIMAL";
  const tempColor = isOverheat ? "#ef4444" : isUnderTemp ? "#3b82f6" : "#22c55e";
  const pitIn = Math.max(0, config.maxLaps - driver.lap);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-zinc-600">P{driver.position}</span>
          <div>
            <p className="text-xs font-bold text-white">{driver.driverName.split(" ").pop()}</p>
            <p className="text-xs font-mono" style={{ color: driver.teamColor }}>#{driver.carNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: config.color + "25", color: config.color }}>
            {driver.tyreType}
          </span>
          <span className="text-xs font-mono text-zinc-500">L{driver.lap}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-600">TYRE LIFE</span>
          <span style={{ color: tyreLife < 20 ? "#ef4444" : tyreLife < 50 ? "#eab308" : "#22c55e" }}>
            {tyreLife.toFixed(0)}%
          </span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${tyreLife}%`, backgroundColor: tyreLife < 20 ? "#ef4444" : tyreLife < 50 ? "#eab308" : config.color }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <p className="text-lg font-black" style={{ color: tempColor }}>{driver.tyreTemp.toFixed(0)}°</p>
          <p className="text-xs text-zinc-600">TEMP</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <p className="text-xs font-bold mt-1" style={{ color: tempColor }}>{tempStatus}</p>
          <p className="text-xs text-zinc-600 mt-0.5">STATUS</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <p className="text-lg font-black" style={{ color: pitIn <= 5 ? "#ef4444" : pitIn <= 10 ? "#eab308" : "#fff" }}>
            {pitIn}
          </p>
          <p className="text-xs text-zinc-600">PIT IN</p>
        </div>
      </div>

      <div className="mt-2 text-xs text-zinc-700 font-mono text-center">
        Optimal: {config.optimalTemp[0]}° – {config.optimalTemp[1]}°C
      </div>
    </div>
  );
}

function LiveTyreCard({ data }: { data: LiveTyreData }) {
  const config = TYRE_CONFIG[data.tyreCompound] || TYRE_CONFIG.HARD;
  const tyreLife = Math.max(0, 100 - (data.tyreAge / config.maxLaps) * 100);
  const pitIn = Math.max(0, config.maxLaps - data.tyreAge);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-zinc-600">P{data.position}</span>
          <div>
            <p className="text-xs font-bold text-white">{data.driverName.split(" ").pop()}</p>
            <p className="text-xs font-mono" style={{ color: data.teamColor }}>#{data.driverNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: config.color + "25", color: config.color }}>
            {data.tyreCompound}
          </span>
          <span className="text-xs font-mono text-zinc-500">+{data.tyreAge}L</span>
        </div>
      </div>

      {/* Tyre life */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-600">TYRE LIFE</span>
          <span style={{ color: tyreLife < 20 ? "#ef4444" : tyreLife < 50 ? "#eab308" : "#22c55e" }}>
            {tyreLife.toFixed(0)}%
          </span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${tyreLife}%`, backgroundColor: tyreLife < 20 ? "#ef4444" : tyreLife < 50 ? "#eab308" : config.color }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <p className="text-lg font-black text-white">{data.tyreAge}</p>
          <p className="text-xs text-zinc-600">AGE</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <p className="text-xs font-bold text-white mt-1">STINT {data.stintNumber}</p>
          <p className="text-xs text-zinc-600 mt-0.5">LIVE</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <p className="text-lg font-black" style={{ color: pitIn <= 5 ? "#ef4444" : pitIn <= 10 ? "#eab308" : "#fff" }}>
            {pitIn}
          </p>
          <p className="text-xs text-zinc-600">PIT IN</p>
        </div>
      </div>
    </div>
  );
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
  const stompRef = useRef<StompClient | null>(null);
  const [isRaceLive, setIsRaceLive] = useState(false);
  const [liveTyreData, setLiveTyreData] = useState<LiveTyreData[]>([]);
  const [tyreDataSource, setTyreDataSource] = useState<"live" | "simulator">("simulator");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    const connect = () => {
      const stompFactory = window.Stomp ?? window.StompJs?.Stomp;
      if (!stompFactory) { setTimeout(connect, 500); return; }
      const wsUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/ws";
      const stompClient = stompFactory.over(() => new window.SockJS(wsUrl));
      stompClient.debug = () => { };
      stompClient.connect({}, () => {
        setConnected(true);
        stompClient.subscribe("/topic/telemetry", (message: TelemetryFrame) => {
          const data: TelemetryData[] = JSON.parse(message.body);
          setDrivers(data);
          setSpeedHistory(prev => { const next = { ...prev }; data.forEach(d => { next[d.driverName] = [...(next[d.driverName] || []).slice(-(MAX_HISTORY - 1)), d.speed]; }); return next; });
          setRpmHistory(prev => { const next = { ...prev }; data.forEach(d => { next[d.driverName] = [...(next[d.driverName] || []).slice(-(MAX_HISTORY - 1)), d.rpm]; }); return next; });
          setThrottleHistory(prev => { const next = { ...prev }; data.forEach(d => { next[d.driverName] = [...(next[d.driverName] || []).slice(-(MAX_HISTORY - 1)), d.throttle]; }); return next; });
        });
      }, () => setConnected(false));
      stompRef.current = stompClient;
    };
    const loadScriptsAndConnect = () => {
      const sockScript = document.createElement("script");
      sockScript.src = "https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js";
      document.head.appendChild(sockScript);
      sockScript.onload = () => {
        const stompScript = document.createElement("script");
        stompScript.src = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@6/bundles/stomp.umd.min.js";
        document.head.appendChild(stompScript);
        stompScript.onload = () => setTimeout(connect, 100);
      };
    };
    loadScriptsAndConnect();
    return () => { stompRef.current?.disconnect(); };
  }, [router]);

  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const res = await authFetch(`${API}/api/openf1/status`);
        const status = await res.json();
        setIsRaceLive(status.isLive);

        if (status.isLive) {
          setTyreDataSource("live");
          const tyreRes = await authFetch(`${API}/api/openf1/tyres`);
          const tyreData = await tyreRes.json();
          setLiveTyreData(tyreData);
        } else {
          setTyreDataSource("simulator");
        }
      } catch (e) {
        console.error("Live status check failed:", e);
      }
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const selectedDriver = drivers.find(d => d.driverName === selected) || drivers[0];
  const compareDriver = drivers.find(d => d.driverName === compareWith);
  const softCount = drivers.filter(d => d.tyreType === "SOFT").length;
  const medCount = drivers.filter(d => d.tyreType === "MEDIUM").length;
  const hardCount = drivers.filter(d => d.tyreType === "HARD").length;
  const criticalCount = drivers.filter(d => { const c = TYRE_CONFIG[d.tyreType] || TYRE_CONFIG.HARD; return (c.maxLaps - d.lap) <= 5; }).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">Live · 2026 Season</p>
            <h1 className="text-4xl font-black tracking-tighter text-white">LIVE <span className="text-red-500">TELEMETRY</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {[
                { key: "single", label: "SINGLE", active: "bg-red-500/20 border-red-500 text-red-400" },
                { key: "compare", label: "COMPARE", active: "bg-blue-500/20 border-blue-500 text-blue-400" },
                { key: "tyres", label: "TYRES", active: "bg-orange-500/20 border-orange-500 text-orange-400" },
              ].map(m => (
                <button key={m.key} onClick={() => setMode(m.key as "single" | "compare" | "tyres")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${mode === m.key ? m.active : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className={`text-xs font-mono ${connected ? "text-green-400" : "text-red-400"}`}>{connected ? "LIVE" : "CONNECTING..."}</span>
            </div>
          </div>
        </div>

        {!connected ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-500 font-mono text-sm">Connecting to telemetry feed...</p>
            </div>
          </div>
        ) : mode === "tyres" ? (
          <div>
            {/* Live / Simulator indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {isRaceLive ? (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-400 text-xs font-mono font-bold">LIVE RACE DATA · OpenF1</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2">
                    <div className="w-2 h-2 bg-zinc-500 rounded-full" />
                    <span className="text-zinc-500 text-xs font-mono">SIMULATOR DATA · No race live</span>
                  </div>
                )}
                {isRaceLive && (
                  <span className="text-xs text-zinc-600 font-mono">Miami GP · Race</span>
                )}
              </div>

              {/* Force refresh button */}
              <button
                onClick={async () => {
                  try {
                    await authFetch(`${API}/api/openf1/fetch`, { method: "POST" });
                    const tyreRes = await authFetch(`${API}/api/openf1/tyres`);
                    setLiveTyreData(await tyreRes.json());
                  } catch (e) { console.error(e); }
                }}
                className="text-xs border border-zinc-700 hover:border-red-500 text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-all font-mono"
              >
                ↻ REFRESH
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {isRaceLive ? (
                // Live data stats
                <>
                  {["SOFT", "MEDIUM", "HARD", "INTER"].map(compound => (
                    <div key={compound} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                      <p className="text-2xl font-black" style={{ color: TYRE_CONFIG[compound]?.color || "#fff" }}>
                        {liveTyreData.filter(d => d.tyreCompound === compound).length}
                      </p>
                      <p className="text-xs text-zinc-600 font-mono">{compound}</p>
                    </div>
                  ))}
                </>
              ) : (
                // Simulator stats
                <>
                  {[
                    { count: softCount, label: "SOFT", color: "text-red-400" },
                    { count: medCount, label: "MEDIUM", color: "text-yellow-400" },
                    { count: hardCount, label: "HARD", color: "text-white" },
                    { count: criticalCount, label: "PIT NOW", color: "text-red-500" },
                  ].map(s => (
                    <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                      <p className="text-xs text-zinc-600 font-mono">{s.label}</p>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Tyre cards */}
            {isRaceLive ? (
              // Live tyre cards
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {liveTyreData.map(d => (
                  <LiveTyreCard key={d.driverNumber} data={d} />
                ))}
              </div>
            ) : (
              // Simulator tyre cards
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...drivers].sort((a, b) => a.position - b.position).map(d => (
                  <TyreCard key={d.driverName} driver={d} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono text-zinc-500 tracking-widest">RACE ORDER</p>
                {mode === "compare" && <p className="text-xs text-zinc-600"><span style={{ color: selectedDriver?.teamColor }}>■</span> vs <span style={{ color: compareDriver?.teamColor || "#666" }}>■</span></p>}
              </div>
              {drivers.map((d) => {
                const isSelected = d.driverName === (selected || drivers[0]?.driverName);
                const isCompare = d.driverName === compareWith;
                return (
                  <div key={d.driverName}
                    onClick={() => { if (mode === "single") { setSelected(d.driverName); } else { if (isSelected) return; setCompareWith(d.driverName); } }}
                    className={`bg-zinc-900 rounded-xl p-4 cursor-pointer transition-all border ${isSelected ? "border-2" : isCompare ? "border-2 border-dashed" : "border-zinc-800 hover:border-zinc-600"}`}
                    style={isSelected ? { borderColor: d.teamColor } : isCompare ? { borderColor: d.teamColor + "88" } : {}}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-zinc-600 w-6">{d.position}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{d.driverName.split(" ").pop()}</p>
                          <p className="text-xs font-mono" style={{ color: d.teamColor }}>#{d.carNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white">{d.speed.toFixed(0)}</p>
                        <p className="text-xs text-zinc-600">km/h</p>
                      </div>
                    </div>
                    <SpeedChart data={speedHistory[d.driverName] || [d.speed]} color={d.teamColor} />
                    <div className="flex justify-between mt-2 text-xs text-zinc-600">
                      <span>G{d.gear}</span>
                      <span>{d.rpm.toLocaleString()} RPM</span>
                      <span className={d.drsActive ? "text-green-400" : ""}>{d.drsActive ? "DRS ✓" : "DRS"}</span>
                      <span>+{d.gap.toFixed(3)}s</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {mode === "single" && selectedDriver && (
                <div className="bg-zinc-900 rounded-xl p-6 border-l-4" style={{ borderColor: selectedDriver.teamColor }}>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-mono mb-1" style={{ color: selectedDriver.teamColor }}>{selectedDriver.teamName} · #{selectedDriver.carNumber}</p>
                      <h2 className="text-3xl font-black text-white">{selectedDriver.driverName}</h2>
                      <p className="text-zinc-500 text-sm mt-1">P{selectedDriver.position} · Lap {selectedDriver.lap} · {selectedDriver.tyreType} tyres</p>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black text-white">{selectedDriver.speed.toFixed(0)}</p>
                      <p className="text-xs text-zinc-500">km/h</p>
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-zinc-500 font-mono mb-2">SPEED · LAST {MAX_HISTORY}s</p>
                    <canvas ref={(el) => {
                      if (!el) return; const ctx = el.getContext("2d"); if (!ctx) return;
                      const data = speedHistory[selectedDriver.driverName] || []; if (data.length < 2) return;
                      ctx.clearRect(0, 0, el.width, el.height);
                      const min = 150, max = 360, w = el.width, h = el.height, pad = 8;
                      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
                      [0, 1, 2, 3, 4].forEach(i => { const y = pad + (h - pad * 2) * (i / 4); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "10px monospace"; ctx.fillText(`${Math.round(max - (max - min) * (i / 4))}`, 4, y - 2); });
                      ctx.beginPath(); ctx.strokeStyle = selectedDriver.teamColor; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
                      data.forEach((v, i) => { const x = (i / (MAX_HISTORY - 1)) * w; const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
                      ctx.stroke(); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = selectedDriver.teamColor + "20"; ctx.fill();
                    }} width={600} height={100} className="w-full" />
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { label: "GEAR", value: `G${selectedDriver.gear}`, big: true },
                      { label: "RPM", value: selectedDriver.rpm.toLocaleString(), big: false },
                      { label: "LAP TIME", value: `${Math.floor(selectedDriver.lapTime / 60)}:${(selectedDriver.lapTime % 60).toFixed(3).padStart(6, "0")}`, big: false },
                      { label: "FUEL", value: `${selectedDriver.fuelLoad.toFixed(1)}kg`, big: false },
                    ].map(s => (
                      <div key={s.label} className="bg-zinc-800/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                        <p className={`font-black text-white ${s.big ? "text-3xl" : "text-lg"}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <GaugeBar value={selectedDriver.throttle} max={100} color="#22c55e" label="THROTTLE" />
                    <GaugeBar value={selectedDriver.brake} max={100} color="#ef4444" label="BRAKE" />
                    <GaugeBar value={selectedDriver.tyreTemp} max={120} color="#f97316" label={`TYRE TEMP (${selectedDriver.tyreType})`} />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <div className={`px-4 py-2 rounded-lg border font-mono text-sm font-bold transition-all ${selectedDriver.drsActive ? "bg-green-500/20 border-green-500 text-green-400" : "bg-zinc-800 border-zinc-700 text-zinc-600"}`}>
                      DRS {selectedDriver.drsActive ? "ACTIVE" : "INACTIVE"}
                    </div>
                    <div className="text-xs text-zinc-500">Gap to leader: <span className="text-white font-mono">+{selectedDriver.gap.toFixed(3)}s</span></div>
                  </div>
                </div>
              )}

              {mode === "compare" && (
                <>
                  {!compareDriver ? (
                    <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-12 text-center">
                      <p className="text-zinc-500 font-mono text-sm">Select a second driver to compare</p>
                      <p className="text-zinc-700 text-xs mt-2">Click any driver in the list on the left</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {[selectedDriver, compareDriver].map((d) => d && (
                          <div key={d.driverName} className="bg-zinc-900 rounded-xl p-4 border-t-2" style={{ borderColor: d.teamColor }}>
                            <p className="text-xs font-mono mb-1" style={{ color: d.teamColor }}>{d.teamName}</p>
                            <h3 className="text-xl font-black text-white">{d.driverName}</h3>
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-center"><p className="text-2xl font-black text-white">{d.speed.toFixed(0)}</p><p className="text-xs text-zinc-600">km/h</p></div>
                              <div className="text-center"><p className="text-lg font-black text-white">G{d.gear}</p><p className="text-xs text-zinc-600">GEAR</p></div>
                              <div className="text-center"><p className="text-lg font-black" style={{ color: d.drsActive ? "#22c55e" : "#666" }}>{d.drsActive ? "ON" : "OFF"}</p><p className="text-xs text-zinc-600">DRS</p></div>
                              <div className="text-center"><p className="text-lg font-black text-white">P{d.position}</p><p className="text-xs text-zinc-600">POS</p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                        <div className="flex items-center gap-4 mb-4">
                          <p className="text-xs font-mono text-zinc-400 tracking-widest">OVERLAY CHARTS</p>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs" style={{ color: selectedDriver?.teamColor }}><span className="w-6 h-0.5 inline-block" style={{ backgroundColor: selectedDriver?.teamColor }} />{selectedDriver?.driverName.split(" ").pop()}</span>
                            <span className="flex items-center gap-1 text-xs" style={{ color: compareDriver.teamColor }}><span className="w-6 h-0.5 inline-block" style={{ backgroundColor: compareDriver.teamColor }} />{compareDriver.driverName.split(" ").pop()}</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <DualSpeedChart data1={speedHistory[selectedDriver?.driverName || ""] || []} data2={speedHistory[compareDriver.driverName] || []} color1={selectedDriver?.teamColor || "#fff"} color2={compareDriver.teamColor} label="SPEED (km/h)" />
                          <DualSpeedChart data1={throttleHistory[selectedDriver?.driverName || ""] || []} data2={throttleHistory[compareDriver.driverName] || []} color1={selectedDriver?.teamColor || "#fff"} color2={compareDriver.teamColor} label="THROTTLE (%)" />
                          <DualSpeedChart data1={rpmHistory[selectedDriver?.driverName || ""] || []} data2={rpmHistory[compareDriver.driverName] || []} color1={selectedDriver?.teamColor || "#fff"} color2={compareDriver.teamColor} label="RPM" />
                        </div>
                      </div>
                      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                        <p className="text-xs font-mono text-zinc-400 tracking-widest mb-4">HEAD TO HEAD</p>
                        {selectedDriver && (
                          <>
                            <CompareRow label="SPEED" v1={selectedDriver.speed} v2={compareDriver.speed} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit=" km/h" />
                            <CompareRow label="THROTTLE" v1={selectedDriver.throttle} v2={compareDriver.throttle} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="%" />
                            <CompareRow label="BRAKE" v1={selectedDriver.brake} v2={compareDriver.brake} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="%" />
                            <CompareRow label="RPM" v1={selectedDriver.rpm / 100} v2={compareDriver.rpm / 100} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="00" />
                            <CompareRow label="TYRE TEMP" v1={selectedDriver.tyreTemp} v2={compareDriver.tyreTemp} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="°C" />
                            <CompareRow label="FUEL" v1={selectedDriver.fuelLoad} v2={compareDriver.fuelLoad} color1={selectedDriver.teamColor} color2={compareDriver.teamColor} unit="kg" />
                          </>
                        )}
                        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
                          <div className="text-center"><p className="text-xs text-zinc-600 mb-1">GAP TO LEADER</p><p className="text-xl font-black" style={{ color: selectedDriver?.teamColor }}>+{selectedDriver?.gap.toFixed(3)}s</p></div>
                          <div className="text-center"><p className="text-xs text-zinc-600 mb-1">GAP TO LEADER</p><p className="text-xl font-black" style={{ color: compareDriver.teamColor }}>+{compareDriver.gap.toFixed(3)}s</p></div>
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
