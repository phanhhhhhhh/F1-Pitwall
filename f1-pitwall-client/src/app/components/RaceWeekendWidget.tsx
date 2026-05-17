"use client";

import { useEffect, useState, useCallback } from "react";
import { authFetch } from "../lib/pitwall-auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Session {
    sessionKey: number;
    name: string;
    dateStart: string;
    dateEnd: string;
    status: "LIVE" | "UPCOMING" | "COMPLETED";
    startsIn?: number;
    endsIn?: number;
}

interface WeekendData {
    countryName: string;
    circuitName: string;
    sessions: Session[];
    currentSession: Session | null;
    nextSession: Session | null;
    error?: string;
}

const SESSION_ICONS: Record<string, string> = {
    "Practice 1": "🔧",
    "Practice 2": "🔧",
    "Practice 3": "🔧",
    "Sprint Qualifying": "⏱️",
    "Sprint": "⚡",
    "Qualifying": "⏱️",
    "Race": "🏁",
};

const SESSION_COLORS: Record<string, string> = {
    "Practice 1": "#3b82f6",
    "Practice 2": "#3b82f6",
    "Practice 3": "#3b82f6",
    "Sprint Qualifying": "#eab308",
    "Sprint": "#f97316",
    "Qualifying": "#eab308",
    "Race": "#ef4444",
};

function formatDuration(seconds: number): string {
    if (seconds < 0) return "—";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatLocalTime(dateStr: string): string {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", timeZoneName: "short"
        });
    } catch { return "—"; }
}

function formatLocalDate(dateStr: string): string {
    if (!dateStr) return "—";
    try {
        return new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric"
        });
    } catch { return "—"; }
}

export default function RaceWeekendWidget() {
    const [data, setData] = useState<WeekendData | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    const fetchWeekend = useCallback(async () => {
        try {
            const res = await authFetch(`${API}/api/openf1/weekend`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error("[Weekend]", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWeekend();

        const dataInterval = setInterval(fetchWeekend, 5 * 60 * 1000);
        return () => clearInterval(dataInterval);
    }, [fetchWeekend]);


    useEffect(() => {
        const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(tickInterval);
    }, []);

    if (loading) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-32 mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-zinc-800 rounded" />)}
                </div>
            </div>
        );
    }

    if (!data || data.error || !data.sessions?.length) {
        return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs font-mono text-zinc-500 tracking-widest mb-2">RACE WEEKEND</p>
                <p className="text-zinc-600 text-sm">No upcoming sessions found</p>
            </div>
        );
    }


    const now = Date.now();
    const sessions = data.sessions.map(s => {
        const start = s.dateStart ? new Date(s.dateStart).getTime() : 0;
        const end = s.dateEnd ? new Date(s.dateEnd).getTime() : start + 3600000;
        let status: "LIVE" | "UPCOMING" | "COMPLETED" = s.status;
        let startsIn = Math.floor((start - now) / 1000);
        let endsIn = Math.floor((end - now) / 1000);

        if (now > end) status = "COMPLETED";
        else if (now >= start && now <= end) status = "LIVE";
        else status = "UPCOMING";

        return { ...s, status, startsIn, endsIn };
    });

    const currentSession = sessions.find(s => s.status === "LIVE") || null;
    const nextSession = sessions.find(s => s.status === "UPCOMING") || null;

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                    <p className="text-xs font-mono text-zinc-500 tracking-widest">RACE WEEKEND</p>
                    <p className="text-sm font-bold text-white mt-0.5">
                        {data.countryName} {data.circuitName ? `· ${data.circuitName}` : ""}
                    </p>
                </div>
                {currentSession && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-red-400 font-mono">LIVE</span>
                    </div>
                )}
            </div>

            {/* Live session banner */}
            {currentSession && (
                <div className="px-5 py-3 border-b border-zinc-800"
                    style={{
                        backgroundColor: SESSION_COLORS[currentSession.name] + "15",
                        borderLeftWidth: 3, borderLeftColor: SESSION_COLORS[currentSession.name]
                    }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span>{SESSION_ICONS[currentSession.name] || "🏎️"}</span>
                            <div>
                                <p className="text-sm font-bold text-white">{currentSession.name}</p>
                                <p className="text-xs text-zinc-400">Ends in {formatDuration(currentSession.endsIn || 0)}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black font-mono" style={{ color: SESSION_COLORS[currentSession.name] }}>
                                {formatDuration(currentSession.endsIn || 0)}
                            </p>
                            <p className="text-xs text-zinc-600">remaining</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Next session banner */}
            {!currentSession && nextSession && (
                <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span>{SESSION_ICONS[nextSession.name] || "🏎️"}</span>
                            <div>
                                <p className="text-xs text-zinc-500 font-mono">NEXT SESSION</p>
                                <p className="text-sm font-bold text-white">{nextSession.name}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black font-mono text-white">
                                {formatDuration(nextSession.startsIn || 0)}
                            </p>
                            <p className="text-xs text-zinc-600">{formatLocalDate(nextSession.dateStart)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Session timeline */}
            <div className="p-4 space-y-1">
                {sessions.map((session, idx) => {
                    const color = SESSION_COLORS[session.name] || "#666";
                    const isLive = session.status === "LIVE";
                    const isDone = session.status === "COMPLETED";
                    const isNext = !currentSession && session === nextSession;

                    return (
                        <div key={session.sessionKey || idx}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isLive ? "bg-red-500/10 border border-red-500/20" :
                                isNext ? "bg-zinc-800/60 border border-zinc-700" :
                                    "border border-transparent hover:bg-zinc-800/30"
                                }`}>

                            {/* Status indicator */}
                            <div className="w-6 flex items-center justify-center flex-shrink-0">
                                {isDone ? (
                                    <div className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                                        <span className="text-green-400 text-xs">✓</span>
                                    </div>
                                ) : isLive ? (
                                    <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                                ) : (
                                    <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: color + "60" }} />
                                )}
                            </div>

                            {/* Session info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{SESSION_ICONS[session.name] || "🏎️"}</span>
                                    <p className={`text-sm font-bold truncate ${isDone ? "text-zinc-600" : isLive ? "text-white" : "text-zinc-300"
                                        }`}>{session.name}</p>
                                    {isLive && (
                                        <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">LIVE</span>
                                    )}
                                </div>
                                <p className="text-xs text-zinc-600 font-mono">
                                    {formatLocalDate(session.dateStart)} · {formatLocalTime(session.dateStart)}
                                </p>
                            </div>

                            {/* Countdown / status */}
                            <div className="text-right flex-shrink-0">
                                {isLive && (
                                    <p className="text-sm font-mono font-bold" style={{ color }}>
                                        -{formatDuration(session.endsIn || 0)}
                                    </p>
                                )}
                                {!isDone && !isLive && session.startsIn && session.startsIn > 0 && (
                                    <p className={`text-xs font-mono ${isNext ? "text-white font-bold" : "text-zinc-600"}`}>
                                        {formatDuration(session.startsIn)}
                                    </p>
                                )}
                                {isDone && (
                                    <p className="text-xs text-zinc-700 font-mono">Done</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}