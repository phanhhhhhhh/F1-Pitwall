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
    const [filter, setFilter] = useState("GP");
    const [raceWinners, setRaceWinners] = useState<Record<string, RaceWinner>>({});

    useEffect(() => {
        if (!getAccessToken()) { router.push("/login"); return; }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await authFetch(`${API}/api/races/season/2026`);
            const racesData = await res.json();
            setRaces(racesData);
            try {
                const wRes = await authFetch(`${API}/api/race-results/winners/2026`);
                const wData = await wRes.json();
                const map: Record<string, RaceWinner> = {};
                Object.entries(wData).forEach(([name, w]: [string, any]) => {
                    map[name] = { driver: w.driverName, team: w.teamName };
                });
                setRaceWinners(map);
            } catch { }
        } catch { }
        finally { setLoading(false); }
    };

    const mainRaces = races.filter(r => !r.name.toLowerCase().includes("sprint"));
    const sprintRaces = races.filter(r => r.name.toLowerCase().includes("sprint"));
    const completed = mainRaces.filter(r => r.status === "COMPLETED").length;
    const cancelled = mainRaces.filter(r => r.status === "CANCELLED").length;
    const scheduled = mainRaces.filter(r => r.status === "SCHEDULED").length;


    const displayList =
        filter === "GP" ? mainRaces.map(r => ({ ...r, _type: "gp" }))
            : filter === "SPRINT" ? sprintRaces.map(r => ({ ...r, _type: "sprint" }))
                : filter === "ALL" ? races.map(r => ({ ...r, _type: r.name.toLowerCase().includes("sprint") ? "sprint" : "gp" }))
                    : mainRaces.filter(r => r.status === filter).map(r => ({ ...r, _type: "gp" }));

    const TABS = [
        { key: "GP", label: "🏁 Grand Prix", count: mainRaces.length },
        { key: "SPRINT", label: "⚡ Sprint", count: sprintRaces.length },
        { key: "COMPLETED", label: "Completed", count: completed },
        { key: "SCHEDULED", label: "Scheduled", count: scheduled },
        { key: "CANCELLED", label: "Cancelled", count: cancelled },
        { key: "ALL", label: "All sessions", count: races.length },
    ];

    const today = new Date().toISOString().split("T")[0];
    const nextGP = mainRaces.find(r => r.status === "SCHEDULED" && r.date >= today);

    // Countdown to next race
    const [countdown, setCountdown] = useState("");
    useEffect(() => {
        if (!nextGP) return;
        const update = () => {
            const diff = new Date(nextGP.date + "T00:00:00Z").getTime() - Date.now();
            if (diff <= 0) { setCountdown("Race day!"); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            setCountdown(`${d}d ${h}h away`);
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, [nextGP]);

    return (
        <div className="min-h-screen bg-zinc-950">
            <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .35s ease-out both}
      `}</style>

            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-zinc-950" />
                <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-red-500/4 rounded-full blur-[150px]" />
            </div>

            <Navbar />

            <main className="relative z-10 max-w-4xl mx-auto px-6 py-10">

                {/* Header */}
                <div className="mb-8 fade-in">
                    <p className="text-red-500/50 font-mono text-xs tracking-[0.3em] mb-2">2026 SEASON · {mainRaces.length} GP · {sprintRaces.length} SPRINTS</p>
                    <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
                        RACE<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">CALENDAR</span>
                    </h1>
                </div>

                {/* Race Weekend Widget */}
                <div className="mb-8 fade-in" style={{ animationDelay: "50ms" }}>
                    <RaceWeekendWidget />
                </div>

                {/* Filter tabs */}
                <div className="flex flex-wrap gap-2 mb-8 fade-in" style={{ animationDelay: "100ms" }}>
                    {TABS.map(({ key, label, count }) => (
                        <button key={key} onClick={() => setFilter(key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${filter === key
                                ? key === "GP" ? "border-red-500 bg-red-500/15 text-red-300"
                                    : key === "SPRINT" ? "border-orange-500 bg-orange-500/15 text-orange-300"
                                        : key === "COMPLETED" ? "border-green-500 bg-green-500/15 text-green-300"
                                            : key === "SCHEDULED" ? "border-blue-500 bg-blue-500/15 text-blue-300"
                                                : key === "CANCELLED" ? "border-red-400 bg-red-400/10 text-red-400"
                                                    : "border-zinc-500 bg-zinc-800/50 text-zinc-300"
                                : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400"
                                }`}>
                            {label} <span className="opacity-50 ml-1">{count}</span>
                        </button>
                    ))}
                </div>

                {/* Progress bar */}
                <div className="mb-8 fade-in" style={{ animationDelay: "150ms" }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-zinc-500 tracking-widest">SEASON PROGRESS</span>
                        <span className="text-xs font-mono text-zinc-500"><span className="text-white">{completed}</span> / 22 GP</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${(completed / 22) * 100}%`, background: "linear-gradient(90deg,#ef4444,#f97316)" }} />
                    </div>
                    <div className="flex gap-4 mt-2">
                        <span className="text-xs text-zinc-600 font-mono flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />{completed} done</span>
                        <span className="text-xs text-zinc-600 font-mono flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />{cancelled} cancelled</span>
                        <span className="text-xs text-zinc-600 font-mono flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />{scheduled} upcoming</span>
                    </div>
                </div>

                {/* Timeline */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800/30" />)}
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />

                        <div className="space-y-2">
                            {displayList.map((race, idx) => {
                                const isSprint = race._type === "sprint";
                                const isCompleted = race.status === "COMPLETED";
                                const isCancelled = race.status === "CANCELLED";
                                const isNext = nextGP?.id === race.id;
                                const winner = raceWinners[race.name];

                                const dotColor = isCancelled ? "#52525b"
                                    : isCompleted ? "#22c55e"
                                        : isSprint ? "#f97316"
                                            : isNext ? "#ef4444"
                                                : "#3f3f46";

                                return (
                                    <div key={race.id} className={`relative fade-in ${isSprint ? "pl-16" : "pl-12"}`}
                                        style={{ animationDelay: `${idx * 25}ms` }}>

                                        {/* Dot */}
                                        <div className="absolute rounded-full border-2 border-zinc-950 z-10"
                                            style={{
                                                width: isSprint ? "10px" : "14px",
                                                height: isSprint ? "10px" : "14px",
                                                left: isSprint ? "16px" : "13px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                backgroundColor: dotColor,
                                                boxShadow: isNext ? "0 0 8px rgba(239,68,68,0.6)" : "none",
                                            }} />

                                        {/* Card */}
                                        <div className={`flex items-center gap-4 rounded-2xl border px-5 py-3.5 transition-all duration-200 group ${isCancelled ? "bg-zinc-900/20 border-zinc-800/20 opacity-40"
                                            : isNext ? "bg-red-950/20 border-red-500/30 hover:border-red-500/50"
                                                : isCompleted ? "bg-zinc-900/60 border-zinc-800/40 hover:border-green-500/20"
                                                    : isSprint ? "bg-orange-950/10 border-orange-900/20 hover:border-orange-500/30"
                                                        : "bg-zinc-900/40 border-zinc-800/30 hover:border-zinc-700"
                                            }`}
                                            style={{
                                                borderLeft: isCompleted && !isSprint ? "3px solid rgba(34,197,94,0.5)"
                                                    : isNext ? "3px solid rgba(239,68,68,0.6)"
                                                        : isSprint ? "3px solid rgba(249,115,22,0.4)"
                                                            : undefined,
                                                borderRadius: (isCompleted || isNext || isSprint) ? "0 16px 16px 0" : undefined,
                                            }}>

                                            {/* Round */}
                                            <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${isNext ? "bg-red-500/20 text-red-400"
                                                : isCompleted ? "bg-green-500/10 text-green-600"
                                                    : isSprint ? "bg-orange-500/10 text-orange-400"
                                                        : "bg-zinc-800/60 text-zinc-500"
                                                }`}>
                                                {isSprint ? "⚡" : `R${race.roundNumber}`}
                                            </div>

                                            {/* Flag */}
                                            <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
                                                {COUNTRY_FLAGS[race.circuit?.country] || "🏁"}
                                            </span>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-sm font-black truncate ${isCancelled ? "text-zinc-600 line-through"
                                                        : isNext ? "text-red-300"
                                                            : isCompleted ? "text-white"
                                                                : isSprint ? "text-orange-200"
                                                                    : "text-zinc-300"
                                                        }`}>{race.name}</span>
                                                    {isSprint && <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded font-mono">SPRINT</span>}
                                                    {isNext && countdown && <span className="text-xs text-red-400/70 font-mono">{countdown}</span>}
                                                </div>
                                                <p className="text-xs text-zinc-600 font-mono mt-0.5 truncate">
                                                    {race.circuit?.name} · {race.date}
                                                </p>
                                                {winner && (
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                        🏆 <span className="text-yellow-400 font-bold">{winner.driver}</span>
                                                        <span className="text-zinc-700 mx-1">·</span>
                                                        <span>{winner.team}</span>
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {!isSprint && (isCompleted || race.status === "SCHEDULED") && (
                                                    <Link href={`/races/${race.id}/qualifying`}
                                                        className="text-xs font-mono text-zinc-600 hover:text-yellow-400 border border-zinc-800 hover:border-yellow-500/40 px-3 py-1.5 rounded-lg transition-all hover:bg-yellow-500/5">
                                                        Quali →
                                                    </Link>
                                                )}
                                                {isSprint && (isCompleted || race.status === "SCHEDULED") && (
                                                    <Link href={`/races/${race.id}/qualifying`}
                                                        className="text-xs font-mono text-zinc-600 hover:text-orange-400 border border-zinc-800 hover:border-orange-500/40 px-3 py-1.5 rounded-lg transition-all hover:bg-orange-500/5">
                                                        ⚡ S-Quali →
                                                    </Link>
                                                )}
                                                {isCompleted && (
                                                    <Link href={`/races/${race.id}/results`}
                                                        className="text-xs font-mono text-zinc-600 hover:text-red-400 border border-zinc-800 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/5">
                                                        Results →
                                                    </Link>
                                                )}
                                                {/* Status badge */}
                                                <span className={`text-xs px-2.5 py-1 rounded-lg border font-mono font-bold ${isCompleted ? "text-green-400 bg-green-500/10 border-green-500/20"
                                                    : isCancelled ? "text-zinc-500 bg-zinc-800/40 border-zinc-700/30"
                                                        : isNext ? "text-red-400 bg-red-500/10 border-red-500/20"
                                                            : isSprint ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
                                                                : "text-zinc-500 bg-zinc-800/30 border-zinc-700/20"
                                                    }`}>
                                                    {isCompleted ? "✓" : isCancelled ? "✗" : isNext ? "Next" : "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="mt-8 text-center">
                        <p className="text-zinc-700 text-xs font-mono">
                            {completed} completed · {scheduled} remaining · {cancelled} cancelled
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}