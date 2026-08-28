"use client";

import { useEffect, useRef, useState } from "react";
import { getTeamColor } from "../lib/f1-theme";
import type { TelemetryData } from "../types/f1";

interface TrackDefinition {
  id: string;
  name: string;
  country: string;
  lengthKm: number;
  turns: number;
  drsZones: number;
  svgPath: string;
  viewBox: string;
}

const TRACKS: Record<string, TrackDefinition> = {
  monza: {
    id: "monza",
    name: "Autodromo Nazionale Monza",
    country: "Italy",
    lengthKm: 5.793,
    turns: 11,
    drsZones: 2,
    viewBox: "0 0 800 500",
    svgPath: "M 120,400 L 680,400 C 740,400 760,360 740,320 L 640,160 C 620,130 580,130 550,160 L 510,200 C 490,220 460,220 440,190 L 380,100 C 350,60 300,70 280,110 L 220,230 C 200,270 170,290 130,290 L 80,290 C 40,290 30,340 60,370 Z",
  },
  spa: {
    id: "spa",
    name: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    lengthKm: 7.004,
    turns: 19,
    drsZones: 2,
    viewBox: "0 0 800 500",
    svgPath: "M 150,380 C 120,380 110,340 140,310 L 220,230 C 240,210 270,210 290,230 L 330,280 C 350,300 390,300 420,270 L 600,100 C 640,60 700,80 720,130 L 740,220 C 760,300 700,380 620,390 L 400,420 C 340,430 280,400 240,410 Z",
  },
  silverstone: {
    id: "silverstone",
    name: "Silverstone Circuit",
    country: "United Kingdom",
    lengthKm: 5.891,
    turns: 18,
    drsZones: 2,
    viewBox: "0 0 800 500",
    svgPath: "M 180,400 L 580,420 C 650,420 700,370 680,300 L 630,160 C 610,100 540,80 480,110 L 390,160 C 350,180 300,160 280,120 L 250,70 C 210,30 150,50 140,110 L 110,260 C 90,340 120,390 180,400 Z",
  },
  albert_park: {
    id: "albert_park",
    name: "Albert Park Circuit",
    country: "Australia",
    lengthKm: 5.278,
    turns: 14,
    drsZones: 4,
    viewBox: "0 0 800 500",
    svgPath: "M 200,420 L 580,420 C 640,420 680,380 670,320 L 650,220 C 640,160 590,120 530,120 L 410,120 C 360,120 320,80 270,90 L 180,120 C 120,150 100,220 120,290 L 140,360 C 150,400 170,420 200,420 Z",
  },
  monaco: {
    id: "monaco",
    name: "Circuit de Monaco",
    country: "Monaco",
    lengthKm: 3.337,
    turns: 19,
    drsZones: 1,
    viewBox: "0 0 800 500",
    svgPath: "M 140,360 L 320,360 C 370,360 410,330 430,290 L 480,190 C 500,150 550,130 600,150 L 680,190 C 730,220 740,290 700,330 L 590,410 C 530,450 450,440 390,410 L 220,410 C 160,410 120,390 140,360 Z",
  },
};

interface LiveTrackMapProps {
  telemetryList?: TelemetryData[];
  selectedDriverId?: string;
  onSelectDriver?: (id: string) => void;
  circuitKey?: string;
}

interface MockDriver {
  driverName: string;
  team: string;
  color: string;
  carNumber: number;
  position: number;
  gap: number;
}

const MOCK_DRIVERS: MockDriver[] = [
  { driverName: "Max Verstappen", carNumber: 1, team: "Red Bull Racing", color: "#3671C6", position: 1, gap: 0 },
  { driverName: "Lando Norris", carNumber: 4, team: "McLaren", color: "#FF8000", position: 2, gap: 1.4 },
  { driverName: "Charles Leclerc", carNumber: 16, team: "Ferrari", color: "#E8002D", position: 3, gap: 3.2 },
  { driverName: "Lewis Hamilton", carNumber: 44, team: "Ferrari", color: "#E8002D", position: 4, gap: 4.8 },
  { driverName: "Oscar Piastri", carNumber: 81, team: "McLaren", color: "#FF8000", position: 5, gap: 6.1 },
  { driverName: "George Russell", carNumber: 63, team: "Mercedes", color: "#27F4D2", position: 6, gap: 8.5 },
];

interface CarMarker {
  x: number;
  y: number;
  driverName: string;
  color: string;
  position: number;
  carNumber: number;
}

export default function LiveTrackMap({
  telemetryList = [],
  selectedDriverId,
  onSelectDriver,
  circuitKey = "monza",
}: LiveTrackMapProps) {
  const [activeTrackKey, setActiveTrackKey] = useState<string>(
    TRACKS[circuitKey] ? circuitKey : "monza"
  );
  const pathRef = useRef<SVGPathElement>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [cars, setCars] = useState<CarMarker[]>([]);

  const track = TRACKS[activeTrackKey] || TRACKS.monza;

  // Normalize live telemetry / mock drivers into a stable shape.
  const drivers: CarMarker[] = (telemetryList.length > 0 ? telemetryList : MOCK_DRIVERS).map(
    (d, index) => {
      const isMock = !("teamName" in d);
      const teamName = isMock ? (d as MockDriver).team : (d as TelemetryData).teamName;
      const color =
        (isMock ? (d as MockDriver).color : (d as TelemetryData).teamColor) ||
        getTeamColor(teamName);
      return {
        x: 0,
        y: 0,
        driverName: d.driverName,
        color,
        position: d.position || index + 1,
        carNumber: d.carNumber || d.position || index + 1,
      };
    }
  );

  // Keep the animation loop reading the latest drivers without restarting it.
  const driversRef = useRef(drivers);
  useEffect(() => {
    driversRef.current = drivers;
  });

  // Measure the racing line whenever the circuit changes.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const p = path.getPointAtLength(0);
    setStartPoint({ x: p.x, y: p.y });
  }, [activeTrackKey]);

  // Animate car positions along the SVG path (geometry read in the RAF callback,
  // never during render).
  useEffect(() => {
    let frameId: number;
    let t = 0;
    const update = () => {
      const path = pathRef.current;
      if (path) {
        const len = path.getTotalLength();
        setCars(
          driversRef.current.map((d, index) => {
            const baseOffset = (index * 0.08 + d.position * 0.015) % 1;
            const progress = (1 + t - baseOffset) % 1;
            const pt = path.getPointAtLength(progress * len);
            return { ...d, x: pt.x, y: pt.y };
          })
        );
      }
      t = (t + 0.002) % 1;
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="relative w-full bg-gradient-to-b from-[#111217] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 shadow-2xl overflow-hidden">
      {/* Track Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse" />
          <div>
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
              {track.name}
            </h3>
            <span className="text-xs text-zinc-400 f-mono">
              {track.country} · {track.lengthKm} KM · {track.turns} TURNS · {track.drsZones} DRS ZONES
            </span>
          </div>
        </div>

        {/* Track Selector Pills */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-zinc-800">
          {Object.keys(TRACKS).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTrackKey(key)}
              className={`px-2.5 py-1 text-[11px] font-bold f-cond uppercase rounded-lg transition-all ${
                activeTrackKey === key
                  ? "bg-red-600 text-white shadow-[0_0_10px_rgba(225,6,0,0.5)]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              {key.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Interactive SVG Circuit Canvas ───────────────────────────────────── */}
      <div className="relative w-full aspect-[16/9] max-h-[380px] bg-black/60 rounded-2xl border border-zinc-800/70 flex items-center justify-center overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {/* Live Radar Scanline */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent scanline" />
        </div>

        <svg viewBox={track.viewBox} className="w-full h-full p-6">
          <defs>
            {/* Glow Filter */}
            <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="sector1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E10600" />
              <stop offset="100%" stopColor="#FF8000" />
            </linearGradient>
          </defs>

          {/* Underlay glow path */}
          <path
            d={track.svgPath}
            fill="none"
            stroke="rgba(225, 6, 0, 0.15)"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Main Asphalt track line */}
          <path
            d={track.svgPath}
            fill="none"
            stroke="#1c1d24"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Center racing guide line */}
          <path
            ref={pathRef}
            d={track.svgPath}
            fill="none"
            stroke="#383a47"
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Start/Finish Line Indicator */}
          {startPoint && (
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r="6"
              fill="#FFD200"
              stroke="#000"
              strokeWidth="2"
            />
          )}

          {/* ── Real-time Car GPS Dots ────────────────────────────────────────── */}
          {cars.map((d) => {
            const isSelected = selectedDriverId === d.driverName;

            return (
              <g
                key={d.driverName}
                className="cursor-pointer transition-transform duration-75"
                onClick={() => onSelectDriver && onSelectDriver(d.driverName)}
              >
                {/* Selected halo */}
                {isSelected && (
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r="16"
                    fill="none"
                    stroke={d.color}
                    strokeWidth="2"
                    className="animate-ping opacity-75"
                  />
                )}

                {/* Outer Team Ring */}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={isSelected ? 10 : 8}
                  fill={d.color}
                  stroke="#000"
                  strokeWidth="2"
                  filter="url(#trackGlow)"
                />

                {/* Car Number Label */}
                <text
                  x={d.x}
                  y={d.y + 3.5}
                  textAnchor="middle"
                  fill="#000"
                  fontSize={isSelected ? "9px" : "8px"}
                  fontWeight="900"
                  fontFamily="sans-serif"
                >
                  {d.carNumber}
                </text>

                {/* Driver Name Tag on selected */}
                {isSelected && (
                  <g transform={`translate(${d.x + 12}, ${d.y - 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="80"
                      height="20"
                      rx="4"
                      fill="rgba(10, 10, 13, 0.9)"
                      stroke={d.color}
                      strokeWidth="1"
                    />
                    <text
                      x="6"
                      y="14"
                      fill="#fff"
                      fontSize="10px"
                      fontWeight="700"
                      fontFamily="sans-serif"
                    >
                      P{d.position} {d.driverName.split(" ").pop()}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 flex items-center gap-3 text-[10px] text-zinc-400 f-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>START/FINISH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>DRS ZONE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span>LIVE GPS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
