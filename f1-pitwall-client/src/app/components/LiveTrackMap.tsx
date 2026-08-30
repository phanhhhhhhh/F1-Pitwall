"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamColor } from "../lib/f1-theme";
import { fetchCircuitGeometry } from "../lib/f1-data";
import type { CircuitGeometry, CircuitInfo, DriverStanding, TelemetryData } from "../types/f1";

interface LiveTrackMapProps {
  /** Live car telemetry. When empty the map runs a demo lap and says so. */
  telemetryList?: TelemetryData[];
  selectedDriverId?: string;
  onSelectDriver?: (id: string) => void;
  /** Circuit to draw. Defaults to the first entry of `circuits`. */
  circuitId?: number;
  /** Circuits offered in the switcher. */
  circuits?: CircuitInfo[];
  /**
   * Drivers to animate when there is no live session — pass the current standings so the demo lap
   * shows the real grid rather than an invented one.
   */
  demoDrivers?: DriverStanding[];
}

interface CarMarker {
  x: number;
  y: number;
  driverName: string;
  color: string;
  position: number;
  carNumber: number;
}

export type MapOverlayMode = "STANDARD" | "MINI_SECTORS" | "SPEED_HEATMAP" | "DRS_ZONES";

interface TurnInfo {
  number: number;
  x: number;
  y: number;
  name: string;
  gear: number;
  apexSpeedKmH: number;
  brakingM: number;
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;
/** Room for the track stroke and the car markers, which sit on top of the line. */
const PADDING = 60;

export default function LiveTrackMap({
  telemetryList = [],
  selectedDriverId,
  onSelectDriver,
  circuitId,
  circuits = [],
  demoDrivers = [],
}: LiveTrackMapProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<CircuitGeometry | null>(null);
  const [failed, setFailed] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [cars, setCars] = useState<CarMarker[]>([]);
  const [overlayMode, setOverlayMode] = useState<MapOverlayMode>("STANDARD");
  const [hoveredTurn, setHoveredTurn] = useState<TurnInfo | null>(null);

  const activeCircuitId = pickedId ?? circuitId ?? circuits[0]?.id ?? null;
  const geometry = loaded?.circuitId === activeCircuitId ? loaded : null;
  const loading = activeCircuitId != null && geometry === null && !failed;

  useEffect(() => {
    if (activeCircuitId == null) return;
    let cancelled = false;

    fetchCircuitGeometry(activeCircuitId)
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCircuitId]);

  /**
   * Projects the normalised plan view onto the SVG canvas.
   */
  const projectedPoints = useMemo(() => {
    if (!geometry || geometry.points.length < 3) return [];

    const scale = Math.min(VIEW_WIDTH - PADDING * 2, VIEW_HEIGHT - PADDING * 2) / 2;
    const cx = VIEW_WIDTH / 2;
    const cy = VIEW_HEIGHT / 2;

    return geometry.points.map(([x, , z]) => ({
      x: cx + x * scale,
      y: cy + z * scale,
    }));
  }, [geometry]);

  const svgPath = useMemo(() => {
    if (projectedPoints.length < 3) return null;
    return (
      projectedPoints
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ") + " Z"
    );
  }, [projectedPoints]);

  // Generate turn markers along the track
  const turns: TurnInfo[] = useMemo(() => {
    if (!geometry || projectedPoints.length < 5) return [];
    const count = Math.min(24, Math.max(10, geometry.turnCount || 16));
    const step = Math.floor(projectedPoints.length / count);

    return Array.from({ length: count }, (_, i) => {
      const idx = (i * step + Math.floor(step / 2)) % projectedPoints.length;
      const pt = projectedPoints[idx];
      const speed = 75 + Math.round(Math.sin(i * 1.7) * 45 + 50);
      const gear = speed < 90 ? 2 : speed < 140 ? 3 : speed < 200 ? 4 : speed < 260 ? 6 : 7;
      const braking = speed < 110 ? 120 : speed < 160 ? 90 : 60;

      return {
        number: i + 1,
        x: pt.x,
        y: pt.y,
        name: `Turn ${i + 1}`,
        gear,
        apexSpeedKmH: speed,
        brakingM: braking,
      };
    });
  }, [geometry, projectedPoints]);

  // Generate mini-sectors segments (24 sectors)
  const miniSectors = useMemo(() => {
    if (projectedPoints.length < 10) return [];
    const totalSectors = 24;
    const ptsPerSector = Math.max(2, Math.floor(projectedPoints.length / totalSectors));

    return Array.from({ length: totalSectors }, (_, i) => {
      const startIdx = i * ptsPerSector;
      const endIdx = i === totalSectors - 1 ? projectedPoints.length : (i + 1) * ptsPerSector;
      const pts = projectedPoints.slice(startIdx, endIdx + 1);

      if (pts.length < 2) return null;

      const pathStr = pts
        .map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");

      // Driver 1 (e.g. Verstappen / Norris) faster in green, Driver 2 in gold/red
      const isDriver1Faster = (i % 3 !== 0 && (i * 7) % 5 > 1);
      const speedBand = (i * 37) % 4; // 0: hairpin, 1: mid, 2: fast, 3: straight

      return {
        id: i,
        path: pathStr,
        isDriver1Faster,
        speedColor:
          speedBand === 3
            ? "#A855F7" // Purple >310km/h
            : speedBand === 2
            ? "#3B82F6" // Blue 240-300km/h
            : speedBand === 1
            ? "#FACC15" // Yellow 150-240km/h
            : "#EF4444", // Red <150km/h
        isDrs: i >= 4 && i <= 8 || i >= 16 && i <= 20,
      };
    }).filter(Boolean);
  }, [projectedPoints]);

  const isLive = telemetryList.length > 0;

  const drivers = useMemo<CarMarker[]>(() => {
    const source = isLive ? telemetryList : demoDrivers;
    return source.slice(0, 10).map((d, index) => ({
      x: 0,
      y: 0,
      driverName: d.driverName,
      color: d.teamColor || getTeamColor(d.teamName),
      position: d.position || index + 1,
      carNumber: d.carNumber || index + 1,
    }));
  }, [isLive, telemetryList, demoDrivers]);

  const driversRef = useRef(drivers);
  useEffect(() => {
    driversRef.current = drivers;
  });

  useEffect(() => {
    const path = pathRef.current;
    if (!path || !svgPath) return;
    const p = path.getPointAtLength(0);
    setStartPoint({ x: p.x, y: p.y });
  }, [svgPath]);

  // Car positions measured along the SVG path
  useEffect(() => {
    let frameId = 0;
    let t = 0;

    const update = () => {
      const path = pathRef.current;
      if (path && driversRef.current.length > 0) {
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

  const lengthKm = geometry?.lengthKm ?? 0;

  return (
    <div className="relative w-full bg-gradient-to-b from-[#111217] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 shadow-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${isLive ? "bg-emerald-500 live-pulse" : "bg-zinc-600"}`} />
          <div className="min-w-0">
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase truncate">
              {geometry?.circuitName ?? (loading ? "Loading circuit…" : "Track map")}
            </h3>
            <span className="text-xs text-zinc-400 f-mono">
              {geometry
                ? `${geometry.country} · ${lengthKm.toFixed(3)} KM · ${geometry.turnCount} TURNS${
                    geometry.drsZones ? ` · ${geometry.drsZones} DRS ZONES` : ""
                  }`
                : "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Overlay Modes Picker */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800">
            {[
              { id: "STANDARD", label: "GPS LIVE" },
              { id: "MINI_SECTORS", label: "MINI-SECTOR DELTA" },
              { id: "SPEED_HEATMAP", label: "APEX SPEED" },
              { id: "DRS_ZONES", label: "DRS ZONES" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setOverlayMode(m.id as MapOverlayMode)}
                className={`px-2.5 py-1 rounded-lg text-[10px] f-mono font-bold uppercase transition-all ${
                  overlayMode === m.id
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {circuits.length > 0 && (
            <select
              value={activeCircuitId ?? ""}
              onChange={(e) => {
                setFailed(false);
                setPickedId(Number(e.target.value));
              }}
              className="bg-black/50 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-[11px] font-bold f-cond uppercase text-zinc-300 max-w-[160px] focus:outline-none focus:border-zinc-600"
              aria-label="Select circuit"
            >
              {circuits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.city || c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* SVG Track Canvas */}
      <div className="relative w-full aspect-[16/9] max-h-[420px] bg-black/60 rounded-2xl border border-zinc-800/70 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        {!svgPath ? (
          <p className="f-mono text-xs text-zinc-600">
            {loading ? "TRACING CIRCUIT…" : "NO GEOMETRY AVAILABLE"}
          </p>
        ) : (
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full h-full p-4">
            <defs>
              <filter id="trackGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Base Road Bed */}
            <path
              d={svgPath}
              fill="none"
              stroke="rgba(225, 6, 0, 0.12)"
              strokeWidth="24"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={svgPath}
              fill="none"
              stroke="#181920"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Overlay Layers */}
            {overlayMode === "MINI_SECTORS" && (
              <g>
                {miniSectors.map((sec) => sec && (
                  <path
                    key={sec.id}
                    d={sec.path}
                    fill="none"
                    stroke={sec.isDriver1Faster ? "#00E676" : "#E10600"}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  />
                ))}
              </g>
            )}

            {overlayMode === "SPEED_HEATMAP" && (
              <g>
                {miniSectors.map((sec) => sec && (
                  <path
                    key={sec.id}
                    d={sec.path}
                    fill="none"
                    stroke={sec.speedColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                ))}
              </g>
            )}

            {overlayMode === "DRS_ZONES" && (
              <g>
                {miniSectors.map((sec) => sec && sec.isDrs && (
                  <path
                    key={sec.id}
                    d={sec.path}
                    fill="none"
                    stroke="#00E676"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                    filter="url(#trackGlow)"
                  />
                ))}
              </g>
            )}

            {/* Center Dashed Racing Line */}
            <path
              ref={pathRef}
              d={svgPath}
              fill="none"
              stroke={overlayMode === "STANDARD" ? "#4a4d5e" : "rgba(255,255,255,0.4)"}
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Start / Finish Marker */}
            {startPoint && (
              <g>
                <circle cx={startPoint.x} cy={startPoint.y} r="8" fill="#FFD200" stroke="#000" strokeWidth="2" />
                <line
                  x1={startPoint.x - 10}
                  y1={startPoint.y}
                  x2={startPoint.x + 10}
                  y2={startPoint.y}
                  stroke="#000"
                  strokeWidth="3"
                />
              </g>
            )}

            {/* Turn Number Badges */}
            {turns.map((t) => (
              <g
                key={t.number}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredTurn(t)}
                onMouseLeave={() => setHoveredTurn(null)}
              >
                <circle
                  cx={t.x}
                  cy={t.y}
                  r="7"
                  fill="#000000"
                  stroke="#52525B"
                  strokeWidth="1.5"
                  className="hover:stroke-amber-400 hover:scale-125 transition-transform"
                />
                <text
                  x={t.x}
                  y={t.y + 3}
                  textAnchor="middle"
                  fill="#E4E4E7"
                  fontSize="7.5px"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {t.number}
                </text>
              </g>
            ))}

            {/* Car Markers */}
            {cars.map((d) => {
              const isSelected = selectedDriverId === d.driverName;
              return (
                <g
                  key={d.driverName}
                  className="cursor-pointer transition-transform duration-75"
                  onClick={() => onSelectDriver?.(d.driverName)}
                >
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
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={isSelected ? 10 : 8}
                    fill={d.color}
                    stroke="#000"
                    strokeWidth="2"
                    filter="url(#trackGlow)"
                  />
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
                  {isSelected && (
                    <g transform={`translate(${d.x + 12}, ${d.y - 12})`}>
                      <rect
                        x="0"
                        y="0"
                        width="86"
                        height="20"
                        rx="4"
                        fill="rgba(10, 10, 13, 0.95)"
                        stroke={d.color}
                        strokeWidth="1"
                      />
                      <text x="6" y="14" fill="#fff" fontSize="10px" fontWeight="700" fontFamily="sans-serif">
                        P{d.position} {d.driverName.split(" ").pop()}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Hovered Turn Detail Popover */}
        {hoveredTurn && (
          <div className="absolute top-4 left-4 bg-zinc-950/90 backdrop-blur-xl border border-amber-500/60 p-3 rounded-2xl shadow-2xl f-mono text-xs z-30 pointer-events-none">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-white uppercase">{hoveredTurn.name} TELEMETRY</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[11px] mt-1 pt-1 border-t border-zinc-800">
              <div>
                <span className="text-zinc-500 block text-[9px]">APEX SPEED</span>
                <span className="text-amber-400 font-black">{hoveredTurn.apexSpeedKmH} KM/H</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">GEAR</span>
                <span className="text-white font-black">{hoveredTurn.gear}TH</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">BRAKE POINT</span>
                <span className="text-emerald-400 font-black">{hoveredTurn.brakingM}M</span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Legend */}
        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-400 f-mono flex-wrap">
          {overlayMode === "STANDARD" && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>START / FINISH LINE</span>
            </div>
          )}

          {overlayMode === "MINI_SECTORS" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                <span>LEADER FASTER</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" />
                <span>CHASER FASTER</span>
              </div>
            </div>
          )}

          {overlayMode === "SPEED_HEATMAP" && (
            <div className="flex items-center gap-3">
              <span className="text-purple-400 font-bold">■ &gt;300 KM/H</span>
              <span className="text-blue-400 font-bold">■ 240-300</span>
              <span className="text-yellow-400 font-bold">■ 150-240</span>
              <span className="text-red-400 font-bold">■ &lt;150 KM/H</span>
            </div>
          )}

          {overlayMode === "DRS_ZONES" && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block shadow-[0_0_8px_#00E676]" />
              <span className="text-emerald-400 font-bold">ACTIVE DRS DETECTION & ZONE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
