"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";
import RaceWeekendWidget from "../components/RaceWeekendWidget";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const COUNTRY_FLAGS: Record<string, string> = {
    "Australia": "🇦🇺", "China": "🇨🇳", "Japan": "🇯🇵", "Bahrain": "🇧🇭",
    "Saudi Arabia": "🇸🇦", "United States": "🇺🇸", "Canada": "🇨🇦",
    "Monaco": "🇲🇨", "Spain": "🇪🇸", "Austria": "🇦🇹", "United Kingdom": "🇬🇧",
    "Belgium": "🇧🇪", "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹",
    "Azerbaijan": "🇦🇿", "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷",
    "UAE": "🇦🇪", "Qatar": "🇶🇦",
};

interface RaceWinner { driver: string; team: string; }

export default function RacesPage() {
    const router = useRouter();
    const [races, setRaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [raceWinners, setRaceWinners] = useState<Record<string, RaceWinner>>({});
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    useEffect(() => {
        if (!getAccessToken()) { router.push("/login"); return; }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await authFetch(`${API}/api/races/season/2026`);
            const racesData = await res.json();
            setRaces(racesData);

            // Fix: 1 bulk call thay vì N calls riêng cho từng race
            try {
                const winnersRes = await authFetch(`${API}/api/race-results/winners/2026`);
                const winnersData = await winnersRes.json();
                const winnerMap: Record<string, RaceWinner> = {};
                Object.entries(winnersData).forEach(([raceName, w]: [string, any]) => {
                    winnerMap[raceName] = { driver: w.driverName, team: w.teamName };
                });
                setRaceWinners(winnerMap);
            } catch (e) { console.error("Failed to fetch winners", e); }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const mainRaces = races.filter(r => !r.name.toLowerCase().includes("sprint"));
    const completed = mainRaces.filter(r => r.status === "COMPLETED").length;
    const cancelled = mainRaces.filter(r => r.status === "CANCELLED").length;
    const scheduled = mainRaces.filter(r => r.status === "SCHEDULED").length;

    const allFiltered = filter === "ALL" ? races
        : filter === "SPRINT" ? races.filter(r => r.name.toLowerCase().includes("sprint"))
            : races.filter(r => r.status === filter && !r.name.toLowerCase().includes("sprint"));

    const filterCounts = {
        ALL: races.length,
        COMPLETED: completed,
        SCHEDULED: scheduled,
        CANCELLED: cancelled,
        SPRINT: races.filter(r => r.name.toLowerCase().includes("sprint")).length,
    };

    return (
        <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
            <style>{`
                @keyframes cardIn {
                    from { transform: translateX(-16px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
                @keyframes glowPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
                @keyframes scanDown {
                    0% { transform: translateY(-100%); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(100vh); opacity: 0; }
                }
                .card-in { animation: cardIn 0.4s ease-out both; }
                .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
                .glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
            `}</style>

            {/* Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-red-950/5" />
                <div className="absolute top-40 left-0 w-[600px] h-[400px] bg-red-500/3 rounded-full blur-[150px]" />
                <div className="absolute inset-0 opacity-[0.012]" style={{
                    backgroundImage: "linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)",
                    backgroundSize: "60px 60px",
                }} />
                {/* Vertical timeline track */}
                <div className="absolute left-[calc(50%-600px+80px)] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-red-500/10 to-transparent hidden xl:block" />
            </div>

            <Navbar />

            <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-end justify-between mb-8 card-in">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">2026 SEASON · {races.length} ROUNDS</p>
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
                            RACE<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">CALENDAR</span>
                        </h1>
                    </div>

                    {/* Mini progress */}
                    <div className="text-right card-in" style={{ animationDelay: "100ms" }}>
                        <p className="text-xs text-zinc-600 font-mono mb-3 tracking-widest">SEASON PROGRESS</p>
                        {/* Circular progress */}
                        <div className="relative w-20 h-20 mx-auto mb-2">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="#27272a" strokeWidth="6" />
                                <circle cx="40" cy="40" r="34" fill="none" stroke="#ef4444" strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 34}`}
                                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - completed / 22)}`}
                                    style={{ transition: "stroke-dashoffset 1s ease-out", filter: "drop-shadow(0 0 6px rgba(239,68,68,0.6))" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg font-black text-white">{completed}</span>
                                <span className="text-zinc-600 text-xs font-mono">/ 22</span>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500 font-mono">{Math.round((completed / 22) * 100)}% complete</p>
                    </div>
                </div>

                {/* Race Weekend Widget */}
                <div className="mb-8 card-in" style={{ animationDelay: "150ms" }}>
                    <RaceWeekendWidget />
                </div>

                {/* Filter tabs */}
                <div className="flex flex-wrap gap-2 mb-8 card-in" style={{ animationDelay: "200ms" }}>
                    {(["ALL", "COMPLETED", "SCHEDULED", "CANCELLED", "SPRINT"] as const).map(f => {
                        const colors: Record<string, string> = {
                            ALL: "border-red-500 text-white bg-red-500/20",
                            COMPLETED: "border-green-500 text-green-400 bg-green-500/10",
                            SCHEDULED: "border-blue-500 text-blue-400 bg-blue-500/10",
                            CANCELLED: "border-red-500 text-red-400 bg-red-500/10",
                            SPRINT: "border-orange-500 text-orange-400 bg-orange-500/10",
                        };
                        return (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`relative px-5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 overflow-hidden ${filter === f ? colors[f] : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
                                    }`}>
                                {filter === f && <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />}
                                {f === "SPRINT" ? "⚡ " : ""}{f}
                                <span className="ml-1.5 opacity-50 text-xs">
                                    {filterCounts[f]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Race list */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-20 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800/50"
                                style={{ animationDelay: `${i * 100}ms` }} />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {allFiltered.map((race, idx) => {
                            const winner = raceWinners[race.name];
                            const isCancelled = race.status === "CANCELLED";
                            const isCompleted = race.status === "COMPLETED";
                            const isSprint = race.name.toLowerCase().includes("sprint");
                            const isHovered = hoveredId === race.id;

                            const statusConfig = {
                                COMPLETED: { dot: "#22c55e", text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "✓ DONE" },
                                CANCELLED: { dot: "#ef4444", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "✗ CANCELLED" },
                                SCHEDULED: { dot: "#71717a", text: "text-zinc-400", bg: "bg-zinc-800/50", border: "border-zinc-700", label: "UPCOMING" },
                                ONGOING: { dot: "#eab308", text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "● LIVE" },
                            }[race.status] || { dot: "#666", text: "text-zinc-500", bg: "bg-zinc-800", border: "border-zinc-700", label: race.status };

                            return (
                                <div
                                    key={race.id}
                                    className={`relative group rounded-2xl border transition-all duration-300 overflow-hidden card-in ${isCancelled
                                        ? "bg-zinc-900/30 border-zinc-800/30 opacity-50"
                                        : isSprint
                                            ? "bg-orange-950/10 border-orange-900/20 hover:border-orange-500/30"
                                            : isCompleted
                                                ? "bg-zinc-900/70 border-zinc-800/50 hover:border-green-500/20"
                                                : "bg-zinc-900/60 border-zinc-800/50 hover:border-red-500/20"
                                        }`}
                                    style={{
                                        animationDelay: `${idx * 30}ms`,
                                        boxShadow: isHovered && !isCancelled
                                            ? isCompleted ? "0 0 30px rgba(34,197,94,0.05)" : "0 0 30px rgba(239,68,68,0.05)"
                                            : undefined,
                                    }}
                                    onMouseEnter={() => setHoveredId(race.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    {/* Top shimmer on hover */}
                                    {isHovered && !isCancelled && (
                                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                                    )}

                                    {/* Completed: green left glow */}
                                    {isCompleted && (
                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-500/50 group-hover:bg-green-500 transition-colors" />
                                    )}

                                    {/* Sprint: orange left glow */}
                                    {isSprint && (
                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500/50 group-hover:bg-orange-500 transition-colors" />
                                    )}

                                    <div className="flex items-center gap-4 px-5 py-4">
                                        {/* Round number */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border border-zinc-700/50 bg-zinc-800/50">
                                            <span className="text-sm font-black text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                                {isSprint ? "⚡" : race.roundNumber}
                                            </span>
                                        </div>

                                        {/* Flag */}
                                        <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                                            {isSprint
                                                ? COUNTRY_FLAGS[race.circuit?.country] || "🏁"
                                                : COUNTRY_FLAGS[race.circuit?.country] || "🏁"}
                                        </span>

                                        {/* Race info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className={`text-sm font-black transition-colors ${isCancelled ? "text-zinc-600" :
                                                    isCompleted ? "text-white group-hover:text-green-300" :
                                                        isSprint ? "text-orange-200 group-hover:text-orange-300" :
                                                            "text-white group-hover:text-red-300"
                                                    }`}>{race.name}</h2>
                                                {isSprint && (
                                                    <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-mono">SPRINT</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-zinc-600 font-mono mt-0.5">
                                                {race.circuit?.name} · <span className="text-zinc-500">{race.date}</span>
                                            </p>
                                            {winner && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-xs">🏆</span>
                                                    <span className="text-xs text-yellow-400 font-bold">{winner.driver}</span>
                                                    <span className="text-xs text-zinc-600">·</span>
                                                    <span className="text-xs text-zinc-500">{winner.team}</span>
                                                </div>
                                            )}
                                            {isCancelled && (
                                                <p className="text-xs text-red-400/60 mt-1">⚠️ Cancelled — Middle East conflict</p>
                                            )}
                                        </div>

                                        {/* Actions + Status */}
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            {!isSprint && (isCompleted || race.status === "SCHEDULED") && (
                                                <Link href={`/races/${race.id}/qualifying`}
                                                    className="text-xs font-mono text-zinc-500 hover:text-yellow-400 border border-zinc-700 hover:border-yellow-500/50 px-3 py-1.5 rounded-lg transition-all hover:bg-yellow-500/5">
                                                    QUALI →
                                                </Link>
                                            )}
                                            {isCompleted && (
                                                <Link href={`/races/${race.id}/results`}
                                                    className="text-xs font-mono text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/5">
                                                    RESULTS →
                                                </Link>
                                            )}
                                            <span className={`text-xs px-3 py-1.5 rounded-lg border font-mono font-bold ${statusConfig.text} ${statusConfig.bg} ${statusConfig.border}`}>
                                                {statusConfig.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Season end note */}
                {!loading && allFiltered.length > 0 && (
                    <div className="mt-8 text-center">
                        <p className="text-zinc-700 text-xs font-mono">
                            {completed} races completed · {22 - completed - cancelled} remaining · {cancelled} cancelled
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}