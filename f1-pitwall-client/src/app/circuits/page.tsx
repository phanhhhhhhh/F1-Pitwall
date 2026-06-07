"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import Navbar from "../components/Navbar";
import { SkeletonTable } from "../components/LoadingSkeleton";

interface Circuit {
  id: number; name: string; country: string; city: string; type: string;
  totalLaps: number; lengthKm: number; lapRecordSec: number; lapRecordHolder: string; turnCount: number;
}

const typeConfig: Record<string, { color: string; label: string }> = {
  PERMANENT: { color: "#3B82F6", label: "PERMANENT" },
  STREET: { color: "#F97316", label: "STREET" },
  OVAL: { color: "#A855F7", label: "OVAL" },
};

const COUNTRY_FLAGS: Record<string, string> = {
  "Australia": "🇦🇺", "China": "🇨🇳", "Japan": "🇯🇵", "Bahrain": "🇧🇭",
  "Saudi Arabia": "🇸🇦", "United States": "🇺🇸", "Canada": "🇨🇦",
  "Monaco": "🇲🇨", "Spain": "🇪🇸", "Austria": "🇦🇹", "United Kingdom": "🇬🇧",
  "Belgium": "🇧🇪", "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹",
  "Azerbaijan": "🇦🇿", "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷",
  "UAE": "🇦🇪", "Qatar": "🇶🇦", "Las Vegas": "🇺🇸",
};

const formatTime = (s: number) => { const m = Math.floor(s / 60); const sec = (s % 60).toFixed(3); return `${m}:${sec.padStart(6, "0")}`; };

function CircuitCard({ circuit, idx }: { circuit: Circuit; idx: number }) {
  const [hov, setHov] = useState(false);
  const cfg = typeConfig[circuit.type] || { color: "#71717a", label: circuit.type };
  const col = cfg.color;
  const flag = COUNTRY_FLAGS[circuit.country] || "🏁";

  return (
    <div className="group relative rise" style={{ animationDelay: `${idx * 40}ms` }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div className="absolute inset-0 rounded-2xl transition-opacity duration-500 pointer-events-none" style={{ opacity: hov ? 1 : 0, boxShadow: `0 0 32px ${col}24` }} />
      <div className="relative border rounded-2xl overflow-hidden transition-all duration-300 chamfer" style={{ borderColor: hov ? `${col}40` : "rgba(255,255,255,.06)", transform: hov ? "translateY(-3px)" : "none", background: "rgba(18,18,21,.78)" }}>
        <div className="h-[3px] w-full" style={{ background: col, boxShadow: hov ? `0 0 12px ${col}` : "none" }} />
        <div className="absolute right-4 bottom-3 f-mono font-black select-none pointer-events-none transition-all duration-500" style={{ fontSize: "2.4rem", color: col, opacity: hov ? 0.1 : 0.05, transform: hov ? "scale(1.05)" : "none" }}>{formatTime(circuit.lapRecordSec)}</div>
        <div className="relative z-10 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{flag}</span>
            <span className="f-mono text-[10px] font-bold px-2 py-0.5 rounded border" style={{ color: col, borderColor: `${col}40`, background: `${col}12` }}>{cfg.label}</span>
          </div>
          <h2 className="f-cond font-black text-2xl uppercase leading-none tracking-tight transition-colors" style={{ color: hov ? col : "#fff" }}>{circuit.name}</h2>
          <p className="f-mono text-[11px] text-zinc-500 mt-1">{circuit.city}, {circuit.country}</p>
          <div className="h-px my-4" style={{ background: `linear-gradient(90deg,${col}50,transparent)`, opacity: hov ? 1 : 0.4 }} />
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[{ l: "LAPS", v: circuit.totalLaps }, { l: "KM", v: circuit.lengthKm }, { l: "TURNS", v: circuit.turnCount }].map(s => (
              <div key={s.l} className="text-center">
                <p className="f-cond font-black text-2xl tabular-nums" style={{ color: hov ? "#fff" : "#e4e4e7" }}>{s.v}</p>
                <p className="f-mono text-[9px] text-zinc-600 tracking-widest">{s.l}</p>
              </div>
            ))}
            <div className="text-center">
              <p className="f-cond font-black text-base tabular-nums leading-tight pt-1.5" style={{ color: col }}>{formatTime(circuit.lapRecordSec)}</p>
              <p className="f-mono text-[9px] text-zinc-600 tracking-widest">RECORD</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ background: "rgba(255,255,255,.02)", borderColor: "rgba(255,255,255,.06)" }}>
            <span className="text-[#E10600] text-xs">⚡</span>
            <p className="f-mono text-[11px] text-zinc-400">REC BY <span className="text-white font-bold">{circuit.lapRecordHolder}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CircuitsPage() {
  const router = useRouter();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    authFetch(`${API}/api/circuits`).then(r => r.json()).then(setCircuits).catch(console.error).finally(() => setLoading(false));
  }, []);

  const types = ["ALL", "PERMANENT", "STREET", "OVAL"];
  const filtered = circuits.filter(c => {
    const mt = filter === "ALL" || c.type === filter;
    const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.country.toLowerCase().includes(search.toLowerCase());
    return mt && ms;
  });

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
        <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 65% -10%, rgba(225,6,0,.10), transparent 55%)" }} />
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
              <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500">{circuits.length} CIRCUITS WORLDWIDE</span>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-[0.82]" style={{ fontSize: "clamp(48px,7vw,84px)" }}>
              <span className="block text-white">CIRCUIT</span>
              <span className="block text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg,#E10600,#ff5a3c)" }}>DATABASE</span>
            </h1>
          </div>
          <div className="relative">
            <input type="text" placeholder="Search circuit or country..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-zinc-900/70 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E10600]/50 w-64 transition-colors f-mono" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white text-xs">✕</button>}
          </div>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap rise" style={{ animationDelay: "80ms" }}>
          {types.map(t => {
            const cfg = typeConfig[t];
            const active = filter === t;
            const cnt = t === "ALL" ? circuits.length : circuits.filter(c => c.type === t).length;
            return (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-full f-cond text-xs font-bold tracking-wide border transition-all ${active ? "" : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"}`}
                style={active ? { borderColor: cfg ? `${cfg.color}60` : "#E10600", color: cfg ? cfg.color : "#fff", background: cfg ? `${cfg.color}15` : "rgba(225,6,0,.15)" } : {}}>
                {t} <span className="ml-1 opacity-50">{cnt}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><SkeletonTable rows={8} cols={5} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20"><p className="f-cond text-zinc-500 text-xl mb-1">No circuits found</p><p className="f-mono text-zinc-700 text-xs">Try adjusting your search</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{filtered.map((c, i) => <CircuitCard key={c.id} circuit={c} idx={i} />)}</div>
        )}
        {!loading && <p className="text-center f-mono text-[10px] text-zinc-700 mt-8 tracking-widest">SHOWING {filtered.length} OF {circuits.length} CIRCUITS</p>}
      </main>
    </div>
  );
}