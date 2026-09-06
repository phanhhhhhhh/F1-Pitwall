"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
import RaceControlBanner from "./components/RaceControlBanner";
import PodiumSpotlight from "./components/PodiumSpotlight";
import LiveTrackMap from "./components/LiveTrackMap";
import LightsOutGantry from "./components/LightsOutGantry";
import PitStop3DGame from "./components/PitStop3DGame";
import { useCountUp } from "./lib/f1-theme";
import type { CircuitInfo, DriverStanding, RaceInfo } from "./types/f1";

// Dynamic 3D WebGL Inspector
const F1CarInspector3D = dynamic(() => import("./components/F1CarInspector3D"), { ssr: false });

export default function Home() {
  const { season } = useSeason();
  const [stats, setStats] = useState({ drivers: 0, teams: 0, circuits: 0 });
  const [sprintCount, setSprintCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allRaces, setAllRaces] = useState<RaceInfo[]>([]);
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [calendar, setCalendar] = useState<RaceInfo[]>([]);
  const [standings, setStandings] = useState<DriverStanding[]>([]);
  const [winners, setWinners] = useState<Record<string, { driver: string; team: string }>>({});
  const [nextRace, setNextRace] = useState<RaceInfo | null>(null);
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0, raceDay: false });
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const fetchData = useCallback(async () => {
    setFetchError(null);
    const errors: string[] = [];
    try {
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
          const list: CircuitInfo[] = await circuitsRes.value.json();
          setCircuits(list);
          setStats(s => ({ ...s, circuits: list.length }));
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
        setStandings(Array.isArray(st) ? st : []);
      } catch { }
    } catch (e) { console.error("[Overview] unexpected error:", e); }
    finally { setLoading(false); }
  }, [season]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const gpRaces = allRaces.filter(r => !r.name.toLowerCase().includes("sprint"));
  const totalGP = gpRaces.length || 24;
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
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 15% -10%, rgba(225,6,0,.15), transparent 55%), radial-gradient(90% 60% at 100% 0%, rgba(255,128,0,.10), transparent 50%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 30%,black,transparent 80%)" }} />
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.92)" }} />
      </div>

      <Navbar />

      {fetchError && (
        <div className="relative z-20 bg-red-950/70 border-b border-red-500/30 px-5 py-2 text-center">
          <span className="f-mono text-[11px] text-red-400">⚠ API notice — {fetchError}</span>
        </div>
      )}

      {/* Broadcast ticker */}
      <div className="relative z-10 border-b border-white/[0.08] bg-black/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center justify-between text-[11px] f-mono tracking-widest">
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#E10600] live-pulse" />
            <span className="text-[#E10600] font-black tracking-widest">PIT WALL OS 2.0</span>
            <span className="text-zinc-700">{"//"}</span>
            <span className="text-zinc-300 font-bold">FIA FORMULA 1 WORLD CHAMPIONSHIP · {season}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-zinc-400 font-bold">
            <span>RND <span className="text-white">{nextRace?.roundNumber || gpDone}</span>/{totalGP}</span>
            <span className="text-zinc-800">|</span>
            <span>{gpDone} <span className="text-zinc-500">COMPLETED</span></span>
            <span className="text-zinc-800">|</span>
            <span className="text-[#00E676] font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
              SYSTEMS ONLINE
            </span>
          </div>
        </div>
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* FIA Race Control Status & Weather Banner */}
        <RaceControlBanner />

        {/* HERO SECTION */}
        <section className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-8">
          {/* Title Card */}
          <div className="rise relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black p-6 sm:p-8 shadow-2xl">
            {/* Background racing watermark */}
            <div className="absolute top-0 right-2 f-orbitron font-black leading-none select-none text-[130px] sm:text-[180px] text-white/[0.02] pointer-events-none">
              {season.toString().slice(-2)}
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block w-8 h-[3px] bg-[#E10600] rounded-full shadow-[0_0_10px_#E10600]" />
                <span className="f-mono text-[11px] tracking-[0.35em] text-red-500 font-black uppercase">RACE ENGINEERING SUITE</span>
              </div>
              <h1 className="f-cond font-black leading-[0.85] tracking-tight text-5xl sm:text-7xl lg:text-8xl uppercase">
                <span className="block text-white">PIT<span className="text-[#E10600]">WALL</span></span>
                <span className="block text-zinc-600 text-3xl sm:text-4xl tracking-normal mt-1">OPERATIONS HUB</span>
              </h1>
              <div className="mt-5 h-[3px] w-full max-w-md overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-3/4 bg-gradient-to-r from-[#E10600] via-[#FF8000] to-[#FFD200]" />
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {[
                  { k: "S", c: "#ff2a2a", l: "SOFT" },
                  { k: "M", c: "#FFD200", l: "MEDIUM" },
                  { k: "H", c: "#EDEDED", l: "HARD" },
                  { k: "I", c: "#00E676", l: "INTER" },
                  { k: "W", c: "#00E5FF", l: "WET" },
                ].map(t => (
                  <div key={t.k} className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 bg-black/60 shadow-inner hover:border-white/20 transition-all">
                    <span className="w-3 h-3 rounded-full border-2" style={{ borderColor: t.c, background: `${t.c}40`, boxShadow: `0 0 6px ${t.c}80` }} />
                    <span className="f-mono text-[10px] tracking-wider text-zinc-300 font-bold">{t.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Next race countdown */}
          <NextRaceCard nextRace={nextRace} countdown={cd} />
        </section>

        {/* ── 3D F1 CAR & AERO WIND TUNNEL INSPECTOR ── */}
        <section className="mb-8">
          <F1CarInspector3D />
        </section>

        {/* TOP 3 PODIUM SPOTLIGHT */}
        {standings.length >= 3 && (
          <PodiumSpotlight standings={standings} />
        )}

        {/* BENTO GRID */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <TimingTower standings={standings.slice(0, 6)} loading={loading} />
          <StatTilesGrid tiles={statTiles} />
          <SeasonProgress
            gpDone={gpDone}
            totalGP={totalGP}
            sprintDone={sprintDone}
            sprintCount={sprintCount}
            gpCancel={gpCancel}
            pct={pct}
          />
        </div>

        {/* LIVE TRACK RADAR & INTERACTIVE PIT STOP CHALLENGE */}
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 mb-8">
          {/* Opens on the circuit the championship is actually heading to next */}
          <LiveTrackMap
            circuitId={nextRace?.circuit?.id}
            circuits={circuits}
            demoDrivers={standings}
          />
          <PitStop3DGame season={season} />
        </div>

        {/* STARTING GANTRY REACTION TESTER */}
        <div className="mb-8">
          <LightsOutGantry />
        </div>

        {/* RACE WEEKEND & CALENDAR */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <RaceWeekendWidget />
          <RaceCalendarSection calendar={calendar} winners={winners} loading={loading} />
        </div>
      </main>
    </div>
  );
}
