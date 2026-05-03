"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";
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

const RACE_WINNERS: Record<string, { driver: string; team: string; time: string }> = {
    "Australian Grand Prix": { driver: "George Russell", team: "Mercedes", time: "1:23:06.801" },
    "Chinese Grand Prix": { driver: "Kimi Antonelli", team: "Mercedes", time: "1:33:15.607" },
    "Japanese Grand Prix": { driver: "Kimi Antonelli", team: "Mercedes", time: "1:28:03.403" },
};

const statusStyle: Record<string, string> = {
    COMPLETED: "text-green-400 bg-green-500/10 border-green-500/30",
    CANCELLED: "text-red-400 bg-red-500/10 border-red-500/30",
    SCHEDULED: "text-zinc-400 bg-zinc-800 border-zinc-700",
    ONGOING: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};

export default function RacesPage() {
    const router = useRouter();
    const [races, setRaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");

    useEffect(() => {
        if (!getAccessToken()) { router.push("/login"); return; }
        authFetch(`${API}/api/races/season/2026`)
            .then(r => r.json()).then(setRaces)
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    const completed = races.filter(r => r.status === "COMPLETED").length;
    const cancelled = races.filter(r => r.status === "CANCELLED").length;
    const scheduled = races.filter(r => r.status === "SCHEDULED").length;
    const filtered = filter === "ALL" ? races : races.filter(r => r.status === filter);

    return (
        <div className="min-h-screen bg-zinc-950">
            <Navbar />
            <main className="max-w-7xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
                            2026 Season · {races.length} Rounds
                        </p>
                        <h1 className="text-4xl font-black tracking-tighter text-white">
                            RACE <span className="text-red-500">CALENDAR</span>
                        </h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-zinc-600 font-mono mb-2">SEASON PROGRESS (22 active)</p>
                        <div className="w-48 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full"
                                style={{ width: `${(completed / 22) * 100}%` }} />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{completed}/22 completed</p>
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2 mb-8">
                    {[
                        { key: "ALL", label: "ALL", count: races.length },
                        { key: "COMPLETED", label: "COMPLETED", count: completed },
                        { key: "SCHEDULED", label: "SCHEDULED", count: scheduled },
                        { key: "CANCELLED", label: "CANCELLED", count: cancelled },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${filter === f.key
                                ? f.key === "CANCELLED" ? "border-red-500 text-red-400 bg-red-500/10"
                                    : f.key === "COMPLETED" ? "border-green-500 text-green-400 bg-green-500/10"
                                        : "border-red-500 text-white bg-red-500/20"
                                : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                                }`}>
                            {f.label} <span className="opacity-60 ml-1">{f.count}</span>
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full" /> LOADING...
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((race) => {
                            const winner = RACE_WINNERS[race.name];
                            const isCancelled = race.status === "CANCELLED";
                            const isCompleted = race.status === "COMPLETED";

                            return (
                                <div key={race.id}
                                    className={`flex items-center justify-between rounded-xl px-6 py-4 border transition-all ${isCancelled
                                        ? "bg-red-950/20 border-red-900/30 opacity-60"
                                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                                        }`}
                                >
                                    <div className="flex items-center gap-5">
                                        <span className="text-2xl font-black text-zinc-700 w-8 text-center">
                                            {race.roundNumber}
                                        </span>
                                        <span className="text-xl w-6">
                                            {COUNTRY_FLAGS[race.circuit?.country] || "🏁"}
                                        </span>
                                        <div>
                                            <h2 className="text-base font-bold text-white">{race.name}</h2>
                                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                                                {race.circuit?.name} · {race.date}
                                            </p>
                                            {winner && (
                                                <p className="text-xs text-yellow-400 mt-1">
                                                    🏆 {winner.driver} ({winner.team}) · {winner.time}
                                                </p>
                                            )}
                                            {isCancelled && (
                                                <p className="text-xs text-red-400/70 mt-1">
                                                    ⚠️ Cancelled — Middle East conflict
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {(isCompleted || race.status === "SCHEDULED") && (
                                            <Link
                                                href={`/races/${race.id}/qualifying`}
                                                className="text-xs font-mono text-zinc-500 hover:text-yellow-400 border border-zinc-700 hover:border-yellow-500 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                QUALIFYING →
                                            </Link>
                                        )}
                                        {isCompleted && (
                                            <Link
                                                href={`/races/${race.id}/results`}
                                                className="text-xs font-mono text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                RESULTS →
                                            </Link>
                                        )}
                                        <span className={`text-xs px-3 py-1 rounded border font-mono min-w-24 text-center ${statusStyle[race.status]}`}>
                                            {race.status}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
