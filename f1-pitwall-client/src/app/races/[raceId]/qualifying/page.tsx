"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { authFetch, getAccessToken } from "../../../lib/pitwall-auth";
import Navbar from "../../../components/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface QualifyingResult {
    id: number; gridPosition: number; driverName: string; teamName: string; teamColor: string;
    carNumber: number; q1Time: string | null; q2Time: string | null; q3Time: string | null; bestTime: string | null;
    eliminatedQ1: boolean; eliminatedQ2: boolean;
    q1TimeRaw: number | null; q2TimeRaw: number | null; q3TimeRaw: number | null;
}

function TimeDelta({ time, best }: { time: number | null; best: number | null }) {
    if (!time || !best) return <span className="text-zinc-700 font-mono">—</span>;
    const delta = time - best;
    if (delta < 0.001) return <span className="text-white font-mono font-bold">{formatTime(time)}</span>;
    return <span className="text-zinc-400 font-mono">{formatTime(time)}<span className="text-zinc-600 text-xs ml-1">+{delta.toFixed(3)}</span></span>;
}

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    return `${m}:${(sec % 60).toFixed(3).padStart(6, "0")}`;
}

function safeBest(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null && isFinite(v));
    return valid.length > 0 ? Math.min(...valid) : null;
}

export default function QualifyingPage() {
    const router = useRouter();
    const params = useParams();
    const raceId = params?.raceId as string;

    const [results, setResults] = useState<QualifyingResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [resyncing, setResyncing] = useState(false);
    const [raceName, setRaceName] = useState("");
    const [hasData, setHasData] = useState(false);
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        if (!getAccessToken()) { router.push("/login"); return; }
        fetchData(); fetchRaceInfo();
    }, [raceId]);

    const fetchData = async () => {
        try {
            const res = await authFetch(`${API}/api/qualifying/race/${raceId}`);
            const data = await res.json();
            setResults(data); setHasData(data.length > 0);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchRaceInfo = async () => {
        try { const res = await authFetch(`${API}/api/races/${raceId}`); const d = await res.json(); setRaceName(d.name || ""); } catch { }
    };

    const handleSync = async () => {
        setSyncing(true);
        try { await authFetch(`${API}/api/qualifying/sync/race/${raceId}`, { method: "POST" }); await fetchData(); }
        catch (e) { console.error(e); }
        finally { setSyncing(false); }
    };

    const handleResync = async () => {
        if (!confirm("This will delete current qualifying data and re-fetch.\nContinue?")) return;
        setResyncing(true); setFeedback("");
        try {
            const res = await authFetch(`${API}/api/sync/race/${raceId}/qualifying`, { method: "POST" });
            const data = await res.json();
            if (data.success) { setFeedback("✓ Re-sync successful!"); await fetchData(); }
            else setFeedback("✗ " + (data.message || data.error || "Re-sync failed"));
        } catch { setFeedback("✗ Connection error"); }
        finally { setResyncing(false); setTimeout(() => setFeedback(""), 4000); }
    };

    const bestQ1 = safeBest(results.map(r => r.q1TimeRaw));
    const bestQ2 = safeBest(results.map(r => r.q2TimeRaw));
    const bestQ3 = safeBest(results.map(r => r.q3TimeRaw));

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
                <div className="absolute top-0 left-1/3 w-[400px] h-[300px] bg-yellow-500/3 rounded-full blur-[120px] glow-pulse" />
                <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
            </div>
            <Navbar />
            <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-end justify-between mb-8 flex-wrap gap-4 slide-up">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            <p className="text-yellow-500/60 font-mono text-xs tracking-[0.3em]">QUALIFYING · GRID POSITIONS</p>
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
                            STARTING<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">GRID</span>
                        </h1>
                        {raceName && <p className="text-zinc-400 mt-2 font-mono text-sm">{raceName}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        {feedback && (
                            <span className={`text-xs font-mono px-3 py-1.5 rounded-xl border ${feedback.startsWith("✓") ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-red-400 border-red-500/30 bg-red-500/10"}`}>{feedback}</span>
                        )}
                        {hasData && (
                            <button onClick={handleResync} disabled={resyncing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${resyncing ? "border-zinc-700 text-zinc-500" : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"}`}>
                                {resyncing ? (<><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />RE-SYNCING...</>) : "⚠️ RE-SYNC"}
                            </button>
                        )}
                        <button onClick={handleSync} disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${syncing ? "border-zinc-700 text-zinc-500" : "border-red-500/50 text-red-400 hover:bg-red-500/10"}`}>
                            {syncing ? (<><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />SYNCING...</>) : "↻ SYNC FROM OPENF1"}
                        </button>
                        <Link href={`/races/${raceId}/results`} className="text-xs border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 px-4 py-2 rounded-xl transition-all font-mono">RACE RESULTS →</Link>
                        <Link href="/races" className="text-xs border border-zinc-700 text-zinc-500 hover:text-white px-4 py-2 rounded-xl transition-all font-mono">← CALENDAR</Link>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 border-2 border-yellow-500/20 rounded-full" />
                            <div className="absolute inset-0 border-2 border-yellow-500 rounded-full border-t-transparent animate-spin" />
                        </div>
                        <p className="text-yellow-500/70 font-mono text-xs animate-pulse">LOADING QUALIFYING DATA...</p>
                    </div>
                ) : !hasData ? (
                    <div className="text-center py-24 border border-dashed border-zinc-800/50 rounded-2xl slide-up">
                        <p className="text-zinc-400 text-xl font-bold mb-2">No qualifying data yet</p>
                        <p className="text-zinc-600 text-sm font-mono mb-8">Click SYNC to fetch qualifying results from OpenF1</p>
                        <button onClick={handleSync} disabled={syncing}
                            className="px-8 py-3 rounded-xl font-black text-sm text-white"
                            style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.3)" }}>
                            {syncing ? "SYNCING..." : "🔄 SYNC QUALIFYING DATA"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Starting grid visual */}
                        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up">
                            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
                            <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
                                <p className="text-xs font-mono text-zinc-500 tracking-widest">STARTING GRID</p>
                                <div className="flex items-center gap-4">
                                    {[{ color: "#ef4444", label: "Q3" }, { color: "#eab308", label: "Q2" }, { color: "#52525b", label: "Q1" }].map(s => (
                                        <span key={s.label} className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
                                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                                            {s.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="p-5 space-y-2">
                                {Array.from({ length: Math.ceil(results.length / 2) }, (_, rowIdx) => {
                                    const left = results[rowIdx * 2];
                                    const right = results[rowIdx * 2 + 1];
                                    return (
                                        <div key={rowIdx} className="flex gap-3">
                                            {[left, right].map((driver, side) => {
                                                if (!driver) return <div key={side} className="flex-1" />;
                                                const seg = driver.q3Time ? "q3" : driver.q2Time ? "q2" : "q1";
                                                const segColor = seg === "q3" ? "#ef4444" : seg === "q2" ? "#eab308" : "#52525b";
                                                return (
                                                    <div key={driver.id} className="flex-1 flex items-center gap-3 bg-zinc-800/30 rounded-xl px-4 py-3 border border-zinc-700/30 hover:border-zinc-600/50 transition-all"
                                                        style={{ borderLeftColor: driver.teamColor, borderLeftWidth: 3 }}>
                                                        <span className="text-2xl font-black text-zinc-700 w-8 tabular-nums">{driver.gridPosition}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-white truncate">{driver.driverName.split(" ").pop()}</p>
                                                            <p className="text-xs font-mono truncate" style={{ color: driver.teamColor }}>{driver.teamName}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-mono text-white">{driver.bestTime || "—"}</p>
                                                            <div className="w-2 h-2 rounded-full ml-auto mt-1" style={{ backgroundColor: segColor, boxShadow: `0 0 4px ${segColor}` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Qualifying times table */}
                        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up" style={{ animationDelay: "100ms" }}>
                            <div className="px-6 py-4 border-b border-zinc-800/50">
                                <p className="text-xs font-mono text-zinc-500 tracking-widest">QUALIFYING TIMES</p>
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800/30">
                                        <th className="text-left px-5 py-3 text-xs font-mono text-zinc-600">P</th>
                                        <th className="text-left px-5 py-3 text-xs font-mono text-zinc-600">DRIVER</th>
                                        <th className="text-left px-5 py-3 text-xs font-mono text-zinc-600 hidden md:table-cell">TEAM</th>
                                        <th className="text-right px-5 py-3 text-xs font-mono text-red-400">Q3</th>
                                        <th className="text-right px-5 py-3 text-xs font-mono text-yellow-400">Q2</th>
                                        <th className="text-right px-5 py-3 text-xs font-mono text-zinc-500">Q1</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, i) => {
                                        const isQ3 = !!r.q3Time, isQ2 = !!r.q2Time && !r.q3Time;
                                        return (
                                            <>
                                                {i === 10 && (
                                                    <tr key="sep-q2"><td colSpan={6} className="px-5 py-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-px bg-yellow-500/20" />
                                                            <span className="text-xs text-yellow-500/50 font-mono">Eliminated after Q2</span>
                                                            <div className="flex-1 h-px bg-yellow-500/20" />
                                                        </div>
                                                    </td></tr>
                                                )}
                                                {i === 15 && (
                                                    <tr key="sep-q1"><td colSpan={6} className="px-5 py-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-px bg-zinc-700/30" />
                                                            <span className="text-xs text-zinc-600 font-mono">Eliminated after Q1</span>
                                                            <div className="flex-1 h-px bg-zinc-700/30" />
                                                        </div>
                                                    </td></tr>
                                                )}
                                                <tr key={r.id} className={`border-b border-zinc-800/20 last:border-0 hover:bg-zinc-800/20 transition-colors ${!isQ3 && !isQ2 ? "opacity-50" : ""}`}>
                                                    <td className="px-5 py-3">
                                                        <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-600"}`}>{r.gridPosition}</span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-0.5 h-8 rounded-full" style={{ backgroundColor: r.teamColor }} />
                                                            <div>
                                                                <p className="text-sm font-black text-white">{r.driverName}</p>
                                                                <p className="text-xs text-zinc-600 font-mono">#{r.carNumber}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 hidden md:table-cell">
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: r.teamColor, backgroundColor: `${r.teamColor}15` }}>{r.teamName}</span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right"><TimeDelta time={r.q3TimeRaw} best={bestQ3} /></td>
                                                    <td className="px-5 py-3 text-right"><TimeDelta time={r.q2TimeRaw} best={bestQ2} /></td>
                                                    <td className="px-5 py-3 text-right"><TimeDelta time={r.q1TimeRaw} best={bestQ1} /></td>
                                                </tr>
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}