"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Circuit {
  id: number;
  name: string;
  country: string;
  city: string;
  type: string;
  totalLaps: number;
  lengthKm: number;
  lapRecordSec: number;
  lapRecordHolder: string;
  turnCount: number;
}

const typeColor: Record<string, string> = {
  PERMANENT: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  STREET: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  OVAL: "text-purple-400 bg-purple-500/10 border-purple-500/30",
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
};

export default function CircuitsPage() {
  const router = useRouter();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/circuits`)
      .then((r) => r.json())
      .then(setCircuits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="mb-10">
          <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
            {circuits.length} Circuits Worldwide
          </p>
          <h1 className="text-4xl font-black tracking-tighter text-white">
            CIRCUIT <span className="text-red-500">DATABASE</span>
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            LOADING...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {circuits.map((circuit) => (
              <div
                key={circuit.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-600 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{circuit.name}</h2>
                    <p className="text-xs text-zinc-500 font-mono mt-1">
                      {circuit.city}, {circuit.country}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border font-mono ${typeColor[circuit.type] || "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>
                    {circuit.type}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 pt-4 border-t border-zinc-800">
                  <div className="text-center">
                    <p className="text-lg font-black text-white">{circuit.totalLaps}</p>
                    <p className="text-xs text-zinc-600">LAPS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-white">{circuit.lengthKm}</p>
                    <p className="text-xs text-zinc-600">KM</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-white">{circuit.turnCount}</p>
                    <p className="text-xs text-zinc-600">TURNS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-red-400">{formatTime(circuit.lapRecordSec)}</p>
                    <p className="text-xs text-zinc-600">RECORD</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 font-mono mt-3">
                  Record by {circuit.lapRecordHolder}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
