"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../lib/pitwall-auth";
import { BASE_URL as API } from "../../lib/api-client";
import Navbar from "../../components/Navbar";
import PitwallBackground from "../../components/PitwallBackground";
import type { RaceNewsItem } from "../../types/f1";

const TAG_COLORS: Record<string, string> = {
  RACE_REPORT: "#E10600",
  DRIVER_NEWS: "#FFD200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [news, setNews] = useState<RaceNewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/api/news/${id}`);
        setNews(await res.json());
      } catch (e) {
        setError("News item not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <style>{`
        .f-cond{font-family:'Saira Condensed','Saira',system-ui,sans-serif}
        .f-mono{font-family:var(--font-geist-mono),ui-monospace,monospace}
        .chamfer{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
      `}</style>

      <PitwallBackground />

      <Navbar />

      <main className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <Link href="/news" className="f-mono text-[11px] text-zinc-600 hover:text-white transition-colors">
          ← ALL NEWS
        </Link>

        {loading ? (
          <div className="chamfer border border-white/5 bg-white/[0.02] p-8 mt-4 animate-pulse">
            <div className="h-3 bg-zinc-800 rounded w-24 mb-4" />
            <div className="h-8 bg-zinc-800 rounded w-5/6 mb-6" />
            <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
            <div className="h-4 bg-zinc-800 rounded w-2/3" />
          </div>
        ) : error || !news ? (
          <div className="chamfer border border-white/5 py-16 mt-4 text-center" style={{ background: "rgba(18,18,21,.7)" }}>
            <p className="f-mono text-sm text-zinc-600">{error ?? "News item not found"}</p>
          </div>
        ) : (
          <article className="chamfer border border-white/5 mt-4 overflow-hidden" style={{ background: "rgba(18,18,21,.78)" }}>
            {/* Header */}
            <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-white/5 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E10600]/60 to-transparent" />
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className="f-mono text-[10px] font-black px-2 py-1 rounded border"
                  style={{
                    color: TAG_COLORS[news.tag ?? ""] ?? "#666",
                    borderColor: (TAG_COLORS[news.tag ?? ""] ?? "#666") + "44",
                    background: (TAG_COLORS[news.tag ?? ""] ?? "#666") + "14",
                  }}
                >
                  {news.tag ?? "NEWS"}
                </span>
                <span className="f-mono text-[10px] font-black text-white bg-zinc-800/90 border border-white/10 rounded px-1.5 py-0.5">
                  R{news.roundNumber}
                </span>
                <span className="f-mono text-[11px] tracking-widest text-zinc-500 uppercase">{news.raceName}</span>
              </div>
              <h1 className="f-cond font-black leading-[1.05] tracking-tight" style={{ fontSize: "clamp(30px,5.5vw,52px)" }}>
                {news.title}
              </h1>
              <p className="f-mono text-[11px] text-zinc-600 mt-3">
                SEASON {news.season} · {formatDate(news.createdAt)}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 sm:px-8 py-6">
              <div className="whitespace-pre-wrap text-zinc-300 leading-relaxed" style={{ fontFamily: "'Saira',system-ui,sans-serif", fontSize: "15px" }}>
                {news.content}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-4 border-t border-white/5 flex items-center justify-between">
              <span className="f-mono text-[10px] text-zinc-700">
                {news.raceName} · ROUND {news.roundNumber}
              </span>
              <Link href={`/races/${news.raceId}/results`} className="f-mono text-[11px] text-[#E10600] hover:text-[#ff5a3c] transition-colors">
                RACE RESULTS →
              </Link>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
