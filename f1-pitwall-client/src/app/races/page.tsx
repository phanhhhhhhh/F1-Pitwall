"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";
import RaceWeekendWidget from "../components/RaceWeekendWidget";
import Link from "next/link";
import { BASE_URL as API } from "../lib/api-client";
import { SkeletonTable } from "../components/LoadingSkeleton";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Object.entries(wData).forEach(([name, w]: [string, any]) => { map[name] = { driver: w.driverName, team: w.teamName }; });
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
        GP: "border-[#E10600] bg-[#E10600]/15 text-[#ff6a52]",
        SPRINT: "border-[#F97316] bg-[#F97316]/15 text-orange-300",
        COMPLETED: "border-[#00E676] bg-[#00E676]/15 text-emerald-300",
        SCHEDULED: "border-[#3B82F6] bg-[#3B82F6]/15 text-blue-300",
        CANCELLED: "border-zinc-500 bg-zinc-700/30 text-zinc-300",
        ALL: "border-white/40 bg-white/10 text-white",
    };

    return (
        <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,400;0,500;0,600;0,700;1,600;1,800&family=Saira+Condensed:wght@500;600;700;800;900&display=swap');
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        @keyframes grid-pan{from{background-position:0 0}to{background-position:0 80px}}
        @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes streak{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(60vw);opacity:0}}
        @keyframes livedot{0%,100%{box-shadow:0 0 0 0 rgba(225,6,0,.6)}70%{box-shadow:0 0 0 6px rgba(225,6,0,0)}}
        .rise{animation:rise .4s cubic-bezier(.16,1,.3,1) both}
      `}</style>

            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0" style={{ background: "radial-gradient(110% 70% at 40% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
                <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 15%,black,transparent 80%)" }} />
                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)" }} />
                <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="absolute h-px" style={{ width: `${120 + i * 50}px`, top: `${15 + i * 22}%`, left: "-10%", background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: `streak ${5 + i * 1.4}s linear infinite`, animationDelay: `${i * 1.3}s` }} />)}
            </div>

            <Navbar />

            <main className="relative z-10 max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">

                <div className="mb-8 rise">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
                        <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">2026 SEASON · {mainRaces.length} GP · {sprintRaces.length} SPRINTS</span>
                    </div>
                    <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(48px,8vw,84px)" }}>
                        <span className="block text-white">RACE</span>
                        <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>CALENDAR</span>
                    </h1>
                </div>

                <div className="mb-8 rise" style={{ animationDelay: "50ms" }}><RaceWeekendWidget /></div>

                <div className="flex flex-wrap gap-2 mb-8 rise" style={{ animationDelay: "100ms" }}>
                    {TABS.map(({ key, label, count }) => (
                        <button key={key} onClick={() => setFilter(key)}
                            className={`px-4 py-1.5 rounded-full f-cond text-xs font-bold tracking-wide border transition-all ${filter === key ? TAB_ACTIVE[key] : "border-white/10 text-zinc-600 hover:border-white/25 hover:text-zinc-400"}`}>
                            {label} <span className="opacity-50 ml-1">{count}</span>
                        </button>
                    ))}
                </div>

                {/* Progress — checkered flag */}
                <div className="mb-8 rise" style={{ animationDelay: "150ms" }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="f-mono text-[10px] text-zinc-500 tracking-widest">SEASON PROGRESS</span>
                        <span className="f-mono text-[10px] text-zinc-500"><span className="text-white">{completed}</span> / {totalGP} GP</span>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.06)" }}>
                        <div className="h-full rounded-full transition-all duration-1000 relative" style={{ width: `${(completed / totalGP) * 100}%`, background: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>
                            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "repeating-linear-gradient(45deg,#000 0 4px,transparent 4px 8px)" }} />
                        </div>
                    </div>
                    <div className="flex gap-4 mt-2 flex-wrap">
                        <span className="f-mono text-[10px] text-zinc-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#00E676] inline-block" />{completed} done</span>
                        <span className="f-mono text-[10px] text-zinc-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#E10600] inline-block" />{cancelled} cancelled</span>
                        <span className="f-mono text-[10px] text-zinc-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />{scheduled} upcoming</span>
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
                                    <div key={race.id} className={`relative rise ${isSprint ? "pl-16" : "pl-12"}`} style={{ animationDelay: `${idx * 25}ms` }}>
                                        <div className="absolute rounded-full border-2 z-10" style={{
                                            width: isSprint ? "10px" : "14px", height: isSprint ? "10px" : "14px",
                                            left: isSprint ? "16px" : "13px", top: "50%", transform: "translateY(-50%)",
                                            borderColor: "#0a0a0c", backgroundColor: dotColor,
                                            animation: isNext ? "livedot 1.6s infinite" : "none",
                                        }} />
                                        <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border px-4 sm:px-5 py-3.5 transition-all group"
                                            style={{
                                                background: isCancelled ? "rgba(255,255,255,.015)" : isNext ? "rgba(225,6,0,.08)" : isCompleted ? "rgba(18,18,21,.7)" : isSprint ? "rgba(249,115,22,.06)" : "rgba(255,255,255,.02)",
                                                borderColor: isCancelled ? "rgba(255,255,255,.04)" : isNext ? "rgba(225,6,0,.35)" : "rgba(255,255,255,.07)",
                                                opacity: isCancelled ? 0.45 : 1,
                                                borderLeft: isCompleted && !isSprint ? "3px solid rgba(0,230,118,.5)" : isNext ? "3px solid #E10600" : isSprint ? "3px solid rgba(249,115,22,.5)" : undefined,
                                                borderRadius: (isCompleted || isNext || isSprint) ? "0 16px 16px 0" : undefined,
                                            }}>
                                            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center f-cond font-black text-sm"
                                                style={{
                                                    background: isNext ? "rgba(225,6,0,.2)" : isCompleted ? "rgba(0,230,118,.1)" : isSprint ? "rgba(249,115,22,.12)" : "rgba(255,255,255,.04)",
                                                    color: isNext ? "#ff6a52" : isCompleted ? "#00E676" : isSprint ? "#F97316" : "#71717a",
                                                }}>
                                                {isSprint ? "⚡" : `R${race.roundNumber}`}
                                            </div>
                                            <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{COUNTRY_FLAGS[race.circuit?.country] || "🏁"}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`f-cond font-bold text-base sm:text-lg uppercase tracking-wide truncate ${isCancelled ? "text-zinc-600 line-through" : isNext ? "text-[#ff6a52]" : "text-white"}`}>{race.name}</span>
                                                    {isSprint && <span className="f-mono text-[9px] bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/25 px-1.5 py-0.5 rounded">SPRINT</span>}
                                                    {isNext && countdown && <span className="f-mono text-[10px] text-[#E10600]/80">{countdown}</span>}
                                                </div>
                                                <p className="f-mono text-[11px] text-zinc-600 mt-0.5 truncate">{race.circuit?.name} · {race.date}</p>
                                                {winner && <p className="f-mono text-[11px] text-zinc-500 mt-1">🏆 <span className="text-[#FFD23F] font-bold">{winner.driver}</span> <span className="text-zinc-700 mx-1">·</span> {winner.team}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Link href={`/races/${race.id}/weekend`}
                                                    className="f-mono text-[11px] text-zinc-500 hover:text-blue-400 border border-white/10 hover:border-blue-400/40 px-3 py-1.5 rounded-lg transition-all">
                                                    Weekend →
                                                </Link>
                                                {(isCompleted || race.status === "SCHEDULED") && (
                                                    <Link href={`/races/${race.id}/qualifying`}
                                                        className={`f-mono text-[11px] border px-3 py-1.5 rounded-lg transition-all ${isSprint ? "text-zinc-500 hover:text-[#F97316] border-white/10 hover:border-[#F97316]/40" : "text-zinc-500 hover:text-[#FFD23F] border-white/10 hover:border-[#FFD23F]/40"}`}>
                                                        {isSprint ? "⚡ S-Quali →" : "Quali →"}
                                                    </Link>
                                                )}
                                                {isCompleted && (
                                                    <Link href={`/races/${race.id}/results`}
                                                        className="f-mono text-[11px] text-zinc-500 hover:text-[#ff6a52] border border-white/10 hover:border-[#E10600]/40 px-3 py-1.5 rounded-lg transition-all">Results →</Link>
                                                )}
                                                <span className="f-mono text-[10px] px-2.5 py-1 rounded-lg border font-bold"
                                                    style={{
                                                        color: isCompleted ? "#00E676" : isCancelled ? "#71717a" : isNext ? "#ff6a52" : isSprint ? "#F97316" : "#71717a",
                                                        background: isCompleted ? "rgba(0,230,118,.1)" : isNext ? "rgba(225,6,0,.1)" : isSprint ? "rgba(249,115,22,.1)" : "rgba(255,255,255,.03)",
                                                        borderColor: isCompleted ? "rgba(0,230,118,.2)" : isNext ? "rgba(225,6,0,.2)" : isSprint ? "rgba(249,115,22,.2)" : "rgba(255,255,255,.06)",
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
                {!loading && <p className="text-center f-mono text-[10px] text-zinc-700 mt-8 tracking-widest">{completed} COMPLETED · {scheduled} REMAINING · {cancelled} CANCELLED</p>}
            </main>
        </div>
    );
}