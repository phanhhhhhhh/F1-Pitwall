"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import { useSeason } from "../context/SeasonContext";
import Navbar from "../components/Navbar";
import PitwallBackground from "../components/PitwallBackground";
import type { RaceNewsItem } from "../types/f1";

const TAG_COLORS: Record<string, string> = {
  RACE_REPORT: "#E10600",
  DRIVER_NEWS: "#FFD200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function groupByRound(items: RaceNewsItem[]): { roundNumber: number; raceName: string; items: RaceNewsItem[] }[] {
  const groups = new Map<number, { roundNumber: number; raceName: string; items: RaceNewsItem[] }>();
  for (const item of items) {
    const g = groups.get(item.roundNumber);
    if (g) g.items.push(item);
    else groups.set(item.roundNumber, { roundNumber: item.roundNumber, raceName: item.raceName, items: [item] });
  }
  return [...groups.values()].sort((a, b) => b.roundNumber - a.roundNumber);
}

export default function NewsListPage() {
  const { season } = useSeason();
  const [news, setNews] = useState<RaceNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/news?season=${season}`);
      const json: RaceNewsItem[] = await res.json();
      setNews(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error("[News]", e);
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const groups = groupByRound(news);

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <PitwallBackground />
      <Navbar />

      <main className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="mb-8 rise">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-8 h-[3px] bg-[#E10600] rounded-full shadow-[0_0_8px_#E10600]" />
            <span className="f-mono text-xs text-red-500 font-black tracking-widest uppercase">FIA FORMULA 1 · SEASON {season} ARCHIVE</span>
          </div>
          <h1 className="f-cond font-black leading-none tracking-tight text-5xl sm:text-7xl uppercase">
            PADDOCK <span className="text-[#E10600]">DISPATCHES</span>
          </h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-24 mb-3" />
                <div className="h-6 bg-zinc-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="rounded-3xl border border-white/10 py-20 text-center f-mono text-xs text-zinc-500 font-bold uppercase tracking-widest bg-black/60 shadow-xl">
            No dispatches filed yet for season {season}
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(group => (
              <div key={group.roundNumber}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="f-mono text-xs font-black text-white bg-black/60 border border-white/10 rounded-xl px-3 py-1 shadow-inner">
                    ROUND {String(group.roundNumber).padStart(2, "0")}
                  </span>
                  <span className="f-mono text-xs tracking-widest text-zinc-400 font-bold uppercase">{group.raceName}</span>
                  <span className="flex-1 h-px bg-gradient-to-r from-white/[0.1] to-transparent" />
                </div>
                <div className="space-y-3">
                  {group.items.map(item => {
                    const tagColor = TAG_COLORS[item.tag ?? ""] ?? "#E10600";
                    return (
                      <Link key={item.id} href={`/news/${item.id}`}
                        className="group flex items-center gap-4 sm:gap-5 px-5 sm:px-6 py-4 rounded-3xl border border-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-[0_8px_30px_rgba(0,0,0,0.8)]"
                        style={{ background: "linear-gradient(135deg, rgba(20,21,26,.85) 0%, rgba(10,11,14,.95) 100%)" }}>
                        <span className="w-1.5 h-12 rounded-full flex-shrink-0 transition-transform group-hover:scale-y-110" style={{ background: tagColor, boxShadow: `0 0 12px ${tagColor}80` }} />
                        <div className="flex-1 min-w-0">
                          <p className="f-cond font-bold text-lg sm:text-xl text-white truncate group-hover:text-[#ff6a52] transition-colors uppercase tracking-wide">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                            <span className="f-mono text-[10px] font-black px-2 py-0.5 rounded-md border" style={{ color: tagColor, borderColor: `${tagColor}40`, background: `${tagColor}15` }}>
                              {item.tag ?? "NEWS"}
                            </span>
                            <span className="f-mono text-[11px] text-zinc-400 font-semibold">
                              🗓 {formatDate(item.createdAt)}
                            </span>
                          </div>
                        </div>
                        <span className="f-mono text-xs font-bold text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 flex items-center gap-1">
                          READ ARTICLE →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Link href="/" className="f-mono text-xs font-bold text-zinc-400 hover:text-white transition-colors">
            ← BACK TO COMMAND CENTER
          </Link>
        </div>
      </main>
    </div>
  );
}
