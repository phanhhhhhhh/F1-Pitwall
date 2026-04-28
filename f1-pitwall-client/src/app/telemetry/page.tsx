"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

declare global {
  interface Window {
    SockJS: new (url: string) => unknown;
    Stomp?: StompFactory;
    StompJs?: {
      Stomp: StompFactory;
    };
  }
}

interface TelemetryFrame {
  body: string;
}

interface StompSubscription {
  unsubscribe: () => void;
}

interface StompClient {
  debug: ((message: string) => void) | null;
  connect: (
    headers: Record<string, string>,
    onConnect: () => void,
    onError?: (error: unknown) => void,
  ) => void;
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

const MAX_HISTORY = 30;

function SpeedChart({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const min = 150, max = 360;
    const w = canvas.width, h = canvas.height;
    const pad = 4;


    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (h - pad * 2) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }


    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    data.forEach((v, i) => {
      const x = (i / (MAX_HISTORY - 1)) * w;
      const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();


    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color + "15";
    ctx.fill();
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
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function TelemetryPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [drivers, setDrivers] = useState<TelemetryData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [speedHistory, setSpeedHistory] = useState<Record<string, number[]>>({});
  const stompRef = useRef<StompClient | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    const connect = () => {
      const stompFactory = window.Stomp ?? window.StompJs?.Stomp;

      if (!stompFactory) {
        setTimeout(connect, 500);
        return;
      }

      const wsUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/ws";
      const stompClient = stompFactory.over(() => new window.SockJS(wsUrl));
      stompClient.debug = () => { };

      stompClient.connect({}, () => {
        setConnected(true);
        stompClient.subscribe("/topic/telemetry", (message: TelemetryFrame) => {
          const data: TelemetryData[] = JSON.parse(message.body);
          setDrivers(data);
          setSpeedHistory((prev) => {
            const next = { ...prev };
            data.forEach((driver) => {
              const hist = next[driver.driverName] || [];
              next[driver.driverName] = [...hist.slice(-(MAX_HISTORY - 1)), driver.speed];
            });
            return next;
          });
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

        stompScript.onload = () => {
          setTimeout(connect, 100);
        };
      };
    };

    loadScriptsAndConnect();
    return () => {
      stompRef.current?.disconnect();
    };
  }, [router]);

  const selectedDriver = drivers.find(d => d.driverName === selected) || drivers[0];

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
              Live · 2026 Season
            </p>
            <h1 className="text-4xl font-black tracking-tighter text-white">
              LIVE <span className="text-red-500">TELEMETRY</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className={`text-xs font-mono ${connected ? "text-green-400" : "text-red-400"}`}>
              {connected ? "CONNECTED · LIVE DATA" : "CONNECTING..."}
            </span>
          </div>
        </div>

        {!connected ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-zinc-500 font-mono text-sm">Connecting to telemetry feed...</p>
              <p className="text-zinc-700 font-mono text-xs mt-2">Make sure backend is running on port 8080</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            { }
            <div className="lg:col-span-1 space-y-2">
              <p className="text-xs font-mono text-zinc-500 tracking-widest mb-3">RACE ORDER</p>
              {drivers.map((d) => (
                <div
                  key={d.driverName}
                  onClick={() => setSelected(d.driverName)}
                  className={`bg-zinc-900 rounded-xl p-4 cursor-pointer transition-all border ${selected === d.driverName || (!selected && d.position === 1)
                    ? "border-2"
                    : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  style={selected === d.driverName || (!selected && d.position === 1)
                    ? { borderColor: d.teamColor }
                    : {}}
                >
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
                  <SpeedChart
                    data={speedHistory[d.driverName] || [d.speed]}
                    color={d.teamColor}
                  />
                  <div className="flex justify-between mt-2 text-xs text-zinc-600">
                    <span>G{d.gear}</span>
                    <span>{d.rpm.toLocaleString()} RPM</span>
                    <span className={d.drsActive ? "text-green-400" : ""}>{d.drsActive ? "DRS ✓" : "DRS"}</span>
                    <span>+{d.gap.toFixed(3)}s</span>
                  </div>
                </div>
              ))}
            </div>

            { }
            {selectedDriver && (
              <div className="lg:col-span-2 space-y-4">
                { }
                <div
                  className="bg-zinc-900 rounded-xl p-6 border-l-4"
                  style={{ borderColor: selectedDriver.teamColor }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-mono mb-1" style={{ color: selectedDriver.teamColor }}>
                        {selectedDriver.teamName} · #{selectedDriver.carNumber}
                      </p>
                      <h2 className="text-3xl font-black text-white">{selectedDriver.driverName}</h2>
                      <p className="text-zinc-500 text-sm mt-1">
                        P{selectedDriver.position} · Lap {selectedDriver.lap} · {selectedDriver.tyreType} tyres
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black text-white">{selectedDriver.speed.toFixed(0)}</p>
                      <p className="text-xs text-zinc-500">km/h</p>
                    </div>
                  </div>

                  { }
                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-zinc-500 font-mono mb-2">SPEED · LAST {MAX_HISTORY}s</p>
                    <canvas
                      ref={(el) => {
                        if (!el) return;
                        const ctx = el.getContext("2d");
                        if (!ctx) return;
                        const data = speedHistory[selectedDriver.driverName] || [];
                        if (data.length < 2) return;
                        ctx.clearRect(0, 0, el.width, el.height);
                        const min = 150, max = 360, w = el.width, h = el.height, pad = 8;
                        ctx.strokeStyle = "rgba(255,255,255,0.05)";
                        ctx.lineWidth = 1;
                        [0, 1, 2, 3, 4].forEach(i => {
                          const y = pad + (h - pad * 2) * (i / 4);
                          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                          ctx.fillStyle = "rgba(255,255,255,0.2)";
                          ctx.font = "10px monospace";
                          ctx.fillText(`${Math.round(max - (max - min) * (i / 4))}`, 4, y - 2);
                        });
                        ctx.beginPath();
                        ctx.strokeStyle = selectedDriver.teamColor;
                        ctx.lineWidth = 2.5;
                        ctx.lineJoin = "round";
                        data.forEach((v, i) => {
                          const x = (i / (MAX_HISTORY - 1)) * w;
                          const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
                          if (i === 0) {
                            ctx.moveTo(x, y);
                          } else {
                            ctx.lineTo(x, y);
                          }
                        });
                        ctx.stroke();
                        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
                        ctx.fillStyle = selectedDriver.teamColor + "20";
                        ctx.fill();
                      }}
                      width={600}
                      height={100}
                      className="w-full"
                    />
                  </div>

                  { }
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

                  { }
                  <div className="space-y-3">
                    <GaugeBar value={selectedDriver.throttle} max={100} color="#22c55e" label="THROTTLE" />
                    <GaugeBar value={selectedDriver.brake} max={100} color="#ef4444" label="BRAKE" />
                    <GaugeBar value={selectedDriver.tyreTemp} max={120} color="#f97316" label={`TYRE TEMP (${selectedDriver.tyreType})`} />
                  </div>

                  { }
                  <div className="flex items-center gap-3 mt-4">
                    <div className={`px-4 py-2 rounded-lg border font-mono text-sm font-bold transition-all ${selectedDriver.drsActive
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-600"
                      }`}>
                      DRS {selectedDriver.drsActive ? "ACTIVE" : "INACTIVE"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Gap to leader: <span className="text-white font-mono">+{selectedDriver.gap.toFixed(3)}s</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
