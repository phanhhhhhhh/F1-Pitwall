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
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <style>{`
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        .chamfer{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
      `}</style>

      <PitwallBackground />

      <Navbar />

      <main className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-8 h-[3px] bg-[#E10600]" />
            <span className="f-mono text-[11px] tracking-[0.35em] text-zinc-500">FORMULA 1 · SEASON {season}</span>
          </div>
          <h1 className="f-cond font-black leading-none tracking-tight" style={{ fontSize: "clamp(40px,7vw,72px)" }}>
            RACE <span style={{ color: "#E10600" }}>NEWS</span>
          </h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="chamfer border border-white/5 bg-white/[0.02] p-5 animate-pulse">
                <div className="h-3 bg-zinc-800 rounded w-20 mb-3" />
                <div className="h-5 bg-zinc-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="chamfer border border-white/5 py-16 text-center f-mono text-sm text-zinc-600" style={{ background: "rgba(18,18,21,.7)" }}>
            No news yet for season {season}
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.roundNumber}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="f-mono text-[11px] font-black text-white bg-zinc-800/90 border border-white/10 rounded px-2 py-1">
                    R{group.roundNumber}
                  </span>
                  <span className="f-mono text-[11px] tracking-widest text-zinc-500 uppercase">{group.raceName}</span>
                  <span className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="space-y-2">
                  {group.items.map(item => {
                    const tagColor = TAG_COLORS[item.tag ?? ""] ?? "#666";
                    return (
                      <Link key={item.id} href={`/news/${item.id}`}
                        className="chamfer group flex items-center gap-4 px-5 py-4 border border-white/5 hover:border-white/15 transition-all"
                        style={{ background: "rgba(18,18,21,.7)" }}>
                        <span className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: tagColor, boxShadow: `0 0 10px ${tagColor}60` }} />
                        <div className="flex-1 min-w-0">
                          <p className="f-cond font-bold text-lg text-white truncate group-hover:text-[#ff6a52] transition-colors">
                            {item.title}
                          </p>
                          <p className="f-mono text-[11px] text-zinc-600">
                            {item.tag ?? "NEWS"} · {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <span className="f-mono text-[11px] text-zinc-700 group-hover:text-[#E10600] transition-colors flex-shrink-0">
                          READ →
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
          <Link href="/" className="f-mono text-[11px] text-zinc-600 hover:text-white transition-colors">
            ← BACK TO COMMAND CENTER
          </Link>
        </div>
      </main>
    </div>
  );
}
