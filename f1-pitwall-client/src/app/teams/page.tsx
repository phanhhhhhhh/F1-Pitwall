"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import Navbar from "../components/Navbar";

const NATIONALITY_FLAGS: Record<string, string> = {
  "British": "🇬🇧", "Australian": "🇦🇺", "Dutch": "🇳🇱", "French": "🇫🇷",
  "German": "🇩🇪", "Spanish": "🇪🇸", "Finnish": "🇫🇮", "Canadian": "🇨🇦",
  "Mexican": "🇲🇽", "Brazilian": "🇧🇷", "Italian": "🇮🇹", "Monegasque": "🇲🇨",
  "Thai": "🇹🇭", "New Zealander": "🇳🇿", "Argentine": "🇦🇷",
};
const COUNTRY_FLAGS: Record<string, string> = {
  "United Kingdom": "🇬🇧", "Italy": "🇮🇹", "Austria": "🇦🇹", "Germany": "🇩🇪",
  "France": "🇫🇷", "United States": "🇺🇸", "Switzerland": "🇨🇭",
};

interface Driver { id: number; name: string; carNumber: number; nationality: string; }
interface Team { id: number; name: string; country: string; colorHex: string; championships: number; annualBudgetM: number; base: string; foundedYear: number; }

function useCountUp(target: number, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    const t = setTimeout(() => { let s: number | null = null; const step = (ts: number) => { if (!s) s = ts; const p = Math.min((ts - s) / 1000, 1); setV(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return v;
}

function TeamCard({ team, drivers, idx }: { team: Team; drivers: Driver[]; idx: number }) {
  const [hov, setHov] = useState(false);
  const col = team.colorHex || "#666";
  const td = drivers.filter((d: any) => d.team?.name === team.name);
  const titles = useCountUp(team.championships, idx * 80);
  const budget = useCountUp(team.annualBudgetM, idx * 80 + 150);

  return (
    <div className="group relative rise" style={{ animationDelay: `${idx * 60}ms` }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none" style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 44px ${col}22` }} />
      <div className="relative border rounded-2xl overflow-hidden transition-all duration-300 chamfer" style={{ borderColor: hov ? `${col}40` : "rgba(255,255,255,.06)", transform: hov ? "translateY(-3px)" : "none", background: "rgba(18,18,21,.78)" }}>
        <div className="h-1 w-full" style={{ background: col, boxShadow: hov ? `0 0 16px ${col}` : "none" }} />
        <div className="absolute right-4 top-4 f-cond font-black select-none pointer-events-none transition-all duration-500" style={{ fontSize: "6.5rem", lineHeight: .8, color: col, opacity: hov ? 0.07 : 0.035, transform: hov ? "scale(1.08)" : "none" }}>{team.championships}</div>
        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="f-mono text-[10px] text-zinc-600 border border-white/10 px-2 py-0.5 rounded">#{idx + 1}</span>
                <span className="text-base">{COUNTRY_FLAGS[team.country] || "🏴"}</span>
                <span className="f-mono text-[11px] text-zinc-600">{team.country}</span>
              </div>
              <h2 className="f-cond font-black text-3xl uppercase tracking-tight transition-colors" style={{ color: hov ? col : "#fff" }}>{team.name}</h2>
              <p className="f-mono text-[11px] text-zinc-500 mt-1">EST. {team.foundedYear} · {team.base}</p>
            </div>
            <div className="text-right">
              <p className="f-cond font-black tabular-nums leading-none" style={{ fontSize: "56px", color: col, textShadow: hov ? `0 0 24px ${col}60` : "none" }}>{titles}</p>
              <p className="f-mono text-[9px] text-zinc-600 tracking-widest mt-1">TITLES</p>
            </div>
          </div>
          {td.length > 0 && (
            <div className="flex gap-2 mb-5">
              {td.map((d: any) => (
                <div key={d.id} className="flex items-center gap-2.5 flex-1 rounded-xl px-3 py-2.5 border transition-all" style={{ background: hov ? `${col}08` : "rgba(255,255,255,.02)", borderColor: hov ? `${col}30` : "rgba(255,255,255,.06)" }}>
                  <span className="text-base flex-shrink-0">{NATIONALITY_FLAGS[d.nationality] || "🏴"}</span>
                  <div className="min-w-0">
                    <p className="f-cond font-bold text-sm text-white truncate uppercase">{d.name.split(" ").pop()}</p>
                    <p className="f-mono text-[10px]" style={{ color: col }}>#{d.carNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="h-px mb-4" style={{ background: `linear-gradient(90deg,${col}50,transparent)`, opacity: hov ? 1 : 0.4 }} />
          <div className="grid grid-cols-2 gap-4">
            <div><p className="f-mono text-[9px] text-zinc-600 tracking-widest mb-1">BASE</p><p className="f-cond font-bold text-sm text-zinc-200">{team.base}</p></div>
            <div><p className="f-mono text-[9px] text-zinc-600 tracking-widest mb-1">BUDGET</p><p className="f-cond font-black text-sm tabular-nums" style={{ color: col }}>${budget}M</p></div>
          </div>
          <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: hov ? `${Math.min((team.annualBudgetM / 500) * 100, 100)}%` : "0%", background: col, boxShadow: `0 0 6px ${col}` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    Promise.all([authFetch(`${API}/api/teams`).then(r => r.json()), authFetch(`${API}/api/drivers`).then(r => r.json())])
      .then(([t, d]) => { setTeams(t); setDrivers(d); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const totalBudget = teams.reduce((s, t) => s + (t.annualBudgetM || 0), 0);
  const totalTitles = teams.reduce((s, t) => s + (t.championships || 0), 0);

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Saira:ital,wght@0,400;0,500;0,600;0,700;1,600;1,800&family=Saira+Condensed:wght@500;600;700;800;900&display=swap');
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        @keyframes grid-pan{from{background-position:0 0}to{background-position:0 80px}}
        @keyframes rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes streak{0%{transform:translateX(-100%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(60vw);opacity:0}}
        .rise{animation:rise .45s cubic-bezier(.16,1,.3,1) both}
        .chamfer{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
      `}</style>

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 35% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 20%,black,transparent 80%)" }} />
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)" }} />
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="absolute h-px" style={{ width: `${120 + i * 50}px`, top: `${18 + i * 20}%`, left: "-10%", background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: `streak ${5 + i * 1.4}s linear infinite`, animationDelay: `${i * 1.3}s` }} />)}
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4 rise">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">2026 SEASON · {teams.length} CONSTRUCTORS</span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(44px,6.5vw,80px)" }}>
              <span className="block text-white">CONSTRUCTORS</span>
              <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>THE GRID</span>
            </h1>
          </div>
          {!loading && (
            <div className="flex gap-3 rise" style={{ animationDelay: "150ms" }}>
              {[{ l: "TOTAL TITLES", v: totalTitles.toLocaleString() }, { l: "COMBINED BUDGET", v: `$${totalBudget.toLocaleString()}M` }].map(s => (
                <div key={s.l} className="rounded-xl border border-white/8 px-5 py-3 text-right chamfer" style={{ background: "rgba(18,18,21,.7)" }}>
                  <p className="f-mono text-[9px] text-zinc-600 tracking-widest mb-1">{s.l}</p>
                  <p className="f-cond font-black text-2xl text-white">{s.v}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 bg-white/[0.03] rounded-2xl animate-pulse border border-white/5" />)}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{teams.map((t, i) => <TeamCard key={t.id} team={t} drivers={drivers} idx={i} />)}</div>
        )}
      </main>
    </div>
  );
}