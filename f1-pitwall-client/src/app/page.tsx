"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "./lib/pitwall-auth";
import { BASE_URL as API } from "./lib/api-client";
import Navbar from "./components/Navbar";
import RaceWeekendWidget from "./components/RaceWeekendWidget";
import Link from "next/link";

const COUNTRY_FLAGS: Record<string, string> = {
  "Australia": "🇦🇺", "China": "🇨🇳", "Japan": "🇯🇵", "Bahrain": "🇧🇭", "Saudi Arabia": "🇸🇦",
  "United States": "🇺🇸", "Canada": "🇨🇦", "Monaco": "🇲🇨", "Spain": "🇪🇸", "Austria": "🇦🇹",
  "United Kingdom": "🇬🇧", "Belgium": "🇧🇪", "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹",
  "Azerbaijan": "🇦🇿", "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷", "UAE": "🇦🇪", "Qatar": "🇶🇦",
};

function useCountUp(target: number, duration = 1100, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    const t = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setValue(Math.round((1 - Math.pow(1 - p, 4)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState({ drivers: 0, teams: 0, circuits: 0 });
  const [sprintCount, setSprintCount] = useState(0);
  const [loading, setLoading] = useState(true);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [allRaces, setAllRaces] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [winners, setWinners] = useState<Record<string, { driver: string; team: string }>>({});
  const [nextRace, setNextRace] = useState<any>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [cd, setCd] = useState({ d: 0, h: 0, m: 0, s: 0, raceDay: false });

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, []);

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
    try {
      const [d, t, r, c] = await Promise.all([
        authFetch(`${API}/api/drivers`), authFetch(`${API}/api/teams`),
        authFetch(`${API}/api/races/season/2026`), authFetch(`${API}/api/circuits`),
      ]);
      const [drivers, teams, races, circuits] = await Promise.all([d.json(), t.json(), r.json(), c.json()]);
      const gp = races.filter((x) => !x.name.toLowerCase().includes("sprint"));
      const sp = races.filter((x) => x.name.toLowerCase().includes("sprint"));
      setStats({ drivers: drivers.length, teams: teams.length, circuits: circuits.length });
      setSprintCount(sp.length);
      setAllRaces(races);
      setCalendar(gp.slice(0, 6));
      const today = new Date().toISOString().split("T")[0];
      const up = gp.filter((x) => x.status === "SCHEDULED" && x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      if (up.length) setNextRace(up[0]);
      try {
        const w = await (await authFetch(`${API}/api/race-results/winners/2026`)).json();
        const m: Record<string, { driver: string; team: string }> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(w).forEach(([n, v]: [string, any]) => { m[n] = { driver: v.driverLastName || v.driverName, team: v.teamName }; });
        setWinners(m);
      } catch { }
      try {
        const st = await (await authFetch(`${API}/api/race-results/standings/drivers/2026`)).json();
        setStandings(Array.isArray(st) ? st.slice(0, 6) : []);
      } catch { }
    } catch (e) { console.error(e); }
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

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,400;0,500;0,600;0,700;1,600;1,800&family=Saira+Condensed:wght@500;600;700;800;900&display=swap');
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

      {/* Broadcast ticker */}
      <div className="relative z-10 border-b border-white/5" style={{ background: "rgba(255,255,255,.015)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-9 flex items-center justify-between text-[11px] f-mono tracking-widest">
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#E10600]" style={{ animation: "live 1.6s infinite" }} />
            <span className="text-[#E10600] font-bold">LIVE FEED</span>
            <span className="text-zinc-700">{"//"}</span>
            <span className="text-zinc-500">FORMULA 1 · SEASON 2026</span>
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
          <div className="rise relative overflow-hidden rounded-2xl border border-[#E10600]/20" style={{ background: "linear-gradient(160deg,rgba(225,6,0,.08),rgba(15,15,18,.85))", animationDelay: "80ms" }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg,transparent,#E10600,transparent)" }} />
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="f-mono text-[11px] tracking-[0.3em] text-[#E10600] font-bold">NEXT RACE</span>
                {nextRace && <span className="f-mono text-[11px] text-zinc-600">RND {nextRace.roundNumber}</span>}
              </div>
              {nextRace ? (
                <>
                  <div className="flex items-center gap-3 mt-2 mb-5">
                    <span className="text-4xl">{COUNTRY_FLAGS[nextRace.circuit?.country] || "🏁"}</span>
                    <div className="min-w-0">
                      <h2 className="f-cond font-bold text-2xl leading-tight text-white truncate">{nextRace.name}</h2>
                      <p className="f-mono text-[11px] text-zinc-500 truncate">{nextRace.circuit?.name}</p>
                    </div>
                  </div>
                  {cd.raceDay ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="f-cond font-black text-3xl text-[#E10600]" style={{ animation: "glow 1.2s infinite" }}>● RACE DAY</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 mt-auto">
                      {[{ v: cd.d, l: "DAYS" }, { v: cd.h, l: "HRS" }, { v: cd.m, l: "MIN" }, { v: cd.s, l: "SEC" }].map(u => (
                        <div key={u.l} className="rounded-lg border border-white/8 text-center py-3" style={{ background: "rgba(0,0,0,.3)" }}>
                          <div className="f-cond font-black text-3xl tabular-nums leading-none" style={{ color: u.l === "SEC" ? "#E10600" : "#fff" }}>{String(u.v).padStart(2, "0")}</div>
                          <div className="f-mono text-[9px] tracking-widest text-zinc-600 mt-1.5">{u.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="f-mono text-[11px] text-zinc-600 mt-4 text-center">{nextRace.date}</p>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-600 f-mono text-sm">Season complete</div>
              )}
            </div>
          </div>
        </section>

        {/* BENTO */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Timing tower */}
          <section className="lg:col-span-2 rise relative overflow-hidden rounded-2xl border border-white/5" style={{ background: "rgba(18,18,21,.7)", animationDelay: "120ms" }}>
            <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
              <div className="h-full w-1/3 shimmer" style={{ background: "linear-gradient(90deg,transparent,rgba(225,6,0,.6),transparent)" }} />
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-1 h-5 bg-[#E10600] rounded-full" />
                <h3 className="f-cond font-bold text-lg tracking-wide">CHAMPIONSHIP STANDINGS</h3>
                <span className="f-mono text-[10px] text-zinc-600 border border-white/10 rounded px-1.5 py-0.5">TOP 6</span>
              </div>
              <Link href="/standings" className="f-mono text-[11px] text-[#E10600] hover:text-[#ff5a3c] transition-colors group">
                FULL TABLE <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
            <div className="relative">
              {loading ? (
                <div className="p-4 space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
              ) : standings.length === 0 ? (
                <div className="py-12 text-center f-mono text-sm text-zinc-600">No standings yet · sync a race first</div>
              ) : (
                <>
                  <div className="absolute left-0 right-0 h-12 pointer-events-none" style={{ background: "linear-gradient(180deg,rgba(225,6,0,.07),transparent)", animation: "scan 7s linear infinite" }} />
                  {standings.map((s, i) => {
                    const col = s.teamColor || "#666";
                    return (
                      <div key={s.driverId} className="tower-row relative flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 border-b border-white/[0.04] transition-colors">
                        <span className="pos f-cond font-black italic text-3xl sm:text-4xl w-9 text-center tabular-nums transition-colors" style={{ color: i === 0 ? "#E10600" : "#3f3f46" }}>{s.position}</span>
                        <span className="w-1 h-9 rounded-full flex-shrink-0" style={{ background: col, boxShadow: `0 0 10px ${col}80` }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="f-cond font-bold text-base sm:text-lg text-white truncate uppercase tracking-wide">{s.driverName}</span>
                            {s.wins > 0 && <span className="f-mono text-[10px] text-[#FFD200] flex-shrink-0">🏆{s.wins}</span>}
                          </div>
                          <span className="f-mono text-[11px]" style={{ color: col }}>{s.teamName}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="f-cond font-black text-2xl tabular-nums leading-none" style={{ color: i === 0 ? "#E10600" : "#fff" }}>{Math.round(s.totalPoints)}</div>
                          <div className="f-mono text-[10px] text-zinc-600">{i === 0 ? "PTS · LEADER" : `-${Math.round(s.gapToLeader)} PTS`}</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          {/* Stat tiles 2x2 */}
          <section className="grid grid-cols-2 gap-3 rise" style={{ animationDelay: "160ms" }}>
            {[
              { label: "DRIVERS", value: dN, sub: "2026 grid", href: "/drivers", icon: "🏎" },
              { label: "TEAMS", value: tN, sub: "constructors", href: "/teams", icon: "🏗" },
              { label: "GRAND PRIX", value: gN, sub: `${sprintCount} sprints`, href: "/races", icon: "🏁" },
              { label: "CIRCUITS", value: cN, sub: "worldwide", href: "/circuits", icon: "🗺" },
            ].map(s => (
              <Link key={s.label} href={s.href}
                className="group relative overflow-hidden rounded-2xl border border-white/5 chamfer p-4 flex flex-col justify-between transition-all hover:border-[#E10600]/30"
                style={{ background: "rgba(18,18,21,.7)", minHeight: 130 }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "radial-gradient(circle at 50% 0%,rgba(225,6,0,.12),transparent 65%)" }} />
                <div className="relative flex items-center justify-between">
                  <span className="f-mono text-[10px] tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">{s.label}</span>
                  <span className="text-base opacity-30 group-hover:opacity-70 transition-opacity">{s.icon}</span>
                </div>
                <div className="relative">
                  <div className="f-cond font-black text-5xl leading-none tabular-nums text-white group-hover:text-[#E10600] transition-colors">{s.value}</div>
                  <div className="f-mono text-[10px] text-zinc-600 mt-1">{s.sub}</div>
                </div>
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E10600] scale-x-0 group-hover:scale-x-100 origin-left transition-transform" />
              </Link>
            ))}
          </section>

          {/* Season track */}
          <section className="lg:col-span-2 rise relative overflow-hidden rounded-2xl border border-white/5 p-5" style={{ background: "rgba(18,18,21,.7)", animationDelay: "200ms" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-1 h-5 bg-[#E10600] rounded-full" />
                <h3 className="f-cond font-bold text-lg tracking-wide">SEASON PROGRESS</h3>
              </div>
              <div className="flex items-center gap-3 f-mono text-[11px]">
                <span className="text-zinc-500"><span className="text-white font-bold text-sm">{gpDone}</span>/{totalGP} GP</span>
                {sprintDone > 0 && <span className="text-[#FFD200]">⚡{sprintDone}/{sprintCount}</span>}
              </div>
            </div>
            {/* Track */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5 f-mono text-[9px] text-zinc-700 tracking-widest">
                <span>LIGHTS OUT</span><span>CHEQUERED FLAG</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#E10600,#ff5a3c)", boxShadow: "0 0 16px rgba(225,6,0,.5)" }} />
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
                  <div className="absolute inset-0 shimmer" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)" }} />
                </div>
                {/* checkered flag end */}
                <div className="absolute right-0 inset-y-0 w-4" style={{ backgroundImage: "repeating-conic-gradient(#fff 0% 25%,#000 0% 50%)", backgroundSize: "4px 4px", opacity: .25 }} />
              </div>
              {/* round ticks */}
              <div className="relative h-3 mt-1">
                {Array.from({ length: totalGP }).map((_, i) => (
                  <div key={i} className="absolute top-0 w-px h-2 rounded-full" style={{ left: `${(i / (totalGP - 1)) * 100}%`, background: i < gpDone ? "#E10600" : "#2a2a2e" }} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 f-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 rounded-full bg-green-500" />{gpDone} completed</span>
              <span className="flex items-center gap-1.5 text-[#FFD200]"><span className="w-2 h-2 rounded-full bg-[#FFD200]" />⚡ {sprintDone} sprints</span>
              <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-[#E10600]" />{gpCancel} cancelled</span>
              <span className="flex items-center gap-1.5 text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-600" />{totalGP - gpDone - gpCancel} scheduled</span>
            </div>
          </section>

          {/* Race weekend widget */}
          <section className="rise" style={{ animationDelay: "240ms" }}>
            <RaceWeekendWidget />
          </section>

          {/* Recent calendar — full width */}
          <section className="lg:col-span-3 rise relative overflow-hidden rounded-2xl border border-white/5" style={{ background: "rgba(18,18,21,.7)", animationDelay: "280ms" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-1 h-5 bg-[#E10600] rounded-full" />
                <h3 className="f-cond font-bold text-lg tracking-wide">RACE CALENDAR</h3>
              </div>
              <Link href="/races" className="f-mono text-[11px] text-[#E10600] hover:text-[#ff5a3c] transition-colors group">
                VIEW ALL <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 m-2 rounded-lg bg-white/[0.03] animate-pulse" />)
              ) : calendar.map((race, i) => {
                const w = winners[race.name];
                const done = race.status === "COMPLETED";
                const cancel = race.status === "CANCELLED";
                return (
                  <Link key={race.id} href={done ? `/races/${race.id}/results` : `/races/${race.id}/qualifying`}
                    className={`group relative flex items-center gap-3 px-5 py-4 border-b border-r border-white/[0.04] transition-all hover:bg-white/[0.03] ${cancel ? "opacity-40" : ""}`}>
                    <span className="f-cond font-black text-2xl w-7 text-center tabular-nums" style={{ color: done ? "#22c55e" : cancel ? "#52525b" : "#3f3f46" }}>{race.roundNumber}</span>
                    <span className="text-2xl">{COUNTRY_FLAGS[race.circuit?.country] || "🏁"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="f-cond font-bold text-sm text-white truncate group-hover:text-[#E10600] transition-colors uppercase tracking-wide">{race.name.replace(" Grand Prix", " GP")}</p>
                      {w ? <p className="f-mono text-[10px] text-zinc-500 truncate">🏆 {w.driver}</p>
                        : cancel ? <p className="f-mono text-[10px] text-red-400/60">cancelled</p>
                          : <p className="f-mono text-[10px] text-zinc-600">{race.date}</p>}
                    </div>
                    <span className="f-mono text-[10px] px-2 py-1 rounded border" style={{
                      color: done ? "#22c55e" : "#71717a",
                      borderColor: done ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.08)",
                      background: done ? "rgba(34,197,94,.08)" : "transparent",
                    }}>{done ? "✓" : cancel ? "✗" : "—"}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <p className="text-center f-mono text-[10px] text-zinc-700 mt-8 tracking-widest">F1 PITWALL · BROADCAST-GRADE TELEMETRY · SEASON 2026</p>
      </main>
    </div>
  );
}