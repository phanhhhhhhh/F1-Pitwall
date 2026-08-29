"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import Navbar from "../components/Navbar";
import { SkeletonCard } from "../components/LoadingSkeleton";
import { flagForCountry } from "../lib/f1-theme";
import type { CircuitInfo } from "../types/f1";

const Track3DViewer = dynamic(() => import("../components/Track3DViewer"), { ssr: false });

const typeConfig: Record<string, { color: string; label: string }> = {
  PERMANENT: { color: "#3B82F6", label: "PERMANENT TRACK" },
  STREET: { color: "#F97316", label: "STREET CIRCUIT" },
  OVAL: { color: "#A855F7", label: "OVAL TRACK" },
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return `${m}:${sec.padStart(6, "0")}`;
};

function TrackMotif({ type, color }: { type: string; color: string }) {
  const isPermanent = type === "PERMANENT";
  const isStreet = type === "STREET";

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        {isPermanent && (
          <>
            <ellipse cx="32" cy="32" rx="26" ry="18" stroke={color} strokeWidth="2.5" strokeOpacity="0.25" fill="none" />
            <path
              d="M10 32 Q14 14 32 10 Q50 6 54 22 Q58 36 44 44 Q32 50 20 46 Q8 42 10 32Z"
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.6"
              fill="none"
              strokeDasharray="4 2"
            />
            <circle cx="32" cy="32" r="3" fill={color} fillOpacity="0.8" />
          </>
        )}
        {isStreet && (
          <>
            <rect x="12" y="12" width="40" height="40" rx="3" stroke={color} strokeWidth="2" strokeOpacity="0.2" fill="none" />
            <path
              d="M16 16 L48 16 L48 30 L36 30 L36 48 L16 48 Z"
              stroke={color}
              strokeWidth="2.5"
              strokeOpacity="0.6"
              fill="none"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="16" r="2.5" fill={color} fillOpacity="0.8" />
          </>
        )}
        {!isPermanent && !isStreet && (
          <>
            <ellipse cx="32" cy="32" rx="26" ry="14" stroke={color} strokeWidth="2.5" strokeOpacity="0.6" fill="none" />
            <ellipse cx="32" cy="32" rx="18" ry="8" stroke={color} strokeWidth="1" strokeOpacity="0.2" fill="none" />
          </>
        )}
      </svg>
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 50%,${color}20,transparent 70%)` }}
      />
    </div>
  );
}

function CircuitCard({
  circuit,
  idx,
  onSelect,
}: {
  circuit: CircuitInfo;
  idx: number;
  onSelect: (c: CircuitInfo) => void;
}) {
  const [hov, setHov] = useState(false);
  const cfg = typeConfig[circuit.type] || { color: "#71717a", label: circuit.type };
  const col = cfg.color;
  const flag = flagForCountry(circuit.country);
  const raceDistanceKm = (circuit.totalLaps * circuit.lengthKm).toFixed(1);

  return (
    <div
      className="group relative rise cursor-pointer"
      style={{ animationDelay: `${idx * 40}ms` }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onSelect(circuit)}
    >
      <div
        className="absolute inset-0 rounded-3xl transition-opacity duration-500 pointer-events-none"
        style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 36px ${col}30` }}
      />
      <div
        className="relative border rounded-3xl overflow-hidden transition-all duration-300 bg-gradient-to-b from-zinc-900/90 to-black/95 p-5 shadow-xl"
        style={{
          borderColor: hov ? `${col}80` : "rgba(255,255,255,.08)",
          transform: hov ? "translateY(-5px)" : "none",
        }}
      >
        <div className="h-[3px] w-full absolute top-0 left-0 right-0" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{flag}</span>
              <span
                className="f-orbitron text-[10px] font-black px-2.5 py-0.5 rounded-lg border shadow-sm"
                style={{ color: col, borderColor: `${col}40`, background: `${col}15` }}
              >
                {cfg.label}
              </span>
            </div>
            <TrackMotif type={circuit.type} color={col} />
          </div>

          <div className="mb-4">
            <h2
              className="f-cond font-black text-2xl uppercase tracking-tight text-white transition-colors"
              style={{ color: hov ? col : "#fff" }}
            >
              {circuit.name}
            </h2>
            <p className="f-mono text-[11px] text-zinc-400 mt-1 font-semibold">
              {circuit.city}, {circuit.country}
            </p>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "LAPS", val: circuit.totalLaps },
              { label: "LENGTH", val: `${circuit.lengthKm} KM` },
              { label: "CORNERS", val: circuit.turnCount },
              { label: "DISTANCE", val: `${raceDistanceKm} KM` },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded-xl bg-black/40 border border-zinc-800">
                <p className="f-orbitron font-bold text-xs text-white tabular-nums">{s.val}</p>
                <p className="f-mono text-[8px] text-zinc-500 tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Lap Record Footer */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="f-mono text-[10px] text-zinc-500 tracking-widest uppercase">LAP RECORD</span>
            <span className="f-orbitron font-black text-xs text-amber-400">
              {formatTime(circuit.lapRecordSec)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CircuitsPage() {
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  useEffect(() => {
    authFetch(`${API}/api/circuits`)
      .then((r) => r.json())
      .then(setCircuits)
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load circuits.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = circuits.filter((c) => {
    const match =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase());
    return match && (filterType === "ALL" || c.type === filterType);
  });

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-[3px] bg-red-600 rounded-full shadow-[0_0_8px_#E10600]" />
              <span className="f-mono text-xs text-red-500 font-bold tracking-widest uppercase">
                GLOBAL CIRCUIT DIRECTORY
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black f-cond tracking-tight uppercase">
              FORMULA 1 <span className="text-red-600">CIRCUITS</span>
            </h1>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search circuit / country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-black/60 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-all flex-1 md:w-60"
            />

            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-zinc-800">
              {["ALL", "PERMANENT", "STREET", "OVAL"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 text-xs font-bold f-cond uppercase rounded-lg transition-all ${
                    filterType === t ? "bg-red-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 3D CIRCUIT ELEVATION VIEWER ── */}
        <section className="mb-8">
          <Track3DViewer circuits={circuits} />
        </section>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-950/40 border border-red-500/30 text-center">
            <p className="f-mono text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((circuit, idx) => (
              <CircuitCard
                key={circuit.id || circuit.name}
                circuit={circuit}
                idx={idx}
                onSelect={(c) => setSelectedCircuit(c)}
              />
            ))}
          </div>
        )}

        {/* Modal Circuit View */}
        <AnimatePresence>
          {selectedCircuit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCircuit(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-zinc-950 border border-zinc-700 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="f-mono text-xs text-red-500 font-bold">
                      {flagForCountry(selectedCircuit.country)} {selectedCircuit.country}
                    </span>
                    <h2 className="text-3xl font-black f-cond uppercase text-white mt-1">
                      {selectedCircuit.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedCircuit(null)}
                    className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 my-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">CIRCUIT LENGTH</span>
                    <p className="text-base font-black f-orbitron text-white">{selectedCircuit.lengthKm} KM</p>
                  </div>
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">TOTAL RACE LAPS</span>
                    <p className="text-base font-black f-orbitron text-white">{selectedCircuit.totalLaps} LAPS</p>
                  </div>
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">CORNER COUNT</span>
                    <p className="text-base font-black f-orbitron text-white">{selectedCircuit.turnCount} TURNS</p>
                  </div>
                  <div>
                    <span className="text-[10px] f-mono text-zinc-500">ALL-TIME LAP RECORD</span>
                    <p className="text-base font-black f-orbitron text-amber-400">
                      {formatTime(selectedCircuit.lapRecordSec)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCircuit(null)}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 font-black f-orbitron text-xs rounded-xl text-white transition-all uppercase tracking-wider"
                >
                  CLOSE CIRCUIT DETAILS
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
