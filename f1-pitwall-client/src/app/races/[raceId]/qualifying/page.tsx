"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { authFetch, getAccessToken } from "../../../lib/pitwall-auth";
import Navbar from "../../../components/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface QualifyingResult {
    id: number;
    gridPosition: number;
    driverName: string;
    teamName: string;
    teamColor: string;
    carNumber: number;
    q1Time: string | null;
    q2Time: string | null;
    q3Time: string | null;
    bestTime: string | null;
    eliminatedQ1: boolean;
    eliminatedQ2: boolean;
    q1TimeRaw: number | null;
    q2TimeRaw: number | null;
    q3TimeRaw: number | null;
}

function TimeDelta({ time, best }: { time: number | null; best: number | null }) {
    if (!time || !best) return <span className="text-zinc-700">—</span>;
    const delta = time - best;
    if (delta < 0.001) return <span className="text-white font-mono font-bold">{formatTime(time)}</span>;
    return (
        <span className="text-zinc-400 font-mono">
            {formatTime(time)}
            <span className="text-zinc-600 text-xs ml-1">+{delta.toFixed(3)}</span>
        </span>
    );
}

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(3).padStart(6, "0");
    return `${m}:${s}`;
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
        fetchData();
        fetchRaceInfo();
    }, [raceId]);

    const fetchData = async () => {
        try {
            const res = await authFetch(`${API}/api/qualifying/race/${raceId}`);
            const data = await res.json();
            setResults(data);
            setHasData(data.length > 0);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchRaceInfo = async () => {
        try {
            const res = await authFetch(`${API}/api/races/${raceId}`);
            const data = await res.json();
            setRaceName(data.name || "");
        } catch (e) { }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            await authFetch(`${API}/api/qualifying/sync/race/${raceId}`, { method: "POST" });
            await fetchData();
        } catch (e) { console.error(e); }
        finally { setSyncing(false); }
    };

    // Re-sync — xóa data cũ và fetch lại (dùng khi có penalty/disqualification)
    const handleResync = async () => {
        if (!confirm("Re-sync sẽ xóa qualifying data hiện tại và fetch lại.\nTiếp tục?")) return;
        setResyncing(true);
        setFeedback("");
        try {
            const res = await authFetch(`${API}/api/sync/race/${raceId}/qualifying`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setFeedback("✓ Re-sync thành công!");
                await fetchData();
            } else {
                setFeedback("✗ " + (data.message || data.error || "Re-sync thất bại"));
            }
        } catch (e) {
            setFeedback("✗ Lỗi kết nối");
        } finally {
            setResyncing(false);
            setTimeout(() => setFeedback(""), 4000);
        }
    };

    const bestQ1 = Math.min(...results.filter(r => r.q1TimeRaw).map(r => r.q1TimeRaw!));
    const bestQ2 = Math.min(...results.filter(r => r.q2TimeRaw).map(r => r.q2TimeRaw!));
    const bestQ3 = Math.min(...results.filter(r => r.q3TimeRaw).map(r => r.q3TimeRaw!));

    return (
        <div className="min-h-screen bg-zinc-950">
            <Navbar />
            <main className="max-w-7xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
                            Qualifying · Grid Positions
                        </p>
                        <h1 className="text-4xl font-black tracking-tighter text-white">
                            STARTING <span className="text-red-500">GRID</span>
                        </h1>
                        {raceName && <p className="text-zinc-400 mt-1">{raceName}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        {feedback && (
                            <span className={`text-xs font-mono px-3 py-1.5 rounded border ${
                                feedback.startsWith("✓") ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-red-400 border-red-500/30 bg-red-500/10"
                            }`}>{feedback}</span>
                        )}
                        {hasData && (
                            <button onClick={handleResync} disabled={resyncing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                                    resyncing ? "border-zinc-700 text-zinc-500" : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                                }`}>
                                {resyncing ? (
                                    <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />RE-SYNCING...</>
                                ) : "⚠️ RE-SYNC (PENALTY)"}
                            </button>
                        )}
                        <button onClick={handleSync} disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                                syncing ? "border-zinc-700 text-zinc-500" : "border-red-500/50 text-red-400 hover:bg-red-500/10"
                            }`}>
                            {syncing ? (
                                <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />SYNCING...</>
                            ) : "↻ SYNC FROM OPENF1"}
                        </button>
                        <Link href={`/races/${raceId}/results`}
                            className="text-xs border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 px-4 py-2 rounded-lg transition-all font-mono">
                            RACE RESULTS →
                        </Link>
                        <Link href="/races"
                            className="text-xs border border-zinc-700 text-zinc-500 hover:text-white px-4 py-2 rounded-lg transition-all font-mono">
                            ← CALENDAR
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full" /> LOADING...
                    </div>
                ) : !hasData ? (
                    <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl">
                        <p className="text-zinc-500 text-lg mb-2">No qualifying data yet</p>
                        <p className="text-zinc-700 text-sm font-mono mb-6">Click SYNC FROM OPENF1 to fetch qualifying results</p>
                        <button onClick={handleSync} disabled={syncing}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-lg text-sm transition-colors">
                            {syncing ? "SYNCING..." : "🔄 SYNC QUALIFYING DATA"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Starting grid visual */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                                <p className="text-xs font-mono text-zinc-500 tracking-widest">STARTING GRID</p>
                                <div className="flex items-center gap-4 text-xs text-zinc-600 font-mono">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Q3</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Q2</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />Q1</span>
                                </div>
                            </div>
                            <div className="p-6 space-y-2">
                                {Array.from({ length: Math.ceil(results.length / 2) }, (_, rowIdx) => {
                                    const left = results[rowIdx * 2];
                                    const right = results[rowIdx * 2 + 1];
                                    return (
                                        <div key={rowIdx} className="flex gap-3">
                                            {[left, right].map((driver, side) => {
                                                if (!driver) return <div key={side} className="flex-1" />;
                                                const segment = driver.q3Time ? "q3" : driver.q2Time ? "q2" : "q1";
                                                const segColor = segment === "q3" ? "#ef4444" : segment === "q2" ? "#eab308" : "#52525b";
                                                return (
                                                    <div key={driver.id} className="flex-1 flex items-center gap-3 bg-zinc-800/40 rounded-lg px-4 py-3 border border-zinc-800"
                                                        style={{ borderLeftColor: driver.teamColor, borderLeftWidth: 3 }}>
                                                        <span className="text-2xl font-black text-zinc-700 w-8">{driver.gridPosition}</span>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-white">{driver.driverName.split(" ").pop()}</p>
                                                            <p className="text-xs font-mono" style={{ color: driver.teamColor }}>{driver.teamName}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs font-mono text-white">{driver.bestTime || "—"}</p>
                                                            <div className="w-2 h-2 rounded-full ml-auto mt-1" style={{ backgroundColor: segColor }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Full qualifying table */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-zinc-800">
                                <p className="text-xs font-mono text-zinc-500 tracking-widest">QUALIFYING TIMES</p>
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="text-left px-4 py-3 text-xs font-mono text-zinc-600">P</th>
                                        <th className="text-left px-4 py-3 text-xs font-mono text-zinc-600">DRIVER</th>
                                        <th className="text-left px-4 py-3 text-xs font-mono text-zinc-600 hidden md:table-cell">TEAM</th>
                                        <th className="text-right px-4 py-3 text-xs font-mono text-red-400">Q3</th>
                                        <th className="text-right px-4 py-3 text-xs font-mono text-yellow-400">Q2</th>
                                        <th className="text-right px-4 py-3 text-xs font-mono text-zinc-500">Q1</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, i) => {
                                        const isQ3 = !!r.q3Time;
                                        const isQ2 = !!r.q2Time && !r.q3Time;
                                        return (
                                            <>
                                                {i === 10 && (
                                                    <tr key="sep-q2">
                                                        <td colSpan={6} className="px-4 py-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-px bg-yellow-500/30" />
                                                                <span className="text-xs text-yellow-500/70 font-mono">Eliminated after Q2</span>
                                                                <div className="flex-1 h-px bg-yellow-500/30" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {i === 15 && (
                                                    <tr key="sep-q1">
                                                        <td colSpan={6} className="px-4 py-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-px bg-zinc-600/50" />
                                                                <span className="text-xs text-zinc-600 font-mono">Eliminated after Q1</span>
                                                                <div className="flex-1 h-px bg-zinc-600/50" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr key={r.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors ${!isQ3 && !isQ2 ? "opacity-60" : ""}`}>
                                                    <td className="px-4 py-3">
                                                        <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-600"}`}>
                                                            {r.gridPosition}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-0.5 h-8 rounded-full" style={{ backgroundColor: r.teamColor }} />
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{r.driverName}</p>
                                                                <p className="text-xs text-zinc-600 font-mono">#{r.carNumber}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 hidden md:table-cell">
                                                        <span className="text-xs font-bold" style={{ color: r.teamColor }}>{r.teamName}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {r.q3TimeRaw ? <TimeDelta time={r.q3TimeRaw} best={isFinite(bestQ3) ? bestQ3 : null} /> : <span className="text-zinc-800">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {r.q2TimeRaw ? <TimeDelta time={r.q2TimeRaw} best={isFinite(bestQ2) ? bestQ2 : null} /> : <span className="text-zinc-800">—</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {r.q1TimeRaw ? <TimeDelta time={r.q1TimeRaw} best={isFinite(bestQ1) ? bestQ1 : null} /> : <span className="text-zinc-800">—</span>}
                                                    </td>
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
