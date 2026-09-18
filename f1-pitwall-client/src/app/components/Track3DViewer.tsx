"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { fetchCircuitGeometry, fetchCircuits, formatLapTime } from "../lib/f1-data";
import type { CircuitGeometry, CircuitInfo } from "../types/f1";

interface Track3DViewerProps {
  /** Circuits to offer in the switcher. Fetched here when the host page has none to pass. */
  circuits?: CircuitInfo[];
  /** Circuit to open on. Defaults to the first entry. */
  initialCircuitId?: number;
}

/** Half-width of the plan view in scene units — the camera and grid are sized around this. */
const PLAN_SCALE = 10;

/**
 * Real circuits are far wider than they are tall: Spa's 100 m of elevation sits inside a bounding
 * box well over a kilometre across, so at true scale the climb is invisible. The viewer therefore
 * exaggerates height by a stated factor and always shows what that factor is.
 */
const EXAGGERATION_STEPS = [1, 4, 8, 16] as const;
const DEFAULT_EXAGGERATION = 8;

const SOURCE_BADGE: Record<CircuitGeometry["source"], { label: string; className: string }> = {
  OPENF1: {
    label: "TELEMETRY",
    className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  GEOJSON: {
    label: "MAP DATA",
    className: "text-sky-400 bg-sky-500/10 border-sky-500/30",
  },
  SYNTHETIC: {
    label: "APPROXIMATE",
    className: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
};

export default function Track3DViewer({ circuits: circuitsProp, initialCircuitId }: Track3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [fetchedCircuits, setFetchedCircuits] = useState<CircuitInfo[] | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  // Geometry is kept together with the circuit it belongs to, so "is this still loading?" is a
  // comparison rather than a second piece of state that has to be kept in sync.
  const [loaded, setLoaded] = useState<CircuitGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exaggeration, setExaggeration] = useState<number>(DEFAULT_EXAGGERATION);
  const [carAltitudeM, setCarAltitudeM] = useState(0);

  // The animation loop writes the car's altitude on every frame; routing that through state would
  // re-render 60 times a second, so the readout is throttled through a ref instead.
  const altitudeRef = useRef(0);

  const circuits = circuitsProp?.length ? circuitsProp : (fetchedCircuits ?? []);
  const selectedId = pickedId ?? initialCircuitId ?? circuits[0]?.id ?? null;
  const geometry = loaded?.circuitId === selectedId ? loaded : null;
  const loading = selectedId != null && geometry === null && error === null;

  useEffect(() => {
    if (circuitsProp?.length) return;
    let cancelled = false;
    fetchCircuits()
      .then((list) => {
        if (!cancelled) setFetchedCircuits(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load circuits");
      });
    return () => {
      cancelled = true;
    };
  }, [circuitsProp]);

  // ── Geometry ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;

    fetchCircuitGeometry(selectedId)
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load track geometry");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  /**
   * Converts the normalised points into scene coordinates. Elevation arrives in metres, so it is
   * first converted into the same units as the plan view and only then exaggerated — that keeps the
   * stated factor honest across circuits of very different sizes.
   */
  const curvePoints = useMemo(() => {
    if (!geometry || geometry.points.length < 3) return null;

    const planSpanM = Math.max(geometry.spanXM ?? 0, geometry.spanZM ?? 0);
    const metresPerUnit = planSpanM > 0 ? planSpanM / (2 * PLAN_SCALE) : 0;
    const heightScale = metresPerUnit > 0 ? exaggeration / metresPerUnit : 0;

    return geometry.points.map(
      ([x, y, z]) => new THREE.Vector3(x * PLAN_SCALE, y * heightScale, z * PLAN_SCALE)
    );
  }, [geometry, exaggeration]);

  // ── Scene ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !curvePoints) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0e);
    scene.fog = new THREE.FogExp2(0x0a0b0e, 0.022);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(10, 24, 10);
    scene.add(dirLight);

    const redRim = new THREE.PointLight(0xe10600, 3, 30);
    redRim.position.set(-8, 8, -8);
    scene.add(redRim);

    const grid = new THREE.GridHelper(30, 30, 0xe10600, 0x1f242e);
    grid.position.y = -0.1;
    scene.add(grid);

    const curve = new THREE.CatmullRomCurve3(curvePoints, true, "centripetal");

    // Tube segment count follows the point count so a detailed lap is not smoothed away.
    const segments = Math.min(600, Math.max(200, curvePoints.length * 2));

    const tarmac = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segments, 0.28, 10, true),
      new THREE.MeshStandardMaterial({ color: 0x1c1d24, roughness: 0.55, metalness: 0.55 })
    );
    scene.add(tarmac);

    const racingLine = new THREE.Mesh(
      new THREE.TubeGeometry(curve, segments, 0.05, 6, true),
      new THREE.MeshBasicMaterial({ color: 0xe10600 })
    );
    scene.add(racingLine);

    // Vertical drop lines make the elevation legible from a shallow camera angle.
    const dropPositions: number[] = [];
    for (let i = 0; i < curvePoints.length; i += 6) {
      const p = curvePoints[i];
      dropPositions.push(p.x, p.y, p.z, p.x, 0, p.z);
    }
    const dropGeometry = new THREE.BufferGeometry();
    dropGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dropPositions, 3));
    const drops = new THREE.LineSegments(
      dropGeometry,
      new THREE.LineBasicMaterial({ color: 0x2b6cb0, transparent: true, opacity: 0.28 })
    );
    scene.add(drops);

    const car = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.2, 0.32),
      new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x0088cc,
        emissiveIntensity: 0.7,
      })
    );
    scene.add(car);

    // ── Orbit ────────────────────────────────────────────────────────────────
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0.5;
    let rotX = 0.55;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      rotY += (e.clientX - prevX) * 0.008;
      rotX = Math.max(0.08, Math.min(Math.PI / 2.1, rotX + (e.clientY - prevY) * 0.008));
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // ── Loop ─────────────────────────────────────────────────────────────────
    let progress = 0;
    let frame = 0;
    let reqId = 0;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!dragging) rotY += 0.0025;

      const radius = 24;
      camera.position.set(
        radius * Math.sin(rotY) * Math.cos(rotX),
        radius * Math.sin(rotX),
        radius * Math.cos(rotY) * Math.cos(rotX)
      );
      camera.lookAt(0, 1, 0);

      progress = (progress + 0.0022) % 1;
      const point = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(progress);
      car.position.copy(point);
      car.position.y += 0.22;
      car.lookAt(point.clone().add(tangent));

      altitudeRef.current = point.y;
      if (++frame % 12 === 0) setCarAltitudeM(altitudeRef.current);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(reqId);
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(dom)) container.removeChild(dom);
    };
  }, [curvePoints]);

  const selectCircuit = useCallback((id: number) => {
    setError(null);
    setPickedId(id);
  }, []);

  const badge = geometry ? SOURCE_BADGE[geometry.source] : null;
  const elevationGain = geometry?.elevationGainM ?? 0;
  // The scene converts metres to units before exaggerating, so undoing that gives real metres back.
  const altitudeInMetres = useMemo(() => {
    if (!geometry) return 0;
    const planSpanM = Math.max(geometry.spanXM ?? 0, geometry.spanZM ?? 0);
    const metresPerUnit = planSpanM > 0 ? planSpanM / (2 * PLAN_SCALE) : 0;
    if (metresPerUnit <= 0) return 0;
    return (carAltitudeM / (exaggeration / metresPerUnit)) + (geometry.elevationMinM ?? 0);
  }, [carAltitudeM, geometry, exaggeration]);

  return (
    <div className="w-full bg-gradient-to-b from-[#14151b] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 live-pulse" />
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
              3D CIRCUIT ELEVATION &amp; RACING LINE
            </h3>
            {badge && (
              <span className={`f-orbitron text-[9px] font-bold px-2 py-0.5 rounded-md border ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 f-mono truncate">
            {geometry
              ? `${geometry.circuitName} · ${geometry.sourceLabel}`
              : loading
                ? "Building racing line from source data…"
                : "No geometry loaded"}
          </p>
        </div>

        {/* Elevation exaggeration — stated, never silently applied */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-zinc-800 shrink-0">
          <span className="f-mono text-[10px] text-zinc-500 px-1.5">HEIGHT</span>
          {EXAGGERATION_STEPS.map((step) => (
            <button
              key={step}
              onClick={() => setExaggeration(step)}
              className={`px-2.5 py-1 text-xs font-bold f-cond rounded-lg transition-all ${
                exaggeration === step
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {step === 1 ? "1:1" : `×${step}`}
            </button>
          ))}
        </div>
      </div>

      {/* Circuit switcher — every circuit in the database, not a hand-picked pair */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {circuits.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCircuit(c.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-bold f-cond uppercase rounded-lg border transition-all ${
              selectedId === c.id
                ? "bg-red-600 border-red-500 text-white shadow-sm"
                : "bg-black/40 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {c.city || c.name}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-inner">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {(loading || error) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <p className={`f-mono text-xs ${error ? "text-red-400" : "text-zinc-400"}`}>
                {error ?? "TRACING RACING LINE…"}
              </p>
            </div>
          )}

          {!loading && !error && geometry && (
            <>
              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] f-mono text-zinc-400">
                DRAG TO ORBIT · HEIGHT {exaggeration === 1 ? "TRUE SCALE" : `×${exaggeration}`}
              </div>
              {geometry.hasRealElevation && (
                <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] f-mono">
                  <span className="text-zinc-500">ALT </span>
                  <span className="text-cyan-300 font-bold tabular-nums">
                    {Math.round(altitudeInMetres)} m
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Real measurements, sourced rather than typed in */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat
              label="ELEVATION Δ"
              value={geometry?.hasRealElevation ? `${elevationGain.toFixed(1)} m` : "—"}
              hint={geometry?.hasRealElevation ? "measured from telemetry" : "no elevation in source"}
              accent="text-cyan-300"
            />
            {/*
              The official length is the headline. The traced figure runs a few percent short —
              240 sampled points chord across tight corners — so it is shown as supporting detail
              rather than presented as the circuit's length.
            */}
            <Stat
              label="LAP LENGTH"
              value={geometry?.lengthKm ? `${geometry.lengthKm.toFixed(3)} km` : "—"}
              hint={
                geometry?.measuredLengthKm
                  ? `${geometry.measuredLengthKm.toFixed(2)} km traced`
                  : undefined
              }
              accent="text-white"
            />
            <Stat
              label="TURNS"
              value={geometry?.turnCount ? String(geometry.turnCount) : "—"}
              accent="text-white"
            />
            <Stat
              label="DRS ZONES"
              value={geometry?.drsZones ? String(geometry.drsZones) : "—"}
              accent="text-emerald-400"
            />
            <Stat
              label="LAP RECORD"
              value={geometry?.lapRecordSec ? formatLapTime(geometry.lapRecordSec) : "—"}
              hint={geometry?.lapRecordHolder ?? undefined}
              accent="text-amber-400"
            />
            <Stat
              label="RACE DISTANCE"
              value={
                geometry?.totalLaps && geometry.lengthKm
                  ? `${(geometry.totalLaps * geometry.lengthKm).toFixed(0)} km`
                  : "—"
              }
              hint={geometry?.totalLaps ? `${geometry.totalLaps} laps` : undefined}
              accent="text-white"
            />
          </div>

          {geometry && <ElevationProfile geometry={geometry} />}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800">
      <p className="f-mono text-[9px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`f-orbitron text-lg font-black tabular-nums leading-none ${accent}`}>{value}</p>
      {hint && <p className="f-mono text-[9px] text-zinc-600 mt-1 truncate">{hint}</p>}
    </div>
  );
}

/**
 * Altitude against lap distance. This is the view that actually shows what a circuit's elevation
 * does — the 3D scene shows where the climbs are, the profile shows how steep they are.
 */
function ElevationProfile({ geometry }: { geometry: CircuitGeometry }) {
  const path = useMemo(() => {
    const points = geometry.points;
    if (points.length < 3) return null;

    const max = Math.max(...points.map((p) => p[1]));
    if (max <= 0) return null;

    const width = 300;
    const height = 64;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (p[1] / max) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [geometry]);

  if (!geometry.hasRealElevation || !path) {
    return (
      <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800">
        <p className="f-mono text-[9px] text-zinc-500 uppercase tracking-wider mb-1">
          ELEVATION PROFILE
        </p>
        <p className="f-mono text-[10px] text-zinc-600">
          {geometry.source === "GEOJSON"
            ? "Map data carries no per-point altitude for this circuit."
            : "This outline is generated — no elevation to plot."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="f-mono text-[9px] text-zinc-500 uppercase tracking-wider">ELEVATION PROFILE</p>
        <p className="f-mono text-[9px] text-zinc-600">
          {Math.round(geometry.elevationMinM ?? 0)}–{Math.round(geometry.elevationMaxM ?? 0)} m ASL
        </p>
      </div>
      <svg viewBox="0 0 300 64" className="w-full h-16" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L300,64 L0,64 Z`} fill="url(#elevFill)" />
        <path d={path} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
      </svg>
      <p className="f-mono text-[9px] text-zinc-600 mt-1">START/FINISH → ONE FULL LAP</p>
    </div>
  );
}
