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
  // A circuit the viewer picked from the switcher overrides the one the page asked for; keeping the
  // two separate means a new `circuitId` from the page still takes effect until someone picks.
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<CircuitGeometry | null>(null);
  const [failed, setFailed] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [cars, setCars] = useState<CarMarker[]>([]);

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
   * Projects the normalised plan view onto the SVG canvas. The geometry keeps the circuit's true
   * aspect ratio, so a single scale factor is used for both axes and the result is centred.
   */
  const svgPath = useMemo(() => {
    if (!geometry || geometry.points.length < 3) return null;

    const scale = Math.min(VIEW_WIDTH - PADDING * 2, VIEW_HEIGHT - PADDING * 2) / 2;
    const cx = VIEW_WIDTH / 2;
    const cy = VIEW_HEIGHT / 2;

    return (
      geometry.points
        .map(([x, , z], i) => {
          const px = cx + x * scale;
          const py = cy + z * scale;
          return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  }, [geometry]);

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

  // The animation loop reads the latest drivers through a ref so it never has to restart.
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

  // Car positions are measured from the path inside the frame callback — reading SVG geometry
  // during render would tie layout to React's render timing.
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

  // Official circuit length, not the slightly-short traced figure.
  const lengthKm = geometry?.lengthKm ?? 0;

  return (
    <div className="relative w-full bg-gradient-to-b from-[#111217] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 shadow-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${isLive ? "bg-emerald-500 live-pulse" : "bg-zinc-600"}`} />
          <div className="min-w-0">
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase truncate">
              {geometry?.circuitName ?? (loading ? "Loading circuit…" : "Track map")}
            </h3>
            <span className="text-xs text-zinc-400 f-mono">
              {geometry
                ? `${geometry.country} · ${lengthKm.toFixed(3)} KM · ${geometry.turnCount} TURNS${
                    geometry.drsZones ? ` · ${geometry.drsZones} DRS` : ""
                  }`
                : "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Never present a demo lap as live timing */}
          <span
            className={`f-orbitron text-[9px] font-bold px-2 py-1 rounded-md border ${
              isLive
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                : "text-zinc-500 bg-white/5 border-white/10"
            }`}
          >
            {isLive ? "LIVE GPS" : "DEMO LAP"}
          </span>

          {circuits.length > 0 && (
            <select
              value={activeCircuitId ?? ""}
              onChange={(e) => { setFailed(false); setPickedId(Number(e.target.value)); }}
              className="bg-black/50 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-[11px] font-bold f-cond uppercase text-zinc-300 max-w-[170px] focus:outline-none focus:border-zinc-600"
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

      <div className="relative w-full aspect-[16/9] max-h-[380px] bg-black/60 rounded-2xl border border-zinc-800/70 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent scanline" />
        </div>

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

            <path
              d={svgPath}
              fill="none"
              stroke="rgba(225, 6, 0, 0.15)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={svgPath}
              fill="none"
              stroke="#1c1d24"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              ref={pathRef}
              d={svgPath}
              fill="none"
              stroke="#383a47"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {startPoint && (
              <circle cx={startPoint.x} cy={startPoint.y} r="6" fill="#FFD200" stroke="#000" strokeWidth="2" />
            )}

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
                        fill="rgba(10, 10, 13, 0.9)"
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

        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 flex items-center gap-3 text-[10px] text-zinc-400 f-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>START/FINISH</span>
          </div>
          {geometry && (
            <span className="text-zinc-600">
              {geometry.source === "OPENF1"
                ? "SHAPE FROM TELEMETRY"
                : geometry.source === "GEOJSON"
                  ? "SHAPE FROM MAP DATA"
                  : "APPROXIMATE OUTLINE"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
