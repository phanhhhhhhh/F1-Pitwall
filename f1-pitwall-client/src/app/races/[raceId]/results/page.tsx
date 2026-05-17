"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { authFetch, getAccessToken } from "../../../lib/pitwall-auth";
import Navbar from "../../../components/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Driver { id: number; name: string; carNumber: number; team: { name: string; colorHex: string }; }
interface ResultRow {
  driverId: number; driverName: string; teamName: string; teamColor: string;
  carNumber: number; startPosition: number; finishPosition: number;
  hasFastestLap: boolean; fastestLapTime: number; dnfReason: string;
}
interface RaceResultResponse {
  id: number; finishPosition: number; driverName: string; teamName: string;
  teamColor: string; points: number; hasFastestLap: boolean; dnfReason: string;
}

export default function RaceResultsPage() {
  const router = useRouter();
  const params = useParams();
  const raceId = params.raceId as string;

  const [race, setRace] = useState<any>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [existingResults, setExistingResults] = useState<RaceResultResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, [raceId]);

  const fetchData = async () => {
    try {
      const [raceRes, driversRes, resultsRes] = await Promise.all([
        authFetch(`${API}/api/races/${raceId}`),
        authFetch(`${API}/api/drivers`),
        authFetch(`${API}/api/race-results/race/${raceId}`),
      ]);
      const [raceData, driversData, resultsData] = await Promise.all([raceRes.json(), driversRes.json(), resultsRes.json()]);
      setRace(raceData); setDrivers(driversData); setExistingResults(resultsData);
      if (resultsData.length > 0) setMode("view");
      else { initRows(driversData); setMode("edit"); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const initRows = (d: Driver[]) => {
    const sorted = [...d].sort((a, b) => a.carNumber - b.carNumber);
    setRows(sorted.map((dr, i) => ({
      driverId: dr.id, driverName: dr.name, teamName: dr.team?.name || "", teamColor: dr.team?.colorHex || "#666",
      carNumber: dr.carNumber, startPosition: i + 1, finishPosition: i + 1, hasFastestLap: false, fastestLapTime: 0, dnfReason: "",
    })));
  };

  const updateRow = (index: number, field: keyof ResultRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "hasFastestLap" && value === true) next.forEach((r, i) => { if (i !== index) next[i] = { ...next[i], hasFastestLap: false }; });
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = rows.map(r => ({
        driverId: r.driverId, startPosition: r.startPosition, finishPosition: r.finishPosition,
        hasFastestLap: r.hasFastestLap, fastestLapTime: r.fastestLapTime, fastestLapNumber: 0, dnfReason: r.dnfReason || null,
      }));
      const res = await authFetch(`${API}/api/race-results/race/${raceId}`, { method: "POST", body: JSON.stringify(payload) });
      if (res.ok) { setExistingResults(await res.json()); setMode("view"); setSubmitted(true); }
      else alert("Failed to submit results.");
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleResync = async () => {
    if (!confirm("This will delete current results and re-fetch from OpenF1.\nContinue?")) return;
    setResyncing(true); setFeedback("");
    try {
      const res = await authFetch(`${API}/api/sync/race/${raceId}/results`, { method: "POST" });
      const data = await res.json();
      if (data.success) { setFeedback("✓ Re-sync successful!"); await fetchData(); }
      else setFeedback("✗ Re-sync failed: " + (data.error || "unknown error"));
    } catch { setFeedback("✗ Connection error"); }
    finally { setResyncing(false); setTimeout(() => setFeedback(""), 4000); }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950"><Navbar />
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
        </div>
        <p className="text-red-500/70 font-mono text-xs animate-pulse">LOADING...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes glow{0%,100%{opacity:.3}50%{opacity:.8}}
        .slide-up{animation:slideUp .4s ease-out both}
        .glow-pulse{animation:glow 3s ease-in-out infinite}
      `}</style>
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-red-500/4 rounded-full blur-[120px] glow-pulse" />
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>
      <Navbar />
      <main className="relative z-10 max-w-5xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 slide-up">
          <div>
            <Link href="/races" className="text-zinc-600 hover:text-red-400 text-xs font-mono mb-3 block transition-colors">← BACK TO RACES</Link>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-zinc-500 font-mono text-xs tracking-widest">Round {race?.roundNumber} · {race?.date}</p>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white leading-none">{race?.name}</h1>
            <p className="text-zinc-500 text-sm mt-1 font-mono">{race?.circuit?.name} · {race?.circuit?.country}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {feedback && (
              <span className={`text-xs font-mono px-3 py-1.5 rounded-xl border ${feedback.startsWith("✓") ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-red-400 border-red-500/30 bg-red-500/10"}`}>{feedback}</span>
            )}
            {mode === "view" && existingResults.length > 0 && (<>
              <button onClick={handleResync} disabled={resyncing}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${resyncing ? "border-zinc-700 text-zinc-500" : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"}`}>
                {resyncing ? (<><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />RE-SYNCING...</>) : "⚠️ RE-SYNC (PENALTY)"}
              </button>
              <button onClick={() => { setMode("edit"); initRows(drivers); }}
                className="text-xs border border-zinc-700 hover:border-red-500/50 text-zinc-500 hover:text-red-400 px-4 py-2 rounded-xl transition-all font-mono">
                EDIT RESULTS
              </button>
            </>)}
          </div>
        </div>

        {submitted && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3 slide-up">
            <span className="text-green-400 text-sm">✓ Results submitted — Championship standings updated automatically</span>
            <Link href="/standings" className="text-xs text-green-400 hover:text-green-300 font-mono ml-auto">VIEW STANDINGS →</Link>
          </div>
        )}

        {mode === "view" && existingResults.length > 0 ? (
          <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up">
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
              <h2 className="text-xs font-mono text-zinc-500 tracking-widest">RACE RESULTS</h2>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-lg font-mono font-bold">✓ COMPLETED</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/30">
                  {["POS", "DRIVER", "TEAM", "FL", "PTS"].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-mono text-zinc-600 ${i >= 2 ? "text-center" : i === 4 ? "text-right" : "text-left"} ${i === 2 ? "hidden md:table-cell" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {existingResults.map((r, idx) => (
                  <tr key={r.id} className="border-b border-zinc-800/20 last:border-0 hover:bg-zinc-800/20 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-lg font-black ${r.finishPosition === 1 ? "text-yellow-400" : r.finishPosition === 2 ? "text-zinc-300" : r.finishPosition === 3 ? "text-amber-600" : "text-zinc-600"}`}>
                        {r.dnfReason ? "DNF" : r.finishPosition}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-0.5 h-8 rounded-full" style={{ backgroundColor: r.teamColor }} />
                        <span className="text-sm font-black text-white">{r.driverName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: r.teamColor, backgroundColor: `${r.teamColor}15` }}>{r.teamName}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {r.hasFastestLap && <span className="text-xs text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 font-mono">FL ⚡</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-black text-white">{r.points}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="slide-up">
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden mb-5">
              <div className="px-6 py-4 border-b border-zinc-800/50">
                <h2 className="text-xs font-mono text-zinc-500 tracking-widest">INPUT RACE RESULTS</h2>
                <p className="text-xs text-zinc-600 mt-1">Set finish positions, mark DNFs, and select the fastest lap driver</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/30">
                      {["DRIVER", "START", "FINISH", "FL", "DNF REASON"].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-mono text-zinc-600 ${h === "DRIVER" ? "text-left" : "text-center"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.driverId} className="border-b border-zinc-800/20 last:border-0 hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-0.5 h-8 rounded-full" style={{ backgroundColor: row.teamColor }} />
                            <div><p className="text-sm font-black text-white">{row.driverName}</p><p className="text-xs font-mono" style={{ color: row.teamColor }}>#{row.carNumber}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="number" min="1" max="22" value={row.startPosition} onChange={e => updateRow(i, "startPosition", Number(e.target.value))}
                            className="w-14 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-red-500/50" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="number" min="1" max="22" value={row.finishPosition} onChange={e => updateRow(i, "finishPosition", Number(e.target.value))} disabled={!!row.dnfReason}
                            className="w-14 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-red-500/50 disabled:opacity-40" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="checkbox" checked={row.hasFastestLap} onChange={e => updateRow(i, "hasFastestLap", e.target.checked)} disabled={!!row.dnfReason}
                            className="w-4 h-4 accent-purple-500 cursor-pointer disabled:opacity-40" />
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="text" placeholder="e.g. Mechanical, Accident..." value={row.dnfReason} onChange={e => updateRow(i, "dnfReason", e.target.value)}
                            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder-zinc-700" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-600 font-mono">Points: 25-18-15-12-10-8-6-4-2-1 · +1 fastest lap (top 10)</p>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-8 py-3 rounded-xl font-black text-sm text-white transition-all disabled:bg-zinc-700"
                style={!submitting ? { background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.3)" } : {}}>
                {submitting ? "SUBMITTING..." : "SUBMIT RESULTS →"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}