"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import { useSeason } from "../context/SeasonContext";
import type { RaceNewsItem } from "../types/f1";

const TAG_COLORS: Record<string, string> = {
  RACE_REPORT: "#E10600",
  DRIVER_NEWS: "#FFD200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return ""; }
}

/** Groups news by roundNumber, preserving descending round order. */
function groupByRound(items: RaceNewsItem[]): { roundNumber: number; raceName: string; items: RaceNewsItem[] }[] {
  const groups = new Map<number, { roundNumber: number; raceName: string; items: RaceNewsItem[] }>();
  for (const item of items) {
    const g = groups.get(item.roundNumber);
    if (g) g.items.push(item);
    else groups.set(item.roundNumber, { roundNumber: item.roundNumber, raceName: item.raceName, items: [item] });
  }
  return [...groups.values()].sort((a, b) => b.roundNumber - a.roundNumber);
}

export default function RoundNewsSection({ limit = 5 }: { limit?: number }) {
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

  if (loading) {
    return (
      <section className="chamfer border border-white/5 animate-pulse" style={{ background: "rgba(18,18,21,.7)" }}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="h-4 bg-zinc-800 rounded w-28" />
          <div className="h-3 bg-zinc-800 rounded w-16" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/[0.03] rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (news.length === 0) return null;

  const groups = groupByRound(news);
  let shown = 0;

  return (
    <section className="chamfer border border-white/5 overflow-hidden" style={{ background: "rgba(18,18,21,.7)" }}>
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 bg-[#E10600] rounded-full" />
          <h3 className="f-cond font-bold text-lg tracking-wide">ROUND NEWS</h3>
          <span className="f-mono text-[10px] text-zinc-600 border border-white/10 rounded px-1.5 py-0.5">SEASON {season}</span>
        </div>
        <Link href="/news" className="f-mono text-[11px] text-[#E10600] hover:text-[#ff5a3c] transition-colors group">
          VIEW ALL{" "}
          <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {groups.map(group => (
          <div key={group.roundNumber}>
            <div className="flex items-center gap-2 px-4 sm:px-5 pt-3 pb-1.5">
              <span className="f-mono text-[10px] font-black text-white bg-zinc-800/80 border border-white/10 rounded px-1.5 py-0.5">
                R{group.roundNumber}
              </span>
              <span className="f-mono text-[10px] tracking-widest text-zinc-500 uppercase">
                {group.raceName}
              </span>
            </div>
            {group.items.map(item => {
              if (shown >= limit) return null;
              shown++;
              const tagColor = TAG_COLORS[item.tag ?? ""] ?? "#666";
              return (
                <Link key={item.id} href={`/news/${item.id}`}
                  className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-white/[0.03] transition-colors group">
                  <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: tagColor, boxShadow: `0 0 8px ${tagColor}60` }} />
                  <div className="flex-1 min-w-0">
                    <p className="f-cond font-bold text-sm sm:text-base text-white truncate group-hover:text-[#ff6a52] transition-colors">
                      {item.title}
                    </p>
                    <p className="f-mono text-[10px] text-zinc-600">
                      {item.tag ?? "NEWS"} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <span className="f-mono text-[10px] text-zinc-700 group-hover:text-[#E10600] transition-colors">READ →</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
