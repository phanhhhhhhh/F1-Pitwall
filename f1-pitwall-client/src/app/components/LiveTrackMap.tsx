"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamColor } from "../lib/f1-theme";
import { fetchCircuitGeometry } from "../lib/f1-data";
import type {
  CircuitGeometry,
  CircuitInfo,
  DriverStanding,
  TelemetryData,
  TrackCorner,
} from "../types/f1";

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

/** A corner from the traced lap, placed on the SVG canvas. */
type TurnInfo = TrackCorner & { x: number; y: number };

interface Point {
  x: number;
  y: number;
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;
/** Room for the track stroke and the car markers, which sit on top of the line. */
const PADDING = 60;
/** Sectors the lap is split into for the pace and speed overlays. */
const SECTOR_COUNT = 24;

/** The speed bands a timing screen uses, so the colours mean the same thing here as on TV. */
function speedColour(kmh: number): string {
  if (kmh > 300) return "#A855F7";
  if (kmh > 240) return "#3B82F6";
  if (kmh > 150) return "#FACC15";
  return "#EF4444";
}

function toPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

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

  /**
   * The overlays read a real lap driven at this circuit — the same lap the racing line was traced
   * from. Circuits whose geometry came from map data have no such lap, and there is nothing
   * honest to draw for them, so the overlays are switched off rather than filled in.
   */
  const samples = useMemo(() => geometry?.samples ?? [], [geometry]);
  const hasTrace = Boolean(geometry?.hasLapTelemetry) && samples.length === projectedPoints.length;

  // The picked mode is remembered, but switching to a circuit with no traced lap falls back to the
  // plain map rather than showing an overlay with nothing behind it.
  const activeMode: MapOverlayMode = hasTrace ? overlayMode : "STANDARD";

  const turns = useMemo<TurnInfo[]>(() => {
    if (!geometry || !hasTrace) return [];
    return geometry.corners
      .filter((corner) => corner.pointIndex < projectedPoints.length)
      .map((corner) => ({
        ...corner,
        x: projectedPoints[corner.pointIndex].x,
        y: projectedPoints[corner.pointIndex].y,
      }));
  }, [geometry, hasTrace, projectedPoints]);

  /** The lap split into equal stretches, each carrying the speed the car actually held over it. */
  const miniSectors = useMemo(() => {
    if (!hasTrace || projectedPoints.length < SECTOR_COUNT * 2) return [];

    const perSector = Math.floor(projectedPoints.length / SECTOR_COUNT);
    const lapAverage = samples.reduce((sum, s) => sum + s.speedKmh, 0) / samples.length;

    return Array.from({ length: SECTOR_COUNT }, (_, i) => {
      const start = i * perSector;
      const end = i === SECTOR_COUNT - 1 ? projectedPoints.length : (i + 1) * perSector;

      // Reaching one point past the end joins each stretch to the next, and wraps the last one
      // back to the start line rather than leaving a gap there.
      const pts: Point[] = [];
      for (let k = start; k <= end; k++) pts.push(projectedPoints[k % projectedPoints.length]);

      const within = samples.slice(start, end);
      const averageKmH = within.reduce((sum, s) => sum + s.speedKmh, 0) / within.length;

      return {
        id: i,
        path: toPath(pts),
        averageKmH,
        aboveLapAverage: averageKmH >= lapAverage,
        colour: speedColour(averageKmH),
      };
    });
  }, [hasTrace, projectedPoints, samples]);

  /** The stretches the traced driver actually ran with the wing open. */
  const drsPaths = useMemo(() => {
    if (!geometry || !hasTrace) return [];
    const n = projectedPoints.length;

    return geometry.drsRanges.map((range, i) => {
      const span = ((range.endIndex - range.startIndex + n) % n) + 1;
      const pts: Point[] = [];
      for (let k = 0; k < span; k++) pts.push(projectedPoints[(range.startIndex + k) % n]);
      return { id: i, path: toPath(pts), lengthM: range.lengthM };
    });
  }, [geometry, hasTrace, projectedPoints]);

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
              { id: "STANDARD", label: "GPS LIVE", needsTrace: false },
              { id: "MINI_SECTORS", label: "SECTOR PACE", needsTrace: true },
              { id: "SPEED_HEATMAP", label: "SPEED TRACE", needsTrace: true },
              { id: "DRS_ZONES", label: "DRS ZONES", needsTrace: true },
            ].map((m) => {
              const locked = m.needsTrace && !hasTrace;
              return (
                <button
                  key={m.id}
                  onClick={() => setOverlayMode(m.id as MapOverlayMode)}
                  disabled={locked}
                  title={locked ? "No lap telemetry recorded for this circuit" : undefined}
                  className={`px-2.5 py-1 rounded-lg text-[10px] f-mono font-bold uppercase transition-all ${
                    activeMode === m.id
                      ? "bg-red-600 text-white shadow-sm"
                      : locked
                      ? "text-zinc-700 cursor-not-allowed"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
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
            {activeMode === "MINI_SECTORS" && (
              <g>
                {miniSectors.map((sec) => (
                  <path
                    key={sec.id}
                    d={sec.path}
                    fill="none"
                    stroke={sec.aboveLapAverage ? "#00E676" : "#E10600"}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  >
                    <title>{`Sector ${sec.id + 1} · ${Math.round(sec.averageKmH)} km/h average`}</title>
                  </path>
                ))}
              </g>
            )}

            {activeMode === "SPEED_HEATMAP" && (
              <g>
                {miniSectors.map((sec) => (
                  <path
                    key={sec.id}
                    d={sec.path}
                    fill="none"
                    stroke={sec.colour}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  >
                    <title>{`Sector ${sec.id + 1} · ${Math.round(sec.averageKmH)} km/h average`}</title>
                  </path>
                ))}
              </g>
            )}

            {activeMode === "DRS_ZONES" && (
              <g>
                {drsPaths.map((zone) => (
                  <path
                    key={zone.id}
                    d={zone.path}
                    fill="none"
                    stroke="#00E676"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                    filter="url(#trackGlow)"
                  >
                    <title>{`DRS open for ${Math.round(zone.lengthM)} m`}</title>
                  </path>
                ))}
              </g>
            )}

            {/* Center Dashed Racing Line */}
            <path
              ref={pathRef}
              d={svgPath}
              fill="none"
              stroke={activeMode === "STANDARD" ? "#4a4d5e" : "rgba(255,255,255,0.4)"}
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
              <span className="font-bold text-white uppercase">TURN {hoveredTurn.number}</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-[11px] mt-1 pt-1 border-t border-zinc-800">
              <div>
                <span className="text-zinc-500 block text-[9px]">APEX SPEED</span>
                <span className="text-amber-400 font-black">
                  {Math.round(hoveredTurn.apexSpeedKmH)} KM/H
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">GEAR</span>
                <span className="text-white font-black">
                  {hoveredTurn.gear > 0 ? hoveredTurn.gear : "—"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">ENTRY</span>
                <span className="text-white font-black">
                  {Math.round(hoveredTurn.entrySpeedKmH)} KM/H
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">BRAKING</span>
                <span className="text-emerald-400 font-black">
                  {Math.round(hoveredTurn.brakingM)} M
                </span>
              </div>
            </div>
            <p className="text-[9px] text-zinc-500 mt-2 pt-1.5 border-t border-zinc-800/80">
              Measured on {geometry?.sourceLabel?.toLowerCase() ?? "the traced lap"}
            </p>
          </div>
        )}

        {/* Bottom Legend */}
        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-400 f-mono flex-wrap">
          {activeMode === "STANDARD" && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>START / FINISH LINE</span>
            </div>
          )}

          {activeMode === "MINI_SECTORS" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                <span>ABOVE LAP AVERAGE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-red-600 inline-block" />
                <span>BELOW LAP AVERAGE</span>
              </div>
            </div>
          )}

          {activeMode === "SPEED_HEATMAP" && (
            <div className="flex items-center gap-3">
              <span className="text-purple-400 font-bold">■ &gt;300 KM/H</span>
              <span className="text-blue-400 font-bold">■ 240-300</span>
              <span className="text-yellow-400 font-bold">■ 150-240</span>
              <span className="text-red-400 font-bold">■ &lt;150 KM/H</span>
            </div>
          )}

          {activeMode === "DRS_ZONES" && (
            <div className="flex items-center gap-2">
              {drsPaths.length > 0 ? (
                <>
                  <span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block shadow-[0_0_8px_#00E676]" />
                  <span className="text-emerald-400 font-bold">
                    WING OPEN OVER {drsPaths.length} {drsPaths.length === 1 ? "STRETCH" : "STRETCHES"}
                  </span>
                </>
              ) : (
                // A driver in clean air never opens it, and that is a fact about the lap rather
                // than a hole to paint the published zones into.
                <span className="text-zinc-500 font-bold">
                  DRS NEVER OPENED ON THE TRACED LAP
                </span>
              )}
            </div>
          )}

          {activeMode !== "STANDARD" && (
            <span className="text-zinc-600">
              {geometry?.sourceLabel?.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
