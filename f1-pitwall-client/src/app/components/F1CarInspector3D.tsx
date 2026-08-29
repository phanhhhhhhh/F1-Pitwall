"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { playUiClick, playDrsBeep } from "../lib/f1-sound";
import { fetchTeamLiveries } from "../lib/f1-data";
import { getTeamColor } from "../lib/f1-theme";
import type { TeamLivery } from "../types/f1";

interface F1CarInspector3DProps {
  /** Team to open on, by name. Falls back to the first team returned. */
  initialTeam?: string;
  /** Liveries already loaded by the host page, to avoid a second request. */
  liveries?: TeamLivery[];
}

/**
 * 2026 technical regulation figures. These are rulebook constants rather than measurements, and the
 * panel labels them as such — the car being inspected is a procedural model, not a scanned chassis.
 */
const REGULATION_SPEC = {
  minWeightKg: 768,
  dragClosed: 1.08,
  dragOpen: 0.72,
  downforceKg: 2140,
  downforceAtKmh: 250,
};

export default function F1CarInspector3D({ initialTeam, liveries: liveriesProp }: F1CarInspector3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Liveries either arrive as a prop or are fetched here. Keeping the fetched list separate and
  // deriving the effective one avoids mirroring a prop into state, which would go stale.
  const [fetchedLiveries, setFetchedLiveries] = useState<TeamLivery[] | null>(null);
  const [pickedTeamName, setPickedTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveries = useMemo(
    () => (liveriesProp?.length ? liveriesProp : (fetchedLiveries ?? [])),
    [liveriesProp, fetchedLiveries]
  );
  const loading = !liveriesProp?.length && fetchedLiveries === null && error === null;
  const selectedTeamName = pickedTeamName ?? initialTeam ?? null;

  const [windTunnel, setWindTunnel] = useState(true);
  const [xrayMode, setXrayMode] = useState(false);
  const [drsOpen, setDrsOpen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // The render loop reads the toggles every frame. Holding them in refs keeps the WebGL scene alive
  // across a toggle — the previous version listed them as effect dependencies, which tore down and
  // rebuilt the entire renderer on every button press.
  const windTunnelRef = useRef(windTunnel);
  const drsOpenRef = useRef(drsOpen);
  const autoRotateRef = useRef(autoRotate);
  useEffect(() => { windTunnelRef.current = windTunnel; }, [windTunnel]);
  useEffect(() => { drsOpenRef.current = drsOpen; }, [drsOpen]);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  const bodyMaterialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const accentMaterialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);

  useEffect(() => {
    if (liveriesProp?.length) return;
    let cancelled = false;
    fetchTeamLiveries()
      .then((data) => {
        if (!cancelled) setFetchedLiveries(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load team liveries");
      });
    return () => {
      cancelled = true;
    };
  }, [liveriesProp]);

  const selected = useMemo(() => {
    if (liveries.length === 0) return null;
    return liveries.find((t) => t.name === selectedTeamName) ?? liveries[0];
  }, [liveries, selectedTeamName]);

  const bodyColor = getTeamColor(selected?.name, selected?.colorHex);
  // Teams without a recorded accent fall back to their primary colour rather than to an invented one.
  const accentColor = selected?.accentHex || bodyColor;

  // ── Scene ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0e);
    scene.fog = new THREE.FogExp2(0x0a0b0e, 0.035);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    // Studio lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(15, 20, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.8);
    rimLight.position.set(-15, 10, -15);
    scene.add(rimLight);

    const underglow = new THREE.PointLight(0xe10600, 2.5, 15);
    underglow.position.set(0, 0.2, 0);
    scene.add(underglow);

    const grid = new THREE.GridHelper(30, 30, 0xe10600, 0x1f242e);
    grid.position.y = -0.01;
    scene.add(grid);

    const carGroup = new THREE.Group();
    scene.add(carGroup);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#888888"),
      roughness: 0.25,
      metalness: 0.7,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    });
    bodyMaterialRef.current = bodyMat;

    // Endplates and the DRS flap take the team's secondary colour, which is where real liveries
    // put their accent too.
    const accentMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#cccccc"),
      roughness: 0.2,
      metalness: 0.75,
      clearcoat: 0.8,
    });
    accentMaterialRef.current = accentMat;

    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.4, metalness: 0.9 });
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0.1 });
    const haloMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.3, metalness: 0.8 });

    // ── Chassis ──────────────────────────────────────────────────────────────
    const noseGeo = new THREE.ConeGeometry(0.55, 3.8, 16);
    noseGeo.rotateZ(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(2.2, 0.55, 0);
    nose.scale.set(1, 0.6, 0.9);
    nose.castShadow = true;
    carGroup.add(nose);

    const monocoque = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 1.25), bodyMat);
    monocoque.position.set(-0.5, 0.65, 0);
    monocoque.castShadow = true;
    carGroup.add(monocoque);

    const engineCoverGeo = new THREE.ConeGeometry(0.7, 3.2, 16);
    engineCoverGeo.rotateZ(-Math.PI / 2);
    const engineCover = new THREE.Mesh(engineCoverGeo, bodyMat);
    engineCover.position.set(-1.8, 1.05, 0);
    engineCover.scale.set(1, 0.8, 0.6);
    engineCover.castShadow = true;
    carGroup.add(engineCover);

    const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.05), accentMat);
    sharkFin.position.set(-2.0, 1.35, 0);
    carGroup.add(sharkFin);

    const haloGeo = new THREE.TorusGeometry(0.5, 0.06, 12, 24, Math.PI);
    haloGeo.rotateX(Math.PI / 2);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0.1, 1.15, 0);
    carGroup.add(halo);

    const podGeo = new THREE.BoxGeometry(2.8, 0.6, 0.8);
    const leftPod = new THREE.Mesh(podGeo, bodyMat);
    leftPod.position.set(-0.6, 0.5, 0.95);
    leftPod.castShadow = true;
    carGroup.add(leftPod);

    const rightPod = new THREE.Mesh(podGeo, bodyMat);
    rightPod.position.set(-0.6, 0.5, -0.95);
    rightPod.castShadow = true;
    carGroup.add(rightPod);

    // ── Wings ────────────────────────────────────────────────────────────────
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 3.2), carbonMat);
    frontWing.position.set(3.6, 0.22, 0);
    frontWing.castShadow = true;
    carGroup.add(frontWing);

    const leftEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.05), accentMat);
    leftEndplate.position.set(3.6, 0.35, 1.6);
    carGroup.add(leftEndplate);

    const rightEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.05), accentMat);
    rightEndplate.position.set(3.6, 0.35, -1.6);
    carGroup.add(rightEndplate);

    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), carbonMat);
    pillarL.position.set(-3.2, 0.85, 0.3);
    carGroup.add(pillarL);

    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), carbonMat);
    pillarR.position.set(-3.2, 0.85, -0.3);
    carGroup.add(pillarR);

    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 2.2), carbonMat);
    rearWing.position.set(-3.2, 1.45, 0);
    carGroup.add(rearWing);

    const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 2.15), accentMat);
    drsFlap.position.set(-3.35, 1.6, 0);
    carGroup.add(drsFlap);

    // ── Wheels ───────────────────────────────────────────────────────────────
    const wheelPositions = [
      { x: 2.5, y: 0.48, z: 1.4 },
      { x: 2.5, y: 0.48, z: -1.4 },
      { x: -2.3, y: 0.52, z: 1.45 },
      { x: -2.3, y: 0.52, z: -1.45 },
    ];

    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Group();
      wheel.position.set(pos.x, pos.y, pos.z);

      const tyreGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.45, 24);
      tyreGeo.rotateX(Math.PI / 2);
      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.castShadow = true;
      wheel.add(tyre);

      const ringGeo = new THREE.RingGeometry(0.36, 0.42, 24);
      ringGeo.rotateY(Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xff2a1f, side: THREE.DoubleSide })
      );
      ring.position.set(0, 0, pos.z > 0 ? 0.23 : -0.23);
      wheel.add(ring);

      carGroup.add(wheel);
    });

    // ── Airflow particles ────────────────────────────────────────────────────
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.2) * 14;
      positions[i * 3 + 1] = Math.random() * 2.2 + 0.1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4.0;
      velocities[i] = 0.15 + Math.random() * 0.15;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0x00e5ff,
        size: 0.08,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(particles);

    // ── Orbit ────────────────────────────────────────────────────────────────
    let dragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0.6;
    let rotX = 0.3;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      rotY += (e.clientX - prevX) * 0.008;
      rotX = Math.max(0.05, Math.min(Math.PI / 2.2, rotX + (e.clientY - prevY) * 0.008));
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
    let reqId = 0;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (autoRotateRef.current && !dragging) rotY += 0.004;

      const radius = 18;
      camera.position.set(
        radius * Math.sin(rotY) * Math.cos(rotX),
        radius * Math.sin(rotX),
        radius * Math.cos(rotY) * Math.cos(rotX)
      );
      camera.lookAt(0, 0.8, 0);

      drsFlap.rotation.z = THREE.MathUtils.lerp(
        drsFlap.rotation.z,
        drsOpenRef.current ? -0.45 : 0,
        0.15
      );

      particles.visible = windTunnelRef.current;
      if (windTunnelRef.current) {
        const pos = particles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          pos[i * 3] -= velocities[i];
          if (pos[i * 3] < -7) {
            pos[i * 3] = 7;
            pos[i * 3 + 1] = Math.random() * 2.2 + 0.1;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 4.0;
          }
        }
        particles.geometry.attributes.position.needsUpdate = true;
      }

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
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []);

  // Livery and x-ray are pushed straight onto the materials, so neither rebuilds the scene.
  useEffect(() => {
    const body = bodyMaterialRef.current;
    const accent = accentMaterialRef.current;
    if (body) {
      body.color.set(new THREE.Color(bodyColor));
      body.wireframe = xrayMode;
    }
    if (accent) {
      accent.color.set(new THREE.Color(accentColor));
      accent.wireframe = xrayMode;
    }
  }, [bodyColor, accentColor, xrayMode]);

  const toggleDrs = () => {
    setDrsOpen((open) => !open);
    playDrsBeep();
  };

  return (
    <div className="w-full bg-gradient-to-b from-[#14151b] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 live-pulse" />
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
              3D AERO &amp; LIVERY INSPECTOR · 2026 GROUND EFFECT
            </h3>
          </div>
          <p className="text-xs text-zinc-400 f-mono truncate">
            {selected
              ? `${selected.name} ${selected.carName ?? ""} · ${selected.engineSupplier ?? "engine n/a"} power unit`
              : loading
                ? "Loading team liveries…"
                : "No team data"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setWindTunnel((v) => !v)}
            className={`px-3 py-1.5 text-xs font-bold f-orbitron uppercase rounded-xl border transition-all ${
              windTunnel
                ? "bg-cyan-950/80 text-cyan-400 border-cyan-500/50 shadow-[0_0_12px_rgba(0,229,255,0.3)]"
                : "bg-black/40 text-zinc-500 border-zinc-800 hover:text-zinc-300"
            }`}
          >
            💨 AIRFLOW {windTunnel ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setXrayMode((v) => !v)}
            className={`px-3 py-1.5 text-xs font-bold f-orbitron uppercase rounded-xl border transition-all ${
              xrayMode
                ? "bg-purple-950/80 text-purple-400 border-purple-500/50 shadow-[0_0_12px_rgba(156,39,176,0.3)]"
                : "bg-black/40 text-zinc-500 border-zinc-800 hover:text-zinc-300"
            }`}
          >
            🧬 X-RAY {xrayMode ? "ON" : "OFF"}
          </button>

          <button
            onClick={toggleDrs}
            className={`px-3 py-1.5 text-xs font-black f-orbitron uppercase rounded-xl border transition-all ${
              drsOpen
                ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_#00E676]"
                : "bg-black/40 text-zinc-400 border-zinc-800 hover:text-white"
            }`}
          >
            DRS {drsOpen ? "OPEN" : "CLOSED"}
          </button>

          <button
            onClick={() => setAutoRotate((v) => !v)}
            className="p-1.5 bg-black/40 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white"
            title="Toggle auto rotation"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="relative w-full aspect-[16/9] max-h-[460px] rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-inner">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="f-mono text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Rulebook figures, labelled as such — the model is procedural, not a scanned car */}
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md p-3 rounded-xl border border-zinc-800 text-[11px] f-mono pointer-events-none space-y-1">
          <div className="text-zinc-500 font-bold uppercase">2026 FIA TECHNICAL LIMITS</div>
          <div className="text-white font-bold">
            DOWNFORCE:{" "}
            <span className="text-cyan-400">
              ~{REGULATION_SPEC.downforceKg.toLocaleString()} KG @ {REGULATION_SPEC.downforceAtKmh} KM/H
            </span>
          </div>
          <div className="text-white font-bold">
            DRAG:{" "}
            <span className="text-amber-400">
              {drsOpen ? `${REGULATION_SPEC.dragOpen} Cd (DRS)` : `${REGULATION_SPEC.dragClosed} Cd`}
            </span>
          </div>
          <div className="text-white font-bold">
            MIN WEIGHT: <span className="text-emerald-400">{REGULATION_SPEC.minWeightKg} KG</span>
          </div>
        </div>

        {/* Team facts, straight from the team record */}
        {selected && (
          <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md p-3 rounded-xl border border-zinc-800 text-[11px] f-mono pointer-events-none space-y-1 max-w-[52%]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ background: bodyColor }} />
              <span className="w-3 h-3 rounded-sm" style={{ background: accentColor }} />
              <span className="text-zinc-500 font-bold uppercase truncate">{selected.name}</span>
            </div>
            <div className="text-zinc-300">
              BASE: <span className="text-white">{selected.base ?? "—"}</span>
            </div>
            <div className="text-zinc-300">
              TITLES: <span className="text-amber-400">{selected.championships}</span>
              {selected.foundedYear > 0 && <span className="text-zinc-600"> · EST {selected.foundedYear}</span>}
            </div>
            {selected.drivers.length > 0 && (
              <div className="text-zinc-300 truncate">
                LINE-UP:{" "}
                <span className="text-white">
                  {selected.drivers.map((d) => `#${d.carNumber} ${d.name.split(" ").pop()}`).join("  ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Every team in the championship, not a hand-picked seven */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[10px] font-bold f-mono text-zinc-500 uppercase tracking-widest shrink-0">
          LIVERY:
        </span>
        {liveries.map((team) => {
          const color = getTeamColor(team.name, team.colorHex);
          return (
            <button
              key={team.id}
              onClick={() => {
                playUiClick();
                setPickedTeamName(team.name);
              }}
              className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold f-cond uppercase ${
                selected?.name === team.name
                  ? "bg-zinc-800 border-zinc-400 text-white shadow-lg"
                  : "bg-black/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span className="flex">
                <span
                  className="w-3 h-3 rounded-l-full border border-black/50"
                  style={{ background: color }}
                />
                <span
                  className="w-3 h-3 rounded-r-full border border-black/50"
                  style={{ background: team.accentHex || color }}
                />
              </span>
              <span>{team.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
