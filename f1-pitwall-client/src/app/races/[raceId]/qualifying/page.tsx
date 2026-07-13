"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "../../../lib/pitwall-auth";
import type { RaceInfo } from "../../../types/f1";
import Navbar from "../../../components/Navbar";
import PitwallBackground from "../../../components/PitwallBackground";
import { SkeletonTable } from "../../../components/LoadingSkeleton";
import { F1, getTeamColor, flagForCountry } from "../../../lib/f1-theme";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BASE_URL as API } from "../../../lib/api-client";
import type { QualifyingResult } from "../../../types/f1";

function TimeDelta({ time, best, highlight }: { time: number | null; best: number | null; highlight?: boolean }) {
    if (!time || !best) return <span className="text-zinc-700 f-mono text-xs">—</span>;
    const delta = time - best;
    if (delta < 0.001) return (
        <span className="f-mono text-xs font-bold" style={{ color: highlight ? F1.gold : "white" }}>
            {formatTime(time)}
        </span>
    );
    return (
        <span className="f-mono text-xs text-zinc-400">
            {formatTime(time)}
            <span className="text-zinc-600 ml-1">+{delta.toFixed(3)}</span>
        </span>
    );
}

function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    return `${m}:${(sec % 60).toFixed(3).padStart(6, "0")}`;
}

function safeBest(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null && isFinite(v));
    return valid.length > 0 ? Math.min(...valid) : null;
}

// Q session pill colors
const Q_COLORS = {
    q3: { bg: "rgba(225,6,0,.15)", border: "rgba(225,6,0,.4)", text: "#ff6a52", dot: F1.red },
    q2: { bg: "rgba(234,179,8,.12)", border: "rgba(234,179,8,.35)", text: "#facc15", dot: "#eab308" },
    q1: { bg: "rgba(82,82,91,.15)", border: "rgba(82,82,91,.3)", text: "#71717a", dot: "#52525b" },
} as const;

type QSeg = "q3" | "q2" | "q1";

function getSegment(r: QualifyingResult): QSeg {
    if (r.q3Time) return "q3";
    if (r.q2Time) return "q2";
    return "q1";
}

export default function QualifyingPage() {
    const params = useParams();
    const raceId = params?.raceId as string;

    const [results, setResults] = useState<QualifyingResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [resyncing, setResyncing] = useState(false);
    const [raceName, setRaceName] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [raceInfo, setRaceInfo] = useState<RaceInfo | null>(null);
    const [hasData, setHasData] = useState(false);
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
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
        try {
            const res = await authFetch(`${API}/api/races/${raceId}`);
            const d = await res.json();
            setRaceName(d.name || "");
            setRaceInfo(d);
        } catch { }
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

    const poleDriver = results.find(r => r.gridPosition === 1);
    const countryFlag = flagForCountry(raceInfo?.circuit?.country);

    // ── Loading
    if (loading) return (
        <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: F1.bg }}>
            <PitwallBackground glow="top-center" />
            <Navbar />
            <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
                <div className="mb-6">
                    <div className="h-3 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
                    <div className="h-12 w-80 bg-zinc-800 rounded animate-pulse mb-2" />
                    <div className="h-3 w-52 bg-zinc-800 rounded animate-pulse" />
                </div>
                <div className="h-40 rounded-2xl bg-zinc-900/80 border border-zinc-800/50 animate-pulse mb-8" />
                <SkeletonTable rows={12} cols={6} />
            </main>
        </div>
    );

    return (
        <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: F1.bg }}>
            <PitwallBackground glow="top-center" />
            <Navbar />
            <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

                {/* ── Page header */}
                <motion.div
                    className="mb-8 sm:mb-10"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                    <Link
                        href="/races"
                        className="f-mono text-[11px] tracking-widest text-zinc-600 hover:text-[#ff6a52] transition-colors mb-4 inline-flex items-center gap-1.5"
                    >
                        ← BACK TO CALENDAR
                    </Link>

                    <div className="flex items-center gap-2.5 mb-2">
                        <span className="inline-block w-8 h-[3px] rounded-full" style={{ background: F1.gold }} />
                        <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500 uppercase">
                            {raceInfo?.circuit?.country && `${countryFlag} `}
                            {raceInfo?.date ? raceInfo.date.slice(0, 4) : "2026"}
                            {raceInfo?.roundNumber ? ` · ROUND ${raceInfo.roundNumber}` : ""}
                            {raceInfo?.circuit?.country ? ` · ${raceInfo.circuit.country.toUpperCase()}` : ""}
                        </span>
                    </div>

                    <h1 className="f-cond font-black tracking-tight leading-[0.85]" style={{ fontSize: "clamp(40px,7vw,76px)" }}>
                        <span className="block text-white">{raceName?.toUpperCase().replace(/ GRAND PRIX$/, "") || "QUALIFYING"}</span>
                        <span
                            className="block text-transparent bg-clip-text"
                            style={{ backgroundImage: `linear-gradient(90deg, ${F1.gold}, #f59e0b)` }}
                        >
                            QUALIFYING
                        </span>
                    </h1>

                    {raceInfo?.circuit?.name && (
                        <p className="f-mono text-xs text-zinc-500 mt-2">{raceInfo.circuit.name}</p>
                    )}
                </motion.div>

                {/* ── Feedback toast */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            className={`mb-4 text-xs f-mono px-4 py-2.5 rounded-xl border inline-flex items-center gap-2 ${feedback.startsWith("✓") ? "text-[#00E676] border-[#00E676]/25 bg-[#00E676]/08" : "text-red-400 border-red-500/25 bg-red-500/08"}`}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            {feedback}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Action bar */}
                <motion.div
                    className="flex flex-wrap items-center gap-3 justify-end mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    {hasData && (
                        <button onClick={handleResync} disabled={resyncing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all f-mono ${resyncing ? "border-zinc-700 text-zinc-500" : "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/08"}`}>
                            {resyncing ? (<><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />RE-SYNCING...</>) : "⚠ RE-SYNC"}
                        </button>
                    )}
                    <button onClick={handleSync} disabled={syncing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all f-mono ${syncing ? "border-zinc-700 text-zinc-500" : "border-[#E10600]/40 text-[#ff6a52] hover:bg-[#E10600]/08"}`}>
                        {syncing ? (<><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />SYNCING...</>) : "↻ SYNC FROM OPENF1"}
                    </button>
                    <Link href={`/races/${raceId}/results`}
                        className="f-mono text-xs border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-500 px-4 py-2 rounded-xl transition-all">
                        RACE RESULTS →
                    </Link>
                </motion.div>

                {/* ── No data state */}
                {!hasData ? (
                    <motion.div
                        className="flex flex-col items-center justify-center text-center py-24 border border-dashed rounded-2xl"
                        style={{ borderColor: "rgba(255,255,255,.07)" }}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mb-5"
                            style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
                            <span className="text-2xl">🏎</span>
                        </div>
                        <p className="f-cond font-black text-xl text-white mb-1">Qualifying Data Unavailable</p>
                        <p className="f-mono text-xs text-zinc-500 max-w-xs mb-8">
                            Session not yet complete · Sync from OpenF1 once qualifying has finished
                        </p>
                        <button onClick={handleSync} disabled={syncing}
                            className="px-8 py-3 rounded-xl f-cond font-black text-sm text-white transition-all"
                            style={{ background: `linear-gradient(135deg, ${F1.red}, #dc2626)`, boxShadow: `0 0 24px rgba(225,6,0,.3)` }}>
                            {syncing ? "SYNCING..." : "SYNC QUALIFYING DATA"}
                        </button>
                    </motion.div>
                ) : (
                    <div className="space-y-8">

                        {/* ── Pole position hero */}
                        {poleDriver && (
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="inline-block w-5 h-[2px]" style={{ background: F1.gold }} />
                                    <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500">POLE POSITION</span>
                                </div>

                                {(() => {
                                    const tc = getTeamColor(poleDriver.teamName, poleDriver.teamColor);
                                    const lastName = poleDriver.driverName.split(" ").slice(-1)[0].toUpperCase();
                                    return (
                                        <div
                                            className="relative rounded-2xl border p-6 sm:p-8 overflow-hidden"
                                            style={{ background: F1.card, borderColor: `${F1.gold}30` }}
                                        >
                                            {/* Glow */}
                                            <div className="absolute top-0 right-0 w-80 h-80 pointer-events-none"
                                                style={{ background: `radial-gradient(circle at 90% 10%, ${F1.gold}18 0%, transparent 60%)`, filter: "blur(20px)" }} />
                                            <div className="absolute top-0 left-0 right-0 h-[3px]"
                                                style={{ background: `linear-gradient(90deg, ${tc}, ${F1.gold}, ${tc})` }} />

                                            <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
                                                {/* P1 badge */}
                                                <div className="flex-shrink-0">
                                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex flex-col items-center justify-center"
                                                        style={{ background: `linear-gradient(135deg, ${F1.gold}25, ${F1.gold}08)`, border: `2px solid ${F1.gold}40` }}>
                                                        <span className="f-mono text-[10px] text-zinc-500 tracking-widest">POLE</span>
                                                        <span className="f-cond font-black text-4xl leading-tight" style={{ color: F1.gold, textShadow: `0 0 20px ${F1.gold}60` }}>P1</span>
                                                    </div>
                                                </div>

                                                {/* Driver info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: tc }} />
                                                        <div>
                                                            <p className="f-cond font-black text-3xl sm:text-4xl leading-tight text-white tracking-wide">{lastName}</p>
                                                            <p className="f-cond font-bold text-sm sm:text-base text-zinc-400 leading-tight">{poleDriver.driverName}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        <span className="f-mono text-[10px] font-bold px-2.5 py-0.5 rounded"
                                                            style={{ color: tc, background: `${tc}15` }}>
                                                            {poleDriver.teamName}
                                                        </span>
                                                        <span className="f-mono text-[10px] text-zinc-600 border border-zinc-800 px-2 py-0.5 rounded">
                                                            #{poleDriver.carNumber}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Pole time */}
                                                <div className="flex-shrink-0 text-right sm:text-right">
                                                    <p className="f-mono text-[10px] text-zinc-500 tracking-widest mb-1">POLE TIME</p>
                                                    <p className="f-cond font-black text-3xl sm:text-4xl" style={{ color: F1.gold }}>
                                                        {poleDriver.bestTime || poleDriver.q3Time || "—"}
                                                    </p>
                                                    <p className="f-mono text-[10px] text-zinc-600 mt-1">Q3 · BEST LAP</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </motion.div>
                        )}

                        {/* ── Starting grid (2-wide layout) */}
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-block w-5 h-[2px]" style={{ background: F1.red }} />
                                <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500">STARTING GRID</span>
                                <div className="ml-auto flex items-center gap-4">
                                    {(["q3", "q2", "q1"] as QSeg[]).map(seg => {
                                        const c = Q_COLORS[seg];
                                        return (
                                            <span key={seg} className="flex items-center gap-1.5 f-mono text-[10px] text-zinc-600">
                                                <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
                                                {seg.toUpperCase()}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            <div
                                className="rounded-2xl border overflow-hidden"
                                style={{ background: F1.card, borderColor: F1.hairline }}
                            >
                                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${F1.gold}50, transparent)` }} />
                                <div className="p-4 sm:p-5 space-y-2">
                                    {Array.from({ length: Math.ceil(results.length / 2) }, (_, rowIdx) => {
                                        const left = results[rowIdx * 2];
                                        const right = results[rowIdx * 2 + 1];

                                        return (
                                            <motion.div
                                                key={rowIdx}
                                                className="flex gap-2 sm:gap-3"
                                                initial={{ opacity: 0, x: -6 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3, delay: 0.12 + rowIdx * 0.03 }}
                                            >
                                                {[left, right].map((driver, side) => {
                                                    if (!driver) return <div key={side} className="flex-1" />;
                                                    const seg = getSegment(driver);
                                                    const segC = Q_COLORS[seg];
                                                    const tc = getTeamColor(driver.teamName, driver.teamColor);
                                                    const isPole = driver.gridPosition === 1;

                                                    return (
                                                        <div
                                                            key={driver.id}
                                                            className="flex-1 flex items-center gap-3 rounded-xl px-3 sm:px-4 py-2.5 transition-all group border"
                                                            style={{
                                                                background: isPole ? `rgba(255,210,0,.06)` : "rgba(255,255,255,.02)",
                                                                borderColor: isPole ? `${F1.gold}30` : "rgba(255,255,255,.06)",
                                                                borderLeft: `3px solid ${tc}`,
                                                            }}
                                                        >
                                                            {/* Grid position */}
                                                            <span
                                                                className="f-cond font-black text-2xl w-7 flex-shrink-0 tabular-nums leading-none"
                                                                style={{
                                                                    color: isPole ? F1.gold
                                                                        : driver.gridPosition === 2 ? "#C0C0C0"
                                                                        : driver.gridPosition === 3 ? "#CD7F32"
                                                                        : "#3f3f46",
                                                                }}
                                                            >
                                                                {driver.gridPosition}
                                                            </span>

                                                            {/* Name + team */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="f-cond font-black text-white text-sm sm:text-base truncate leading-tight">
                                                                    {driver.driverName.split(" ").slice(-1)[0].toUpperCase()}
                                                                </p>
                                                                <p className="f-mono text-[10px] truncate" style={{ color: tc }}>{driver.teamName}</p>
                                                            </div>

                                                            {/* Best time + segment dot */}
                                                            <div className="text-right flex-shrink-0">
                                                                <p className="f-mono text-xs text-zinc-400">{driver.bestTime || "—"}</p>
                                                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                                                    <span className="f-mono text-[9px] font-bold" style={{ color: segC.text }}>{seg.toUpperCase()}</span>
                                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: segC.dot, boxShadow: `0 0 4px ${segC.dot}` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>

                        {/* ── Qualifying times table with Q1/Q2/Q3 columns */}
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.18 }}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-block w-5 h-[2px]" style={{ background: "#52525b" }} />
                                <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500">SESSION TIMES</span>
                            </div>

                            <div
                                className="rounded-2xl border overflow-hidden"
                                style={{ background: F1.card, borderColor: F1.hairline }}
                            >
                                <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)` }} />

                                {/* Header */}
                                <div className="border-b" style={{ borderColor: "rgba(255,255,255,.06)" }}>
                                    <div className="grid grid-cols-[40px_1fr_auto_auto_auto_auto] sm:grid-cols-[48px_1fr_1fr_auto_auto_auto] px-4 sm:px-6 py-3 gap-0">
                                        <span className="f-mono text-[10px] text-zinc-600 tracking-widest">P</span>
                                        <span className="f-mono text-[10px] text-zinc-600 tracking-widest">DRIVER</span>
                                        <span className="f-mono text-[10px] text-zinc-600 tracking-widest hidden sm:block">TEAM</span>
                                        <span className="f-mono text-[10px] tracking-widest text-right" style={{ color: Q_COLORS.q3.text }}>Q3</span>
                                        <span className="f-mono text-[10px] tracking-widest text-right px-3" style={{ color: Q_COLORS.q2.text }}>Q2</span>
                                        <span className="f-mono text-[10px] tracking-widest text-right" style={{ color: Q_COLORS.q1.text }}>Q1</span>
                                    </div>
                                </div>

                                {/* Rows */}
                                {results.map((r, i) => {
                                    const tc = getTeamColor(r.teamName, r.teamColor);
                                    const seg = getSegment(r);
                                    const isElimQ1 = !r.q2Time && !r.q3Time;
                                    const isElimQ2 = !!r.q2Time && !r.q3Time;
                                    const isPole = r.gridPosition === 1;

                                    return (
                                        <>
                                            {i === 10 && (
                                                <div key="sep-q2" className="px-5 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-px" style={{ background: `${Q_COLORS.q2.dot}30` }} />
                                                        <span className="f-mono text-[10px] px-2 py-0.5 rounded" style={{ color: Q_COLORS.q2.text, background: `${Q_COLORS.q2.dot}12`, border: `1px solid ${Q_COLORS.q2.dot}25` }}>
                                                            Eliminated after Q2
                                                        </span>
                                                        <div className="flex-1 h-px" style={{ background: `${Q_COLORS.q2.dot}30` }} />
                                                    </div>
                                                </div>
                                            )}
                                            {i === 15 && (
                                                <div key="sep-q1" className="px-5 py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-px" style={{ background: "rgba(82,82,91,.25)" }} />
                                                        <span className="f-mono text-[10px] text-zinc-600 px-2 py-0.5 rounded border border-zinc-700/30">
                                                            Eliminated after Q1
                                                        </span>
                                                        <div className="flex-1 h-px" style={{ background: "rgba(82,82,91,.25)" }} />
                                                    </div>
                                                </div>
                                            )}

                                            <motion.div
                                                key={r.id}
                                                className="grid grid-cols-[40px_1fr_auto_auto_auto_auto] sm:grid-cols-[48px_1fr_1fr_auto_auto_auto] items-center px-4 sm:px-6 py-3 border-b transition-colors group"
                                                style={{
                                                    borderColor: "rgba(255,255,255,.04)",
                                                    opacity: isElimQ1 ? 0.45 : isElimQ2 ? 0.65 : 1,
                                                    background: isPole ? "rgba(255,210,0,.04)" : "transparent",
                                                }}
                                                initial={{ opacity: 0, x: -6 }}
                                                animate={{ opacity: isElimQ1 ? 0.45 : isElimQ2 ? 0.65 : 1, x: 0 }}
                                                transition={{ duration: 0.3, delay: 0.2 + i * 0.02 }}
                                                whileHover={{ backgroundColor: "rgba(255,255,255,.025)" }}
                                            >
                                                {/* Grid pos */}
                                                <span
                                                    className="f-cond font-black text-xl leading-none"
                                                    style={{
                                                        color: isPole ? F1.gold
                                                            : r.gridPosition === 2 ? "#C0C0C0"
                                                            : r.gridPosition === 3 ? "#CD7F32"
                                                            : "#3f3f46",
                                                    }}
                                                >
                                                    {r.gridPosition}
                                                </span>

                                                {/* Driver */}
                                                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                                                    <div className="w-[3px] h-8 rounded-full flex-shrink-0" style={{ background: tc }} />
                                                    <div className="min-w-0">
                                                        <p className={`f-cond font-black text-sm sm:text-base leading-tight truncate ${isPole ? "text-[#FFD200]" : "text-white"}`}>
                                                            {r.driverName}
                                                        </p>
                                                        <p className="f-mono text-[10px] text-zinc-600">#{r.carNumber}</p>
                                                    </div>
                                                </div>

                                                {/* Team — sm+ */}
                                                <div className="hidden sm:flex items-center">
                                                    <span className="f-mono text-[10px] font-bold px-2.5 py-0.5 rounded truncate"
                                                        style={{ color: tc, background: `${tc}15` }}>
                                                        {r.teamName}
                                                    </span>
                                                </div>

                                                {/* Q3 */}
                                                <div className="text-right">
                                                    {r.q3TimeRaw !== null
                                                        ? <TimeDelta time={r.q3TimeRaw} best={bestQ3} highlight={isPole} />
                                                        : <span className="f-mono text-xs text-zinc-700">—</span>}
                                                </div>

                                                {/* Q2 */}
                                                <div className="text-right px-3">
                                                    {r.q2TimeRaw !== null
                                                        ? <TimeDelta time={r.q2TimeRaw} best={bestQ2} />
                                                        : <span className="f-mono text-xs text-zinc-700">—</span>}
                                                </div>

                                                {/* Q1 */}
                                                <div className="text-right">
                                                    {r.q1TimeRaw !== null
                                                        ? <TimeDelta time={r.q1TimeRaw} best={bestQ1} />
                                                        : <span className="f-mono text-xs text-zinc-700">—</span>}
                                                </div>
                                            </motion.div>
                                        </>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* ── Q session summary pills */}
                        <motion.div
                            className="flex flex-wrap gap-3 pt-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.35 }}
                        >
                            {([
                                { label: "Q3 BEST", time: bestQ3 ? formatTime(bestQ3) : null, color: Q_COLORS.q3 },
                                { label: "Q2 BEST", time: bestQ2 ? formatTime(bestQ2) : null, color: Q_COLORS.q2 },
                                { label: "Q1 BEST", time: bestQ1 ? formatTime(bestQ1) : null, color: Q_COLORS.q1 },
                            ] as const).map(({ label, time, color }) => time && (
                                <div
                                    key={label}
                                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 border"
                                    style={{ background: color.bg, borderColor: color.border }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ background: color.dot }} />
                                    <span className="f-mono text-[10px] text-zinc-500 tracking-widest">{label}</span>
                                    <span className="f-cond font-black text-base" style={{ color: color.text }}>{time}</span>
                                </div>
                            ))}
                        </motion.div>

                    </div>
                )}
            </main>
        </div>
    );
}
