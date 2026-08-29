"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getDriverSkill } from "../lib/f1-theme";
import { playUiClick } from "../lib/f1-sound";

interface DriverHelmet {
  name: string;
  number: number;
  team: string;
  color: string;
  titles: number;
}

const DRIVERS_LIST: DriverHelmet[] = [
  { name: "Max Verstappen", number: 1, team: "Red Bull Racing", color: "#3671C6", titles: 4 },
  { name: "Lewis Hamilton", number: 44, team: "Ferrari", color: "#E8002D", titles: 7 },
  { name: "Charles Leclerc", number: 16, team: "Ferrari", color: "#E8002D", titles: 0 },
  { name: "Lando Norris", number: 4, team: "McLaren", color: "#FF8000", titles: 0 },
  { name: "Fernando Alonso", number: 14, team: "Aston Martin", color: "#358C75", titles: 2 },
];

export default function HologramHelmet3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverHelmet>(DRIVERS_LIST[0]);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const helmetGroupRef = useRef<THREE.Group | null>(null);
  const shellMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const hudRingRef = useRef<THREE.Mesh | null>(null);

  const skill = getDriverSkill(selectedDriver.name);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0b0e);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0.5, 6.5);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
    mainLight.position.set(5, 8, 5);
    scene.add(mainLight);

    const cyanRim = new THREE.PointLight(0x00e5ff, 3, 10);
    cyanRim.position.set(-4, 2, -3);
    scene.add(cyanRim);

    // 4. Procedural 3D Racing Helmet
    const helmetGroup = new THREE.Group();
    helmetGroupRef.current = helmetGroup;
    scene.add(helmetGroup);

    // Outer Shell (Sphere with flattened bottom)
    const shellGeo = new THREE.SphereGeometry(1.6, 32, 24);
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(selectedDriver.color),
      roughness: 0.15,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    shellMatRef.current = shellMat;
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.position.set(0, 0, 0);
    shell.scale.set(1, 1.15, 1.1);
    helmetGroup.add(shell);

    // Chin Bar / Mouth Guard
    const chinGeo = new THREE.BoxGeometry(1.8, 0.8, 1.2);
    const chin = new THREE.Mesh(chinGeo, shellMat);
    chin.position.set(0, -0.6, 0.8);
    helmetGroup.add(chin);

    // Tinted Visor (Iridium sheen)
    const visorGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.7, 24, 1, true, -Math.PI / 2.8, Math.PI / 1.4);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x111115,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.9,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.1, 0.6);
    helmetGroup.add(visor);

    // Holographic Telemetry HUD Projection Ring
    const hudRingGeo = new THREE.TorusGeometry(2.3, 0.02, 16, 48);
    const hudRingMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });
    const hudRing = new THREE.Mesh(hudRingGeo, hudRingMat);
    hudRing.position.set(0, 0, 0);
    hudRingRef.current = hudRing;
    helmetGroup.add(hudRing);

    // 5. Mouse Drag Controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0;
    let rotX = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevX;
      const deltaY = e.clientY - prevY;
      rotY += deltaX * 0.01;
      rotX += deltaY * 0.01;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMouseUp = () => (isDragging = false);

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // 6. Animation Loop
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (!isDragging) {
        rotY += 0.008;
      }

      helmetGroup.rotation.y = rotY;
      helmetGroup.rotation.x = Math.sin(Date.now() / 1500) * 0.05 + rotX * 0.3;

      if (hudRingRef.current) {
        hudRingRef.current.rotation.z += 0.015;
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(reqId);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update helmet shell color on driver change
  useEffect(() => {
    if (shellMatRef.current) {
      shellMatRef.current.color.set(new THREE.Color(selectedDriver.color));
    }
  }, [selectedDriver]);

  return (
    <div className="w-full bg-gradient-to-b from-[#14151b] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 live-pulse" />
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
            3D HOLOGRAPHIC DRIVER HELMET & HUD TELEMETRY
          </h3>
        </div>
        <span className="text-xs font-mono text-zinc-500 font-bold">DRAG TO ROTATE 360°</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* 3D Canvas (col-span-7) */}
        <div className="lg:col-span-7 relative aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-800 bg-black/60 shadow-inner flex items-center justify-center">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] f-mono text-zinc-400">
            AERO SPOILER &amp; IRIDIUM VISOR SPEC
          </div>
        </div>

        {/* Driver Bio & Hologram Stats (col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-7 h-7 rounded-xl flex items-center justify-center font-black f-orbitron text-xs text-black"
                style={{ background: selectedDriver.color }}
              >
                #{selectedDriver.number}
              </span>
              <span className="text-xs f-mono font-bold text-zinc-400 uppercase">{selectedDriver.team}</span>
            </div>
            <h2 className="text-3xl font-black f-cond uppercase text-white tracking-tight">
              {selectedDriver.name}
            </h2>
            {selectedDriver.titles > 0 && (
              <span className="inline-block mt-1 f-orbitron text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                🏆 {selectedDriver.titles}X WORLD CHAMPION
              </span>
            )}
          </div>

          {/* Skill Bars */}
          <div className="p-3.5 rounded-2xl bg-black/50 border border-zinc-800 space-y-2 text-[11px] f-mono">
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>QUALIFYING PACE</span>
                <span className="font-bold text-emerald-400">{skill.pace} / 100</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${skill.pace}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>RACECRAFT &amp; DEFENCE</span>
                <span className="font-bold text-amber-400">{skill.racecraft} / 100</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${skill.racecraft}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>TYRE PRESERVATION</span>
                <span className="font-bold text-orange-400">{skill.tyreMgmt} / 100</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${skill.tyreMgmt}%` }} />
              </div>
            </div>
          </div>

          {/* Driver Switcher Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {DRIVERS_LIST.map((d) => (
              <button
                key={d.name}
                onClick={() => {
                  playUiClick();
                  setSelectedDriver(d);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold f-cond uppercase transition-all ${
                  selectedDriver.name === d.name
                    ? "bg-zinc-800 border-zinc-400 text-white shadow-md"
                    : "bg-black/40 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                #{d.number} {d.name.split(" ").pop()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
