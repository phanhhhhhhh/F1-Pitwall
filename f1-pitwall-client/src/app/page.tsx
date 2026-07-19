"use client";

import { useEffect, useState } from "react";
import { authFetch } from "./lib/pitwall-auth";
import { BASE_URL as API } from "./lib/api-client";
import { useSeason } from "./context/SeasonContext";
import Navbar from "./components/Navbar";
import NextRaceCard from "./components/NextRaceCard";
import TimingTower from "./components/TimingTower";
import StatTilesGrid from "./components/StatTilesGrid";
import SeasonProgress from "./components/SeasonProgress";
import RaceCalendarSection from "./components/RaceCalendarSection";
import RaceWeekendWidget from "./components/RaceWeekendWidget";
import { useCountUp } from "./lib/f1-theme";
import type { DriverStanding, RaceInfo } from "./types/f1";

export default function Home() {
  const { season } = useSeason();
  const [stats, setStats] = useState({ drivers: 0, teams: 0, circuits: 0 });
  const [sprintCount, setSprintCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allRaces, setAllRaces] = useState<RaceInfo[]>([]);
  const [calendar, setCalendar] = useState<RaceInfo[]>([]);
  const [standings, setStandings] = useState<DriverStanding[]>([]);
  const [winners, setWinners] = useState<Record<string, { driver: string; team: string }>>({});
  const [nextRace, setNextRace] = useState<RaceInfo | null>(null);
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0, raceDay: false });
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [season]);

  useEffect(() => {
    if (!nextRace) return;
    const target = new Date(nextRace.date + "T00:00:00Z").getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCd({ d: 0, h: 0, m: 0, s: 0, raceDay: true }); return; }
      setCd({
        d: Math.floor(diff / 864e5),
        h: Math.floor((diff % 864e5) / 36e5),
        m: Math.floor((diff % 36e5) / 6e4),
        s: Math.floor((diff % 6e4) / 1e3),
        raceDay: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRace]);

  const fetchData = async () => {
    setFetchError(null);
    const errors: string[] = [];
    try {

    // Run all 4 core calls independently so one failure doesn't blank the rest
    const [driversRes, teamsRes, racesRes, circuitsRes] = await Promise.allSettled([
      authFetch(`${API}/api/drivers`),
      authFetch(`${API}/api/teams`),
      authFetch(`${API}/api/races/season/${season}`),
      authFetch(`${API}/api/circuits`),
    ]);

    try {
      if (driversRes.status === "fulfilled") {
        const drivers = await driversRes.value.json();
        setStats(s => ({ ...s, drivers: drivers.length }));
      } else { errors.push(`Drivers: ${driversRes.reason?.message || driversRes.reason}`); }
    } catch { errors.push("Drivers: parse error"); }

    try {
      if (teamsRes.status === "fulfilled") {
        const teams = await teamsRes.value.json();
        setStats(s => ({ ...s, teams: teams.length }));
      } else { errors.push(`Teams: ${teamsRes.reason?.message || teamsRes.reason}`); }
    } catch { errors.push("Teams: parse error"); }

    try {
      if (racesRes.status === "fulfilled") {
        const races: RaceInfo[] = await racesRes.value.json();
        const gp = races.filter((x) => !x.name.toLowerCase().includes("sprint"));
        const sp = races.filter((x) => x.name.toLowerCase().includes("sprint"));
        setSprintCount(sp.length);
        setAllRaces(races);
        setCalendar(gp.slice(0, 6));
        const today = new Date().toISOString().split("T")[0];
        const up = gp.filter((x: RaceInfo) => x.status === "SCHEDULED" && x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        if (up.length) setNextRace(up[0]);
      } else { errors.push(`Races: ${racesRes.reason?.message || racesRes.reason}`); }
    } catch { errors.push("Races: parse error"); }

    try {
      if (circuitsRes.status === "fulfilled") {
        const circuits = await circuitsRes.value.json();
        setStats(s => ({ ...s, circuits: circuits.length }));
      } else { errors.push(`Circuits: ${circuitsRes.reason?.message || circuitsRes.reason}`); }
    } catch { errors.push("Circuits: parse error"); }

    if (errors.length) setFetchError(errors.join(" · "));

    try {
      const w = await (await authFetch(`${API}/api/race-results/winners/${season}`)).json();
      const m: Record<string, { driver: string; team: string }> = {};
      Object.entries(w as Record<string, { driverName: string; driverLastName: string; teamName: string }>).forEach(([n, v]) => { m[n] = { driver: v.driverLastName || v.driverName, team: v.teamName }; });
      setWinners(m);
    } catch { }
    try {
      const st = await (await authFetch(`${API}/api/race-results/standings/drivers/${season}`)).json();
      setStandings(Array.isArray(st) ? st.slice(0, 6) : []);
    } catch { }
    } catch (e) { console.error("[Overview] unexpected error:", e); }
    finally { setLoading(false); }
  };

  const gpRaces = allRaces.filter(r => !r.name.toLowerCase().includes("sprint"));
  const totalGP = gpRaces.length || 22;
  const gpDone = gpRaces.filter(r => r.status === "COMPLETED").length;
  const gpCancel = gpRaces.filter(r => r.status === "CANCELLED").length;
  const sprintDone = allRaces.filter(r => r.name.toLowerCase().includes("sprint") && r.status === "COMPLETED").length;
  const pct = (gpDone / totalGP) * 100;

  const dN = useCountUp(stats.drivers, 1000, 300);
  const tN = useCountUp(stats.teams, 1000, 380);
  const gN = useCountUp(totalGP, 1000, 460);
  const cN = useCountUp(stats.circuits, 1000, 540);

  const statTiles = [
    { label: "DRIVERS", value: dN, sub: `${season} grid`, href: "/drivers", icon: "🏎" },
    { label: "TEAMS", value: tN, sub: "constructors", href: "/teams", icon: "🏗" },
    { label: "GRAND PRIX", value: gN, sub: `${sprintCount} sprints`, href: "/races", icon: "🏁" },
    { label: "CIRCUITS", value: cN, sub: "worldwide", href: "/circuits", icon: "🗺" },
  ];

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <style>{`
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-disp{font-family:'Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        @keyframes grid-pan{from{background-position:0 0}to{background-position:0 80px}}
        @keyframes glow{0%,100%{opacity:.4}50%{opacity:.9}}
        @keyframes live{0%,100%{box-shadow:0 0 0 0 rgba(225,6,0,.6)}70%{box-shadow:0 0 0 6px rgba(225,6,0,0)}}
        @keyframes shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}
        @keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scan{0%{transform:translateY(-100%);opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translateY(2000%);opacity:0}}
        @keyframes streak{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(60vw);opacity:0}}
        .rise{animation:rise .55s cubic-bezier(.16,1,.3,1) both}
        .shimmer{animation:shimmer 2.6s ease-in-out infinite}
        .chamfer{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
        .tower-row:hover{background:rgba(255,255,255,.03)}
        .tower-row:hover .pos{color:#E10600}
      `}</style>

      {/* Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 15% -10%, rgba(225,6,0,.10), transparent 55%), radial-gradient(90% 60% at 100% 0%, rgba(120,10,10,.10), transparent 50%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 30%,black,transparent 80%)" }} />
        <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)" }} />
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="absolute h-px" style={{ width: `${120 + i * 40}px`, top: `${12 + i * 18}%`, left: "-10%", background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: `streak ${5 + i * 1.4}s linear infinite`, animationDelay: `${i * 1.3}s` }} />
        ))}
      </div>

      <Navbar />

      {/* API error banner */}
      {fetchError && (
        <div className="relative z-20 bg-red-950/60 border-b border-red-500/30 px-5 py-2 text-center">
          <span className="f-mono text-[11px] text-red-400">⚠ API error — {fetchError}</span>
        </div>
      )}

      {/* Broadcast ticker */}
      <div className="relative z-10 border-b border-white/5" style={{ background: "rgba(255,255,255,.015)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-9 flex items-center justify-between text-[11px] f-mono tracking-widest">
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E10600]" style={{ animation: "live 1.6s infinite" }} />
            <span className="text-[#E10600] font-bold">LIVE FEED</span>
            <span className="text-zinc-700">{"//"}</span>
            <span className="text-zinc-500">FORMULA 1 · SEASON {season}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-zinc-600">
            <span>RND <span className="text-zinc-300">{nextRace?.roundNumber || gpDone}</span>/{totalGP}</span>
            <span className="text-zinc-800">|</span>
            <span>{gpDone} <span className="text-zinc-700">COMPLETED</span></span>
            <span className="text-zinc-800">|</span>
            <span className="text-[#00E676]">● SYSTEMS NOMINAL</span>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* HERO */}
        <section className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-5">
          {/* Title */}
          <div className="rise relative overflow-hidden rounded-2xl border border-white/5 chamfer" style={{ background: "linear-gradient(135deg,rgba(20,20,24,.9),rgba(10,10,12,.6))", padding: "clamp(1.5rem,4vw,2.5rem)" }}>
            <div className="absolute top-0 right-0 f-cond font-black leading-none select-none" style={{ fontSize: "clamp(140px,22vw,300px)", color: "rgba(255,255,255,.018)", lineHeight: .8 }}>26</div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
                <span className="f-mono text-[11px] tracking-[0.35em] text-zinc-500">COMMAND CENTER</span>
              </div>
              <h1 className="f-cond font-black leading-[0.82] tracking-tight" style={{ fontSize: "clamp(56px,9vw,118px)" }}>
                <span className="block text-white">PIT<span style={{ color: "#E10600" }}>WALL</span></span>
                <span className="block text-zinc-700" style={{ fontSize: "0.42em", letterSpacing: ".06em" }}>RACE OPERATIONS</span>
              </h1>
              <div className="mt-5 h-[3px] w-full max-w-md overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.06)" }}>
                <div className="h-full" style={{ width: "60%", background: "linear-gradient(90deg,#E10600,#ff5a3c)" }} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[{ k: "S", c: "#DA291C", l: "SOFT" }, { k: "M", c: "#FFD200", l: "MEDIUM" }, { k: "H", c: "#EDEDED", l: "HARD" }].map(t => (
                  <div key={t.k} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/8" style={{ background: "rgba(255,255,255,.02)" }}>
                    <span className="w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: t.c }} />
                    <span className="f-mono text-[10px] tracking-wider text-zinc-400">{t.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Next race */}
          <NextRaceCard nextRace={nextRace} countdown={cd} />
        </section>

        {/* BENTO */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Timing tower */}
          <TimingTower standings={standings} loading={loading} />

          {/* Stat tiles 2x2 */}
          <StatTilesGrid tiles={statTiles} />

          {/* Season progress */}
          <SeasonProgress
            gpDone={gpDone}
            totalGP={totalGP}
            sprintDone={sprintDone}
            sprintCount={sprintCount}
            gpCancel={gpCancel}
            pct={pct}
          />

          {/* Race weekend widget */}
          <section className="rise" style={{ animationDelay: "240ms" }}>
            <RaceWeekendWidget />
          </section>

          {/* Recent calendar */}
          <RaceCalendarSection calendar={calendar} winners={winners} loading={loading} />
        </div>

        <p className="text-center f-mono text-[10px] text-zinc-700 mt-8 tracking-widest">F1 PITWALL · BROADCAST-GRADE TELEMETRY · SEASON {season}</p>
      </main>
    </div>
  );
}
