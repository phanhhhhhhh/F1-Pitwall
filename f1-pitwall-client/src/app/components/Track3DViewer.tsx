"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { playUiClick } from "../lib/f1-sound";

interface TrackProfile {
  name: string;
  country: string;
  elevGain: string;
  points: THREE.Vector3[];
}

export default function Track3DViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const trackMeshRef = useRef<THREE.Mesh | null>(null);
  const carMeshRef = useRef<THREE.Mesh | null>(null);

  const TRACKS: TrackProfile[] = [
    {
      name: "Circuit de Spa-Francorchamps (Eau Rouge & Raidillon)",
      country: "Belgium",
      elevGain: "102.4 Meters Elevation Delta",
      points: [
        new THREE.Vector3(-8, 0, 0),
        new THREE.Vector3(-4, 0.2, 2),
        new THREE.Vector3(-1, 0.5, 4),
        new THREE.Vector3(2, 3.5, 2),   // Eau Rouge Climb
        new THREE.Vector3(5, 5.0, -1),  // Raidillon Crest
        new THREE.Vector3(7, 4.8, -4),  // Kemmel Straight
        new THREE.Vector3(4, 3.2, -6),
        new THREE.Vector3(-2, 1.5, -5),
        new THREE.Vector3(-6, 0.5, -3),
        new THREE.Vector3(-8, 0, 0),
      ],
    },
    {
      name: "Autodromo Nazionale Monza (Curva Parabolica)",
      country: "Italy",
      elevGain: "18.2 Meters Elevation Delta",
      points: [
        new THREE.Vector3(-8, 0, 0),
        new THREE.Vector3(-3, 0.2, 5),
        new THREE.Vector3(2, 0.4, 5),
        new THREE.Vector3(6, 0.8, 2),
        new THREE.Vector3(8, 0.5, -2),
        new THREE.Vector3(4, 0.1, -6),
        new THREE.Vector3(-2, 0, -6),
        new THREE.Vector3(-7, 0, -3),
        new THREE.Vector3(-8, 0, 0),
      ],
    },
  ];

  const currentTrack = TRACKS[selectedTrackIndex] || TRACKS[0];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0b0e);
    scene.fog = new THREE.FogExp2(0x0a0b0e, 0.04);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(12, 14, 16);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 3. Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const redRim = new THREE.PointLight(0xe10600, 3, 20);
    redRim.position.set(-5, 6, -5);
    scene.add(redRim);

    // 4. Ground Grid
    const grid = new THREE.GridHelper(30, 30, 0xe10600, 0x1f242e);
    grid.position.y = -0.05;
    scene.add(grid);

    // 5. 3D Track Spline & Tube Ribbon
    const curve = new THREE.CatmullRomCurve3(currentTrack.points);
    curve.closed = true;

    const tubeGeo = new THREE.TubeGeometry(curve, 100, 0.35, 12, true);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x1c1d24,
      roughness: 0.5,
      metalness: 0.6,
    });
    const trackMesh = new THREE.Mesh(tubeGeo, tubeMat);
    trackMeshRef.current = trackMesh;
    scene.add(trackMesh);

    // 6. Glowing Red Racing Guide Line
    const lineGeo = new THREE.TubeGeometry(curve, 100, 0.06, 8, true);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe10600 });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    scene.add(lineMesh);

    // 7. 3D Animated Car Box
    const carGeo = new THREE.BoxGeometry(0.7, 0.25, 0.4);
    const carMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x0088cc,
      emissiveIntensity: 0.6,
    });
    const carMesh = new THREE.Mesh(carGeo, carMat);
    carMeshRef.current = carMesh;
    scene.add(carMesh);

    // 8. Mouse Orbit Drag
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0.5;
    let rotX = 0.5;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevX;
      const deltaY = e.clientY - prevY;
      rotY += deltaX * 0.008;
      rotX = Math.max(0.1, Math.min(Math.PI / 2.1, rotX + deltaY * 0.008));
      prevX = e.clientX;
      prevY = e.clientY;
    };
    const onMouseUp = () => (isDragging = false);

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // 9. Animation Loop
    let progress = 0;
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (!isDragging) {
        rotY += 0.003;
      }

      const radius = 22;
      camera.position.x = radius * Math.sin(rotY) * Math.cos(rotX);
      camera.position.y = radius * Math.sin(rotX);
      camera.position.z = radius * Math.cos(rotY) * Math.cos(rotX);
      camera.lookAt(0, 1.5, 0);

      // Advance car along 3D track
      progress = (progress + 0.003) % 1;
      const pt = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(progress);

      carMesh.position.copy(pt);
      carMesh.position.y += 0.25;
      carMesh.lookAt(pt.clone().add(tangent));

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
  }, [selectedTrackIndex]);

  return (
    <div className="w-full bg-gradient-to-b from-[#14151b] to-[#0a0a0d] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 live-pulse" />
            <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
              3D CIRCUIT ELEVATION &amp; HORIZON TRAJECTORY
            </h3>
          </div>
          <p className="text-xs text-zinc-400 f-mono">{currentTrack.elevGain} · True 3D Spline Altitude</p>
        </div>

        {/* Track Switcher */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl border border-zinc-800">
          {TRACKS.map((t, idx) => (
            <button
              key={t.name}
              onClick={() => {
                playUiClick();
                setSelectedTrackIndex(idx);
              }}
              className={`px-3 py-1.5 text-xs font-bold f-cond uppercase rounded-lg transition-all ${
                selectedTrackIndex === idx
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.name.split(" ")[0]} 3D
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full aspect-[16/9] max-h-[400px] rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-inner">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] f-mono text-zinc-400">
          DRAG TO ORBIT 360° · REAL-TIME ALTITUDE SPLINE
        </div>
      </div>
    </div>
  );
}
