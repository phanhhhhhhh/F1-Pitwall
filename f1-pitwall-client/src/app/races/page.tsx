"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/pitwall-auth";
import { useSeason } from "../context/SeasonContext";
import Navbar from "../components/Navbar";
import RaceWeekendWidget from "../components/RaceWeekendWidget";
import Link from "next/link";
import { BASE_URL as API } from "../lib/api-client";
import { SkeletonTable } from "../components/LoadingSkeleton";
import { COUNTRY_FLAGS } from "../lib/f1-theme";
import type { RaceInfo } from "../types/f1";

interface RaceWinner { driver: string; team: string; }

export default function RacesPage() {
    const { season } = useSeason();
    const [races, setRaces] = useState<RaceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    const [raceWinners, setRaceWinners] = useState<Record<string, RaceWinner>>({});

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [season]);

    const fetchData = async () => {
        try {
            const res = await authFetch(`${API}/api/races/season/${season}`);
            const racesData = await res.json();
            setRaces(racesData);
            try {
                const wRes = await authFetch(`${API}/api/race-results/winners/${season}`);
                const wData = await wRes.json();
                const map: Record<string, RaceWinner> = {};
                Object.entries(wData as Record<string, { driverName: string; teamName: string }>).forEach(([name, w]) => { map[name] = { driver: w.driverName, team: w.teamName }; });
                setRaceWinners(map);
            } catch (e) {
                console.warn("[RacesPage] Failed to fetch race winners:", e);
            }
        } catch (e) {
            console.error("[RacesPage] Failed to fetch races:", e);
        } finally { setLoading(false); }
    };

    const mainRaces = races.filter(r => !r.name.toLowerCase().includes("sprint"));
    const sprintRaces = races.filter(r => r.name.toLowerCase().includes("sprint"));
    const completed = mainRaces.filter(r => r.status === "COMPLETED").length;
    const cancelled = mainRaces.filter(r => r.status === "CANCELLED").length;
    const scheduled = mainRaces.filter(r => r.status === "SCHEDULED").length;
    const totalGP = mainRaces.length || 22;

    const displayList =
        filter === "COMPLETED" ? races.filter(r => r.status === "COMPLETED").map(r => ({ ...r, _type: r.name.toLowerCase().includes("sprint") ? "sprint" : "gp" }))
            : filter === "UPCOMING" ? races.filter(r => r.status === "SCHEDULED").map(r => ({ ...r, _type: r.name.toLowerCase().includes("sprint") ? "sprint" : "gp" }))
                : filter === "SPRINT" ? sprintRaces.map(r => ({ ...r, _type: "sprint" }))
                    : races.map(r => ({ ...r, _type: r.name.toLowerCase().includes("sprint") ? "sprint" : "gp" }));

    const TABS = [
        { key: "ALL", label: "All Races", count: races.length },
        { key: "COMPLETED", label: "Completed", count: completed },
        { key: "UPCOMING", label: "Upcoming", count: scheduled },
        { key: "SPRINT", label: "Sprint", count: sprintRaces.length },
    ];

    const today = new Date().toISOString().split("T")[0];
    const nextGP = mainRaces.find(r => r.status === "SCHEDULED" && r.date >= today);

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

    const TAB_ACTIVE: Record<string, string> = {
        ALL: "border-white/40 bg-white/10 text-white",
        COMPLETED: "border-[#00E676] bg-[#00E676]/15 text-emerald-300",
        UPCOMING: "border-[#3B82F6] bg-[#3B82F6]/15 text-blue-300",
        SPRINT: "border-[#F97316] bg-[#F97316]/15 text-orange-300",
    };

    return (
        <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0" style={{ background: "radial-gradient(110% 70% at 40% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
                <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 15%,black,transparent 80%)" }} />
                <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
            </div>

            <Navbar />

            <main className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
                <div className="mb-8 rise">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="inline-block w-8 h-[3px] bg-[#E10600] rounded-full shadow-[0_0_8px_#E10600]" />
                        <span className="f-mono text-xs text-red-500 font-black tracking-widest uppercase">{season} FIA FORMULA 1 CALENDAR · {mainRaces.length} GP · {sprintRaces.length} SPRINTS</span>
                    </div>
                    <h1 className="f-cond font-black tracking-tight leading-[0.85] text-5xl sm:text-7xl uppercase">
                        <span className="block text-white">RACE <span className="text-[#E10600]">CALENDAR</span></span>
                    </h1>
                </div>

                <div className="mb-8 rise" style={{ animationDelay: "50ms" }}><RaceWeekendWidget /></div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2.5 mb-8 rise" style={{ animationDelay: "100ms" }}>
                    {TABS.map(({ key, label, count }) => (
                        <button key={key} onClick={() => setFilter(key)}
                            className={`px-4 py-2 rounded-2xl f-cond text-xs font-bold tracking-wider border transition-all ${filter === key ? TAB_ACTIVE[key] + " shadow-md" : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white bg-black/40"}`}>
                            {label.toUpperCase()} <span className="opacity-60 ml-1 font-mono text-[10px] bg-black/50 px-1.5 py-0.5 rounded">({count})</span>
                        </button>
                    ))}
                </div>

                {/* Progress — checkered flag */}
                <div className="mb-8 p-5 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-xl rise" style={{ animationDelay: "150ms" }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="f-mono text-[10px] text-zinc-400 font-bold tracking-widest uppercase">SEASON PROGRESSION</span>
                        <span className="f-mono text-[11px] text-zinc-400 font-bold"><strong className="text-white text-sm">{completed}</strong> of {totalGP} Grand Prix</span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden bg-white/[0.06] border border-white/5">
                        <div className="h-full rounded-full transition-all duration-1000 relative shadow-[0_0_12px_rgba(225,6,0,0.5)]" style={{ width: `${(completed / totalGP) * 100}%`, background: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>
                            <div className="absolute inset-0 opacity-30 chequered-pattern" />
                        </div>
                    </div>
                    <div className="flex gap-5 mt-3 flex-wrap text-xs f-mono">
                        <span className="text-zinc-400 flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-full bg-[#00E676] inline-block shadow-[0_0_6px_#00E676]" />{completed} Completed</span>
                        <span className="text-zinc-400 flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-full bg-[#E10600] inline-block shadow-[0_0_6px_#E10600]" />{cancelled} Cancelled</span>
                        <span className="text-zinc-400 flex items-center gap-1.5 font-bold"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block shadow-[0_0_6px_#3B82F6]" />{scheduled} Scheduled</span>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-3"><SkeletonTable rows={8} cols={4} /></div>
                ) : (
                    <div className="relative">
                        <div className="absolute left-5 top-0 bottom-0 w-px" style={{ background: "rgba(255,255,255,.08)" }} />
                        <div className="space-y-2">
                            {displayList.map((race, idx) => {
                                const isSprint = race._type === "sprint";
                                const isCompleted = race.status === "COMPLETED";
                                const isCancelled = race.status === "CANCELLED";
                                const isNext = nextGP?.id === race.id;
                                const winner = raceWinners[race.name];
                                const dotColor = isCancelled ? "#52525b" : isCompleted ? "#00E676" : isSprint ? "#F97316" : isNext ? "#E10600" : "#3f3f46";

                                return (
                                    <div key={race.id} className={`relative rise pl-10 sm:pl-12`} style={{ animationDelay: `${idx * 25}ms` }}>
                                        <div className="absolute rounded-full border-2 z-10" style={{
                                            width: "12px", height: "12px",
                                            left: "12px", top: "50%", transform: "translateY(-50%)",
                                            borderColor: "#0a0a0c", backgroundColor: dotColor,
                                            animation: isNext ? "live 1.6s infinite" : "none",
                                        }} />
                                        <div className="flex items-center gap-3 sm:gap-5 rounded-3xl border px-4 sm:px-6 py-4 transition-all duration-300 group shadow-lg hover:border-white/20"
                                            style={{
                                                background: isCancelled ? "rgba(255,255,255,.015)" : isNext ? "linear-gradient(135deg, rgba(225,6,0,.15) 0%, rgba(18,19,24,.9) 100%)" : isCompleted ? "linear-gradient(135deg, rgba(20,21,26,.85) 0%, rgba(10,11,14,.95) 100%)" : "rgba(255,255,255,.02)",
                                                borderColor: isCancelled ? "rgba(255,255,255,.04)" : isNext ? "rgba(225,6,0,.45)" : "rgba(255,255,255,.08)",
                                                opacity: isCancelled ? 0.45 : 1,
                                            }}>
                                            <div className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center f-cond font-black text-sm shadow-inner"
                                                style={{
                                                    background: isNext ? "rgba(225,6,0,.25)" : isCompleted ? "rgba(0,230,118,.12)" : isSprint ? "rgba(249,115,22,.15)" : "rgba(255,255,255,.05)",
                                                    color: isNext ? "#ff6a52" : isCompleted ? "#00E676" : isSprint ? "#F97316" : "#71717a",
                                                }}>
                                                {isSprint ? "⚡" : `R${String(race.roundNumber).padStart(2, "0")}`}
                                            </div>
                                            <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 drop-shadow">{COUNTRY_FLAGS[race.circuit?.country] || "🏁"}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`f-cond font-bold text-lg sm:text-xl uppercase tracking-wide truncate ${isCancelled ? "text-zinc-600 line-through" : isNext ? "text-[#ff6a52]" : "text-white"}`}>{race.name}</span>
                                                    {isSprint && <span className="f-mono text-[9px] font-black bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30 px-2 py-0.5 rounded-md">SPRINT</span>}
                                                    {isNext && countdown && <span className="f-mono text-[10px] font-bold text-[#E10600] px-2 py-0.5 rounded-md bg-red-950/50 border border-red-500/30">{countdown}</span>}
                                                </div>
                                                <p className="f-mono text-xs text-zinc-400 mt-1 truncate">📍 {race.circuit?.name} · {race.date}</p>
                                                {winner && <p className="f-mono text-xs text-zinc-400 mt-1.5 font-semibold">🏆 <span className="text-amber-400 font-black">{winner.driver}</span> <span className="text-zinc-700 mx-1">·</span> {winner.team}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Link href={`/races/${race.id}/weekend`}
                                                    className="f-mono text-xs font-bold text-zinc-300 hover:text-white border border-white/10 hover:border-white/30 bg-black/40 px-3 py-1.5 rounded-xl transition-all">
                                                    Weekend →
                                                </Link>
                                                <Link href={`/races/${race.id}/qualifying`}
                                                    className={`f-mono text-xs font-bold border px-3 py-1.5 rounded-xl bg-black/40 transition-all ${isSprint ? "text-zinc-400 hover:text-[#F97316] border-white/10 hover:border-[#F97316]/40" : "text-zinc-400 hover:text-amber-400 border-white/10 hover:border-amber-400/40"}`}>
                                                    {isSprint ? "S-Quali →" : "Quali →"}
                                                </Link>
                                                {isCompleted && (
                                                    <Link href={`/races/${race.id}/results`}
                                                        className="f-mono text-xs font-bold text-zinc-400 hover:text-[#ff6a52] border border-white/10 hover:border-[#E10600]/40 bg-black/40 px-3 py-1.5 rounded-xl transition-all">Results →</Link>
                                                )}
                                                <span className="f-mono text-[10px] px-2.5 py-1 rounded-lg border font-black hidden sm:inline-block"
                                                    style={{
                                                        color: isCompleted ? "#00E676" : isCancelled ? "#71717a" : isNext ? "#ff6a52" : isSprint ? "#F97316" : "#71717a",
                                                        background: isCompleted ? "rgba(0,230,118,.15)" : isNext ? "rgba(225,6,0,.15)" : isSprint ? "rgba(249,115,22,.15)" : "rgba(255,255,255,.03)",
                                                        borderColor: isCompleted ? "rgba(0,230,118,.3)" : isNext ? "rgba(225,6,0,.3)" : isSprint ? "rgba(249,115,22,.3)" : "rgba(255,255,255,.06)",
                                                    }}>
                                                    {isCompleted ? "✓" : isCancelled ? "✗" : isNext ? "NEXT" : "—"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {!loading && <p className="text-center f-mono text-[10px] text-zinc-700 mt-8 tracking-widest">{completed} COMPLETED · {scheduled} UPCOMING · {sprintRaces.length} SPRINTS</p>}
            </main>
        </div>
    );
}