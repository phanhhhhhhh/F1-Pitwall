"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playUiClick, playDrsBeep } from "../lib/f1-sound";

interface F1CarInspector3DProps {
  initialTeam?: string;
}

const TEAMS_LIVERY = [
  { name: "Ferrari", color: "#E8002D", accent: "#FFD200", num: "16" },
  { name: "McLaren", color: "#FF8000", accent: "#00E5FF", num: "4" },
  { name: "Red Bull Racing", color: "#162846", accent: "#E10600", num: "1" },
  { name: "Mercedes-AMG", color: "#27F4D2", accent: "#C0C0C0", num: "63" },
  { name: "Aston Martin", color: "#00594F", accent: "#00FF66", num: "14" },
  { name: "Audi F1 Team", color: "#C3002F", accent: "#EDEDED", num: "27" },
  { name: "Cadillac F1", color: "#990000", accent: "#FFD200", num: "99" },
];

export default function F1CarInspector3D({ initialTeam = "Ferrari" }: F1CarInspector3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTeam, setSelectedTeam] = useState(initialTeam);
  const [windTunnel, setWindTunnel] = useState(true);
  const [xrayMode, setXrayMode] = useState(false);
  const [drsOpen, setDrsOpen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const drsFlapRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const liveryMaterialsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);

  const currentLivery = TEAMS_LIVERY.find((t) => t.name === selectedTeam) || TEAMS_LIVERY[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0b0e);
    scene.fog = new THREE.FogExp2(0x0a0b0e, 0.035);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(12, 6, 16);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lighting (Studio Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(15, 20, 15);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.8);
    rimLight.position.set(-15, 10, -15);
    scene.add(rimLight);

    const redUnderglow = new THREE.PointLight(0xe10600, 2.5, 15);
    redUnderglow.position.set(0, 0.2, 0);
    scene.add(redUnderglow);

    // 4. Ground Grid Mirror
    const gridHelper = new THREE.GridHelper(30, 30, 0xe10600, 0x1f242e);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 5. Build 3D F1 Car Geometry (Procedural)
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    // Materials
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(currentLivery.color),
      roughness: 0.25,
      metalness: 0.7,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    });
    liveryMaterialsRef.current = [bodyMat];

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111113,
      roughness: 0.4,
      metalness: 0.9,
    });

    const tyreMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.9,
      metalness: 0.1,
    });

    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1f,
      roughness: 0.3,
      metalness: 0.8,
    });

    // ── Main Chassis Body (Nose to Engine Cover) ──
    const noseGeo = new THREE.ConeGeometry(0.55, 3.8, 16);
    noseGeo.rotateZ(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.position.set(2.2, 0.55, 0);
    nose.scale.set(1, 0.6, 0.9);
    nose.castShadow = true;
    carGroup.add(nose);

    // Cockpit & Monocoque
    const monocoqueGeo = new THREE.BoxGeometry(3.6, 0.85, 1.25);
    const monocoque = new THREE.Mesh(monocoqueGeo, bodyMat);
    monocoque.position.set(-0.5, 0.65, 0);
    monocoque.castShadow = true;
    carGroup.add(monocoque);

    // Engine Airbox & Sharkfin
    const engineCoverGeo = new THREE.ConeGeometry(0.7, 3.2, 16);
    engineCoverGeo.rotateZ(-Math.PI / 2);
    const engineCover = new THREE.Mesh(engineCoverGeo, bodyMat);
    engineCover.position.set(-1.8, 1.05, 0);
    engineCover.scale.set(1, 0.8, 0.6);
    engineCover.castShadow = true;
    carGroup.add(engineCover);

    const sharkFinGeo = new THREE.BoxGeometry(2.0, 0.6, 0.05);
    const sharkFin = new THREE.Mesh(sharkFinGeo, carbonMat);
    sharkFin.position.set(-2.0, 1.35, 0);
    carGroup.add(sharkFin);

    // ── Halo Cockpit Protection Ring ──
    const haloGeo = new THREE.TorusGeometry(0.5, 0.06, 12, 24, Math.PI);
    haloGeo.rotateX(Math.PI / 2);
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0.1, 1.15, 0);
    carGroup.add(halo);

    // ── Sidepods (Left & Right) with Venturi Inlets ──
    const podGeo = new THREE.BoxGeometry(2.8, 0.6, 0.8);
    const leftPod = new THREE.Mesh(podGeo, bodyMat);
    leftPod.position.set(-0.6, 0.5, 0.95);
    leftPod.castShadow = true;
    carGroup.add(leftPod);

    const rightPod = new THREE.Mesh(podGeo, bodyMat);
    rightPod.position.set(-0.6, 0.5, -0.95);
    rightPod.castShadow = true;
    carGroup.add(rightPod);

    // ── Front Wing & Endplates ──
    const frontWingMain = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 3.2), carbonMat);
    frontWingMain.position.set(3.6, 0.22, 0);
    frontWingMain.castShadow = true;
    carGroup.add(frontWingMain);

    const leftEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.05), bodyMat);
    leftEndplate.position.set(3.6, 0.35, 1.6);
    carGroup.add(leftEndplate);

    const rightEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.05), bodyMat);
    rightEndplate.position.set(3.6, 0.35, -1.6);
    carGroup.add(rightEndplate);

    // ── Rear Wing & DRS Actuator ──
    const rearWingPillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), carbonMat);
    rearWingPillarL.position.set(-3.2, 0.85, 0.3);
    carGroup.add(rearWingPillarL);

    const rearWingPillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), carbonMat);
    rearWingPillarR.position.set(-3.2, 0.85, -0.3);
    carGroup.add(rearWingPillarR);

    const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.06, 2.2), carbonMat);
    rearWingMain.position.set(-3.2, 1.45, 0);
    carGroup.add(rearWingMain);

    // DRS Upper Flap
    const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 2.15), bodyMat);
    drsFlap.position.set(-3.35, 1.6, 0);
    drsFlapRef.current = drsFlap;
    carGroup.add(drsFlap);

    // ── 4 Wheels (18" Pirelli Low Profile) ──
    const wheelPositions = [
      { x: 2.5, y: 0.48, z: 1.4 },  // Front Left
      { x: 2.5, y: 0.48, z: -1.4 }, // Front Right
      { x: -2.3, y: 0.52, z: 1.45 }, // Rear Left
      { x: -2.3, y: 0.52, z: -1.45 },// Rear Right
    ];

    wheelPositions.forEach((pos) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(pos.x, pos.y, pos.z);

      const tyreGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.45, 24);
      tyreGeo.rotateX(Math.PI / 2);
      const tyreMesh = new THREE.Mesh(tyreGeo, tyreMat);
      tyreMesh.castShadow = true;
      wheelGroup.add(tyreMesh);

      // Coloured Pirelli Red Soft Tyre Ring
      const ringGeo = new THREE.RingGeometry(0.36, 0.42, 24);
      ringGeo.rotateY(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a1f, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, 0, pos.z > 0 ? 0.23 : -0.23);
      wheelGroup.add(ring);

      carGroup.add(wheelGroup);
    });

    // 6. 3D Particle Wind Tunnel Streamlines
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
    const particleMat = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    particlesRef.current = particles;
    scene.add(particles);

    // 7. Mouse Orbit Drag Handling
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotY = 0.6;
    let rotX = 0.3;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      rotY += deltaX * 0.008;
      rotX = Math.max(0.05, Math.min(Math.PI / 2.2, rotX + deltaY * 0.008));
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // 8. Animation Loop
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        rotY += 0.004;
      }

      // Camera Orbit Spherical Positioning
      const radius = 18;
      camera.position.x = radius * Math.sin(rotY) * Math.cos(rotX);
      camera.position.y = radius * Math.sin(rotX);
      camera.position.z = radius * Math.cos(rotY) * Math.cos(rotX);
      camera.lookAt(0, 0.8, 0);

      // DRS Flap animation
      if (drsFlapRef.current) {
        const targetRotX = drsOpen ? -0.45 : 0;
        drsFlapRef.current.rotation.z = THREE.MathUtils.lerp(
          drsFlapRef.current.rotation.z,
          targetRotX,
          0.15
        );
      }

      // Wind tunnel particle flow
      if (particlesRef.current) {
        particlesRef.current.visible = windTunnel;
        if (windTunnel) {
          const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < particleCount; i++) {
            pos[i * 3] -= velocities[i];
            if (pos[i * 3] < -7) {
              pos[i * 3] = 7;
              pos[i * 3 + 1] = Math.random() * 2.2 + 0.1;
              pos[i * 3 + 2] = (Math.random() - 0.5) * 4.0;
            }
          }
          particlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
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
  }, [autoRotate, drsOpen, windTunnel]);

  // Update livery color dynamically
  useEffect(() => {
    liveryMaterialsRef.current.forEach((mat) => {
      mat.color.set(new THREE.Color(currentLivery.color));
      mat.wireframe = xrayMode;
    });
  }, [selectedTeam, xrayMode, currentLivery]);

  const toggleDrs = () => {
    const next = !drsOpen;
    setDrsOpen(next);
    playDrsBeep();
  };

  const selectTeam = (teamName: string) => {
    playUiClick();
    setSelectedTeam(teamName);
  };

  return (
    <div className="w-full bg-gradient-to-b from-[#14151b] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 mb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 live-pulse" />
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
              3D AERO WIND TUNNEL & LIVERY INSPECTOR (2026 GROUND EFFECT)
            </h3>
          </div>
          <p className="text-xs text-zinc-400 f-mono">
            Drag to rotate 360° · Real-time CFD Aerodynamic Flow Particles · FIA Technical Regulations
          </p>
        </div>

        {/* 3D View Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setWindTunnel(!windTunnel)}
            className={`px-3 py-1.5 text-xs font-bold f-orbitron uppercase rounded-xl border transition-all ${
              windTunnel
                ? "bg-cyan-950/80 text-cyan-400 border-cyan-500/50 shadow-[0_0_12px_rgba(0,229,255,0.3)]"
                : "bg-black/40 text-zinc-500 border-zinc-800 hover:text-zinc-300"
            }`}
          >
            💨 CFD AERO {windTunnel ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => setXrayMode(!xrayMode)}
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
            DRS {drsOpen ? "OPEN (ACTIVE)" : "CLOSED"}
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className="p-1.5 bg-black/40 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white"
            title="Toggle Auto Rotation"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div className="relative w-full aspect-[16/9] max-h-[460px] rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-inner">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Spec HUD */}
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md p-3 rounded-xl border border-zinc-800 text-[11px] f-mono pointer-events-none space-y-1">
          <div className="text-zinc-500 font-bold uppercase">AERODYNAMIC TELEMETRY</div>
          <div className="text-white font-bold">
            DOWNFORCE: <span className="text-cyan-400">2,140 KG @ 250 KM/H</span>
          </div>
          <div className="text-white font-bold">
            DRAG COEFFICIENT: <span className="text-amber-400">{drsOpen ? "0.72 Cd (DRS)" : "1.08 Cd"}</span>
          </div>
          <div className="text-white font-bold">
            MIN WEIGHT: <span className="text-emerald-400">768 KG (2026 SPEC)</span>
          </div>
        </div>
      </div>

      {/* Team Livery Selector Palette */}
      <div className="mt-4 flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <span className="text-[10px] font-bold f-mono text-zinc-500 uppercase tracking-widest shrink-0">
          SELECT LIVERY:
        </span>
        <div className="flex items-center gap-2">
          {TEAMS_LIVERY.map((team) => (
            <button
              key={team.name}
              onClick={() => selectTeam(team.name)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold f-cond uppercase ${
                selectedTeam === team.name
                  ? "bg-zinc-800 border-zinc-400 text-white shadow-lg"
                  : "bg-black/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span
                className="w-3 h-3 rounded-full border border-black/50"
                style={{ background: team.color }}
              />
              <span>{team.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
