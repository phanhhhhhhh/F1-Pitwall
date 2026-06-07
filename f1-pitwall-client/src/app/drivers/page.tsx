"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import Navbar from "../components/Navbar";
import { SkeletonCard } from "../components/LoadingSkeleton";

const NATIONALITY_FLAGS: Record<string, string> = {
  "British": "🇬🇧", "Australian": "🇦🇺", "Dutch": "🇳🇱", "French": "🇫🇷",
  "German": "🇩🇪", "Spanish": "🇪🇸", "Finnish": "🇫🇮", "Canadian": "🇨🇦",
  "Mexican": "🇲🇽", "Brazilian": "🇧🇷", "Italian": "🇮🇹", "Monegasque": "🇲🇨",
  "Thai": "🇹🇭", "New Zealander": "🇳🇿", "Argentine": "🇦🇷", "New Zealand": "🇳🇿",
};

interface Driver {
  id: number; name: string; carNumber: number; nationality: string;
  careerPoints: number; careerWins: number; careerPoles: number;
  team: { id: number; name: string; colorHex: string };
}

function useCountUp(target: number, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    const t = setTimeout(() => {
      let s: number | null = null;
      const step = (ts: number) => { if (!s) s = ts; const p = Math.min((ts - s) / 800, 1); setV(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, delay]);
  return v;
}

function DriverCard({ driver, idx }: { driver: Driver; idx: number }) {
  const [hov, setHov] = useState(false);
  const isChamp = driver.carNumber === 1;
  const col = driver.team?.colorHex || "#666";
  const flag = NATIONALITY_FLAGS[driver.nationality] || "🏁";
  const first = driver.name.split(" ")[0];
  const last = driver.name.split(" ").slice(1).join(" ");
  const wins = useCountUp(driver.careerWins, idx * 40);
  const poles = useCountUp(driver.careerPoles, idx * 40 + 100);
  const pts = useCountUp(driver.careerPoints, idx * 40 + 200);

  return (
    <div className="group relative rise" style={{ animationDelay: `${idx * 40}ms` }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none" style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 36px ${col}28` }} />
      <div className="relative border rounded-2xl overflow-hidden transition-all duration-300 chamfer"
        style={{ borderColor: hov ? `${col}50` : isChamp ? "rgba(255,210,63,.35)" : "rgba(255,255,255,.06)", transform: hov ? "translateY(-4px)" : "none", background: isChamp ? "linear-gradient(155deg,rgba(255,210,63,.07),rgba(15,15,18,.9))" : "rgba(18,18,21,.78)" }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: col, boxShadow: hov ? `0 0 12px ${col}` : "none" }} />
        <div className="absolute -bottom-3 -right-2 f-cond font-black select-none pointer-events-none transition-all duration-500"
          style={{ fontSize: "8rem", lineHeight: .8, color: col, opacity: hov ? 0.14 : 0.07, transform: hov ? "scale(1.08) rotate(-5deg)" : "none" }}>{driver.carNumber}</div>
        <div className="relative z-10 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{flag}</span>
              <span className="f-mono text-[11px] px-2 py-0.5 rounded border" style={{ color: col, borderColor: `${col}40`, background: `${col}10` }}>#{driver.carNumber}</span>
            </div>
            {isChamp && <span className="f-mono text-[10px] text-[#FFD23F] bg-[#FFD23F]/10 border border-[#FFD23F]/30 rounded-lg px-2 py-1 font-bold tracking-wider">👑 CHAMP</span>}
          </div>
          <div className="mb-4">
            <p className="f-mono text-[11px] text-zinc-500 leading-none mb-1">{first}</p>
            <h2 className="f-cond font-black text-3xl leading-none uppercase tracking-tight transition-colors" style={{ color: hov ? col : "#fff" }}>{last || first}</h2>
            <p className="f-mono text-[11px] font-bold tracking-widest mt-2 uppercase" style={{ color: col }}>{driver.team?.name}</p>
          </div>
          <div className="h-px mb-4" style={{ background: `linear-gradient(90deg,${col}50,transparent)`, opacity: hov ? 1 : 0.4 }} />
          <div className="grid grid-cols-3 gap-3">
            {[{ l: "WINS", v: wins, hl: driver.careerWins > 10 }, { l: "POLES", v: poles, hl: false }, { l: "PTS", v: pts, hl: false }].map(s => (
              <div key={s.l} className="text-center">
                <p className={`f-cond font-black text-2xl tabular-nums ${s.hl ? "text-[#FFD23F]" : hov ? "text-white" : "text-zinc-200"}`}>{s.v.toLocaleString()}</p>
                <p className="f-mono text-[9px] text-zinc-600 tracking-widest">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("ALL");
  const [sortBy, setSortBy] = useState<"number" | "wins" | "points">("number");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/drivers`)
      .then(r => r.json())
      .then(setDrivers)
      .catch((e: unknown) => {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load drivers data.");
      })
      .finally(() => setLoading(false));
  }, []);

  const teams = ["ALL", ...Array.from(new Set(drivers.map(d => d.team?.name).filter(Boolean)))];
  const filtered = drivers
    .filter(d => {
      const ms = d.name.toLowerCase().includes(search.toLowerCase()) || d.team?.name?.toLowerCase().includes(search.toLowerCase()) || d.nationality?.toLowerCase().includes(search.toLowerCase());
      return ms && (filterTeam === "ALL" || d.team?.name === filterTeam);
    })
    .sort((a, b) => sortBy === "wins" ? b.careerWins - a.careerWins : sortBy === "points" ? b.careerPoints - a.careerPoints : a.carNumber - b.carNumber);

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
        .chamfer{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
      `}</style>

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 80% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)", backgroundSize: "80px 80px", animation: "grid-pan 6s linear infinite", maskImage: "radial-gradient(circle at 50% 20%,black,transparent 80%)" }} />
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,.012) 0 2px,transparent 2px 5px)" }} />
        <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 220px 60px rgba(0,0,0,.9)" }} />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="absolute h-px" style={{ width: `${120 + i * 50}px`, top: `${18 + i * 20}%`, left: "-10%", background: "linear-gradient(90deg,transparent,rgba(225,6,0,.5),transparent)", animation: `streak ${5 + i * 1.4}s linear infinite`, animationDelay: `${i * 1.3}s` }} />)}
      </div>

      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 rise">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">2026 SEASON · {drivers.length} DRIVERS</span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(48px,7vw,84px)" }}>
              <span className="block text-white">DRIVER</span>
              <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>ROSTER</span>
            </h1>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="relative">
              <input type="text" placeholder="Search driver, team, nationality..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-zinc-900/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E10600]/50 w-72 transition-colors f-mono" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white text-xs">✕</button>}
            </div>
            <div className="flex gap-1.5">
              {(["number", "wins", "points"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)} className={`px-3 py-1 rounded-lg f-mono text-[11px] border transition-all ${sortBy === s ? "border-[#E10600]/50 text-[#ff6a52] bg-[#E10600]/10" : "border-white/10 text-zinc-600 hover:text-zinc-400"}`}>{s === "number" ? "#NO" : s.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-8 rise" style={{ animationDelay: "80ms" }}>
          {teams.map(team => {
            const col = drivers.find(d => d.team?.name === team)?.team?.colorHex;
            const active = filterTeam === team;
            return (
              <button key={team} onClick={() => setFilterTeam(team)}
                className={`px-4 py-1.5 rounded-full f-cond text-xs font-bold tracking-wide border transition-all ${active ? "" : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"}`}
                style={active && col ? { borderColor: `${col}60`, color: col, background: `${col}15` } : active ? { borderColor: "#E10600", color: "#fff", background: "rgba(225,6,0,.15)" } : {}}>
                {team === "ALL" ? "ALL DRIVERS" : team}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-800/60 px-5 py-4" style={{ background: "rgba(225,6,0,.08)" }}>
            <span className="f-mono text-[11px] text-[#E10600] font-bold tracking-widest mt-0.5 shrink-0">ERROR</span>
            <p className="f-mono text-sm text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20"><p className="f-cond text-zinc-500 text-xl mb-1">No drivers found</p><p className="f-mono text-zinc-700 text-xs">Try adjusting your search</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{filtered.map((d, i) => <DriverCard key={d.id} driver={d} idx={i} />)}</div>
        )}
        {!loading && <p className="text-center f-mono text-[10px] text-zinc-700 mt-8 tracking-widest">SHOWING {filtered.length} OF {drivers.length} DRIVERS</p>}
      </main>
    </div>
  );
}