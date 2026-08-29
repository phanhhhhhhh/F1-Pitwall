"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getTeamColor, flagForNationality } from "../lib/f1-theme";
import { playUiClick } from "../lib/f1-sound";
import { fetchDriverProfiles } from "../lib/f1-data";
import type { DriverProfile } from "../types/f1";

interface HologramHelmet3DProps {
  season: number;
  /** Driver to open on. Defaults to the highest rated. */
  initialDriverId?: number;
  /** Profiles already loaded by the host page, to avoid a second request. */
  profiles?: DriverProfile[];
}

/** The five rated abilities, in the order the panel shows them. */
const SKILL_ROWS = [
  { key: "pace", label: "QUALIFYING PACE", color: "#34d399" },
  { key: "racecraft", label: "RACECRAFT & DEFENCE", color: "#fbbf24" },
  { key: "tyreMgmt", label: "TYRE PRESERVATION", color: "#fb923c" },
  { key: "wetSkill", label: "WET WEATHER", color: "#38bdf8" },
  { key: "experience", label: "EXPERIENCE", color: "#a78bfa" },
] as const;

export default function HologramHelmet3D({
  season,
  initialDriverId,
  profiles: profilesProp,
}: HologramHelmet3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const hudRingRef = useRef<THREE.Mesh | null>(null);

  // Profiles either arrive as a prop or are fetched here; the effective list is derived rather than
  // mirrored into state, so a prop update is picked up immediately.
  const [fetchedProfiles, setFetchedProfiles] = useState<DriverProfile[] | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profiles = useMemo(
    () => (profilesProp?.length ? profilesProp : (fetchedProfiles ?? [])),
    [profilesProp, fetchedProfiles]
  );
  const loading = !profilesProp?.length && fetchedProfiles === null && error === null;
  const selectedId = pickedId ?? initialDriverId ?? null;

  useEffect(() => {
    if (profilesProp?.length) return;
    let cancelled = false;
    fetchDriverProfiles(season)
      .then((data) => {
        if (!cancelled) setFetchedProfiles(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load driver ratings");
      });
    return () => {
      cancelled = true;
    };
  }, [season, profilesProp]);

  // Profiles arrive sorted by overall rating, so the first entry is the natural default.
  const selected = useMemo(() => {
    if (profiles.length === 0) return null;
    return profiles.find((p) => p.driverId === selectedId) ?? profiles[0];
  }, [profiles, selectedId]);

  const helmetColor = getTeamColor(selected?.teamName, selected?.teamColorHex);

  // ── Scene ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0e);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.5, 6.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(5, 8, 5);
    scene.add(mainLight);

    const cyanRim = new THREE.PointLight(0x00e5ff, 3, 10);
    cyanRim.position.set(-4, 2, -3);
    scene.add(cyanRim);

    const helmetGroup = new THREE.Group();
    scene.add(helmetGroup);

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(helmetColor),
      roughness: 0.15,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    shellMatRef.current = shellMat;

    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 24), shellMat);
    shell.scale.set(1, 1.15, 1.1);
    helmetGroup.add(shell);

    const chin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.2), shellMat);
    chin.position.set(0, -0.6, 0.8);
    helmetGroup.add(chin);

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.7, 24, 1, true, -Math.PI / 2.8, Math.PI / 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x111115,
        roughness: 0.05,
        metalness: 0.95,
        transparent: true,
        opacity: 0.9,
      })
    );
    visor.position.set(0, 0.1, 0.6);
    helmetGroup.add(visor);

    const hudRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.02, 16, 48),
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.6,
        wireframe: true,
      })
    );
    hudRingRef.current = hudRing;
    helmetGroup.add(hudRing);

    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0;
    let rotX = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      rotY += (e.clientX - prevX) * 0.01;
      rotX += (e.clientY - prevY) * 0.01;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const started = performance.now();
    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!isDragging) rotY += 0.008;

      helmetGroup.rotation.y = rotY;
      helmetGroup.rotation.x = Math.sin((performance.now() - started) / 1500) * 0.05 + rotX * 0.3;
      hudRing.rotation.z += 0.015;

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
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
    };
    // The scene is built once; the livery colour is pushed in by the effect below so switching
    // driver does not tear down and rebuild the whole renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    shellMatRef.current?.color.set(new THREE.Color(helmetColor));
  }, [helmetColor]);

  return (
    <div className="w-full bg-gradient-to-b from-[#14151b] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 live-pulse" />
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
            DRIVER RATING LAB · {season}
          </h3>
        </div>
        <span className="text-xs f-mono text-zinc-500 font-bold">
          RATED FROM {season} RACE DATA
        </span>
      </div>

      {loading && (
        <p className="f-mono text-xs text-zinc-500 py-10 text-center">COMPUTING DRIVER RATINGS…</p>
      )}
      {error && <p className="f-mono text-xs text-red-400 py-10 text-center">{error}</p>}

      {!loading && !error && selected && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 relative aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-800 bg-black/60 shadow-inner">
              <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] f-mono text-zinc-400">
                DRAG TO ROTATE · LIVERY FROM TEAM RECORD
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3.5">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black f-orbitron text-xs text-black"
                    style={{ background: helmetColor }}
                  >
                    {selected.carNumber}
                  </span>
                  <span className="text-xs f-mono font-bold text-zinc-400 uppercase truncate">
                    {selected.teamName ?? "NO TEAM"}
                  </span>
                  <span className="text-sm leading-none">{flagForNationality(selected.nationality)}</span>
                </div>
                <h2 className="text-3xl font-black f-cond uppercase text-white tracking-tight">
                  {selected.name}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="f-orbitron text-[10px] text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md font-bold">
                    OVERALL {selected.skills.overall}
                  </span>
                  {selected.careerWins > 0 && (
                    <span className="f-orbitron text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                      {selected.careerWins} WINS
                    </span>
                  )}
                  {selected.age != null && (
                    <span className="f-mono text-[10px] text-zinc-500">{selected.age} yrs</span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800 space-y-2.5">
                {SKILL_ROWS.map((row) => (
                  <SkillBar
                    key={row.key}
                    label={row.label}
                    value={selected.skills[row.key]}
                    confidence={selected.evidence.confidence[row.key]}
                    color={row.color}
                  />
                ))}
              </div>

              <EvidencePanel profile={selected} />
            </div>
          </div>

          {/* Every driver on the grid, ordered by rating */}
          <div className="flex flex-wrap gap-1.5 pt-4 mt-4 border-t border-zinc-800">
            {profiles.map((p) => (
              <button
                key={p.driverId}
                onClick={() => {
                  playUiClick();
                  setPickedId(p.driverId);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold f-cond uppercase transition-all ${
                  selected.driverId === p.driverId
                    ? "bg-zinc-800 border-zinc-400 text-white shadow-md"
                    : "bg-black/40 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                  style={{ background: getTeamColor(p.teamName, p.teamColorHex) }}
                />
                {p.carNumber} {p.name.split(" ").pop()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A rating bar. Confidence is drawn as a lighter overlay past the confident portion, so a rating
 * built on three races does not look as solid as one built on twenty.
 */
function SkillBar({
  label,
  value,
  confidence,
  color,
}: {
  label: string;
  value: number;
  confidence: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-zinc-400 mb-0.5 text-[11px] f-mono">
        <span>{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-bold" style={{ color }}>
            {value}
          </span>
          <span className="text-zinc-600 text-[9px]" title="How much race data backs this rating">
            {confidence}%
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden relative">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, background: color, opacity: 0.35 + (confidence / 100) * 0.65 }}
        />
      </div>
    </div>
  );
}

/** The numbers the ratings were computed from — the point of the panel is that they are checkable. */
function EvidencePanel({ profile }: { profile: DriverProfile }) {
  const e = profile.evidence;
  const gap = e.teammateGapPct;

  const rows: { label: string; value: string }[] = [
    {
      label: "TEAMMATE",
      value: e.teammateName ?? "—",
    },
    {
      label: "QUALI H2H",
      value:
        e.qualifyingH2HPct != null
          ? `${e.qualifyingH2HPct.toFixed(0)}% of ${e.qualifyingHeadToHeadSessions}`
          : "no data",
    },
    {
      label: "QUALI GAP",
      value: gap != null ? `${gap > 0 ? "+" : ""}${gap.toFixed(3)}%` : "no data",
    },
    {
      label: "POS GAINED",
      value:
        e.avgPositionsGained != null
          ? `${e.avgPositionsGained > 0 ? "+" : ""}${e.avgPositionsGained.toFixed(1)} / race`
          : "no data",
    },
    {
      label: "FINISH RATE",
      value:
        e.finishRatePct != null
          ? `${e.finishRatePct.toFixed(0)}% (${e.racesClassified}/${e.racesStarted})`
          : "no data",
    },
    {
      label: "TYRE DEG",
      value:
        e.degradationSecPerLap != null
          ? `${e.degradationSecPerLap >= 0 ? "+" : ""}${e.degradationSecPerLap.toFixed(3)} s/lap`
          : "no stint data",
    },
    {
      label: "FIELD DEG",
      value:
        e.fieldDegradationSecPerLap != null
          ? `${e.fieldDegradationSecPerLap.toFixed(3)} s/lap`
          : "—",
    },
    {
      label: "WET RACES",
      value:
        e.wetRaces > 0 && e.wetAvgFinish != null && e.dryAvgFinish != null
          ? `${e.wetRaces} · P${e.wetAvgFinish.toFixed(1)} vs P${e.dryAvgFinish.toFixed(1)} dry`
          : "none this season",
    },
  ];

  return (
    <details className="rounded-2xl bg-black/50 border border-zinc-800 overflow-hidden group" open>
      <summary className="px-3.5 py-2.5 cursor-pointer f-mono text-[10px] text-zinc-400 uppercase tracking-wider select-none hover:text-zinc-200">
        Why these ratings
      </summary>
      <div className="px-3.5 pb-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="f-mono text-[9px] text-zinc-600 uppercase">{row.label}</p>
            <p className="f-mono text-[10px] text-zinc-300 truncate" title={row.value}>
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}
