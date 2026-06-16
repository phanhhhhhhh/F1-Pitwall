"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch, getAccessToken } from "../../../lib/pitwall-auth";
import { F1, getTeamColor, flagForCountry } from "../../../lib/f1-theme";
import Navbar from "../../../components/Navbar";
import PitwallBackground from "../../../components/PitwallBackground";
import { SkeletonTable } from "../../../components/LoadingSkeleton";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Session {
  sessionKey: number;
  name: string;
  type: string;
  dateStart: string;
  dateEnd: string;
}

interface SessionResult {
  position: number;
  driverNumber: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  nameAcronym: string;
  fastestLap: number;
  avgLap: number;
  lapsCompleted: number;
}

const SESSION_ACCENT: Record<string, string> = {
  "Practice 1":       "#3b82f6",
  "Practice 2":       "#3b82f6",
  "Practice 3":       "#3b82f6",
  "Sprint Qualifying": "#f97316",
  "Sprint":           "#f97316",
  "Qualifying":       F1.gold,
  "Race":             F1.red,
};

const SESSION_EMOJI: Record<string, string> = {
  "Practice 1": "🔵",
  "Practice 2": "🔵",
  "Practice 3": "🔵",
  "Sprint Qualifying": "🟠",
  "Sprint": "🟠",
  "Qualifying": "🟡",
  "Race": "🔴",
};

function formatLapTime(sec: number): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function PracticeTable({ results, loading, accent }: { results: SessionResult[]; loading: boolean; accent: string }) {
  if (loading) return <SkeletonTable rows={10} cols={5} />;
  if (!results.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-2xl"
      style={{ borderColor: F1.hairline }}>
      <p className="f-cond font-black text-xl text-white mb-1">No Data Available</p>
      <p className="f-mono text-xs text-zinc-500">Session data not yet available from OpenF1</p>
    </div>
  );

  const best = results[0]?.fastestLap ?? 0;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: F1.card, borderColor: F1.hairline }}>
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />

      {/* Header */}
      <div className="grid grid-cols-[44px_1fr_auto_auto_auto_auto] gap-0 border-b px-4 sm:px-6 py-3"
        style={{ borderColor: "rgba(255,255,255,.06)" }}>
        {["POS", "DRIVER", "TEAM", "FASTEST LAP", "GAP", "LAPS"].map((h, i) => (
          <span key={h} className={`f-mono text-[10px] tracking-widest text-zinc-600 ${i === 0 ? "text-left" : i === 1 ? "text-left" : "text-right"} ${i === 2 ? "hidden sm:block" : ""}`}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {results.map((r, idx) => {
        const tc = getTeamColor(r.teamName, r.teamColor.startsWith("#") ? r.teamColor : `#${r.teamColor}`);
        const gap = r.fastestLap - best;
        const isP1 = r.position === 1;

        return (
          <motion.div
            key={r.driverNumber}
            className="grid grid-cols-[44px_1fr_auto_auto_auto_auto] items-center px-4 sm:px-6 py-3 border-b transition-colors"
            style={{ borderColor: "rgba(255,255,255,.04)", background: isP1 ? `${accent}08` : "transparent" }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.025 }}
            whileHover={{ backgroundColor: "rgba(255,255,255,.03)" }}
          >
            {/* Position */}
            <span className="f-cond font-black text-xl leading-none"
              style={{ color: isP1 ? accent : r.position <= 3 ? "#9ca3af" : "#3f3f46" }}>
              {r.position}
            </span>

            {/* Driver */}
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="w-[3px] h-9 rounded-full flex-shrink-0" style={{ background: tc }} />
              <div className="min-w-0">
                <p className={`f-cond font-black text-base leading-tight truncate ${isP1 ? "text-white" : "text-zinc-200"}`}>
                  {r.driverName}
                </p>
                <p className="f-mono text-[10px] text-zinc-600">#{r.driverNumber}</p>
              </div>
            </div>

            {/* Team */}
            <div className="hidden sm:flex items-center pr-6">
              <span className="f-mono text-[10px] font-bold px-2.5 py-0.5 rounded truncate max-w-[120px]"
                style={{ color: tc, background: `${tc}15` }}>
                {r.teamName}
              </span>
            </div>

            {/* Fastest lap */}
            <div className="text-right pr-4 sm:pr-6">
              <span className={`f-mono text-xs font-bold tabular-nums ${isP1 ? "text-white" : "text-zinc-400"}`}>
                {formatLapTime(r.fastestLap)}
              </span>
            </div>

            {/* Gap */}
            <div className="text-right pr-4 sm:pr-6">
              {isP1 ? (
                <span className="f-mono text-[10px] font-bold" style={{ color: accent }}>FASTEST</span>
              ) : (
                <span className="f-mono text-[10px] text-zinc-600 tabular-nums">+{gap.toFixed(3)}</span>
              )}
            </div>

            {/* Laps */}
            <div className="text-right">
              <span className="f-mono text-xs text-zinc-500">{r.lapsCompleted}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function RaceWeekendPage() {
  const router = useRouter();
  const params = useParams();
  const raceId = params.raceId as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [race, setRace] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [sessionCache, setSessionCache] = useState<Record<number, SessionResult[]>>({});

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchPageData();
  }, [raceId]);

  const fetchPageData = async () => {
    try {
      const [raceRes, sessionsRes] = await Promise.all([
        authFetch(`${API}/api/races/${raceId}`),
        authFetch(`${API}/api/openf1/race/${raceId}/sessions`),
      ]);
      const [raceData, sessionsData] = await Promise.all([raceRes.json(), sessionsRes.json()]);
      setRace(raceData);
      setSessions(sessionsData);
      if (sessionsData.length > 0) {
        setActiveSession(sessionsData[0]);
      }
    } catch (err) { console.error(err); }
    finally { setLoadingPage(false); }
  };

  const loadResults = useCallback(async (session: Session) => {
    // Practice/Qualifying only — Race results come from our own DB
    if (session.name === "Race") {
      router.push(`/races/${raceId}/results`);
      return;
    }
    if (session.name === "Qualifying") {
      router.push(`/races/${raceId}/qualifying`);
      return;
    }

    if (sessionCache[session.sessionKey]) {
      setResults(sessionCache[session.sessionKey]);
      return;
    }

    setLoadingResults(true);
    try {
      const res = await authFetch(`${API}/api/openf1/session/${session.sessionKey}/results`);
      const data: SessionResult[] = await res.json();
      setResults(data);
      setSessionCache(prev => ({ ...prev, [session.sessionKey]: data }));
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  }, [raceId, router, sessionCache]);

  useEffect(() => {
    if (activeSession) loadResults(activeSession);
  }, [activeSession]);

  const accent = activeSession ? SESSION_ACCENT[activeSession.name] ?? F1.red : F1.red;
  const countryFlag = flagForCountry(race?.circuit?.country);

  if (loadingPage) return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: F1.bg }}>
      <PitwallBackground glow="top-left" />
      <Navbar />
      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="h-10 w-72 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="flex gap-2 mb-6">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-9 w-28 bg-zinc-800 rounded-xl animate-pulse" />)}
        </div>
        <SkeletonTable rows={10} cols={5} />
      </main>
    </div>
  );

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: F1.bg }}>
      <PitwallBackground glow="top-left" />
      <Navbar />
      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* Page header */}
        <motion.div className="mb-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Link href="/races" className="f-mono text-[11px] tracking-widest text-zinc-600 hover:text-[#ff6a52] transition-colors mb-4 inline-flex items-center gap-1.5">
            ← BACK TO CALENDAR
          </Link>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-block w-8 h-[3px] rounded-full" style={{ background: F1.red }} />
            <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500 uppercase">
              {race?.circuit?.country && `${countryFlag} `}
              {race?.date?.slice(0, 4) ?? "2026"}
              {race?.roundNumber ? ` · ROUND ${race.roundNumber}` : ""}
              {race?.circuit?.country ? ` · ${race.circuit.country.toUpperCase()}` : ""}
            </span>
          </div>
          <h1 className="f-cond font-black tracking-tight leading-[0.85]" style={{ fontSize: "clamp(40px,7vw,76px)" }}>
            <span className="block text-white">{race?.name?.toUpperCase().replace(/ GRAND PRIX$/, "") || "RACE"}</span>
            <span className="block text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(90deg, ${F1.red}, ${F1.orange})` }}>
              RACE WEEKEND
            </span>
          </h1>
          {race?.circuit?.name && <p className="f-mono text-xs text-zinc-500 mt-2">{race.circuit.name}</p>}
        </motion.div>

        {/* No sessions fallback */}
        {sessions.length === 0 && (
          <motion.div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-2xl"
            style={{ borderColor: F1.hairline }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="f-cond font-black text-xl text-white mb-1">Session Data Unavailable</p>
            <p className="f-mono text-xs text-zinc-500 max-w-xs text-center">
              OpenF1 session data for this race weekend could not be found.
              This race may be too far in the past or future.
            </p>
          </motion.div>
        )}

        {sessions.length > 0 && (
          <>
            {/* Session tabs */}
            <motion.div className="flex gap-2 flex-wrap mb-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
              {sessions.map(s => {
                const isActive = activeSession?.sessionKey === s.sessionKey;
                const col = SESSION_ACCENT[s.name] ?? F1.red;
                return (
                  <button
                    key={s.sessionKey}
                    onClick={() => setActiveSession(s)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold f-mono transition-all duration-200 ${isActive ? "" : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}`}
                    style={isActive ? { borderColor: `${col}60`, background: `${col}15`, color: col } : {}}
                  >
                    <span>{SESSION_EMOJI[s.name] ?? "⚪"}</span>
                    {s.name.toUpperCase()}
                  </button>
                );
              })}
            </motion.div>

            {/* Session meta */}
            <AnimatePresence mode="wait">
              {activeSession && (
                <motion.div
                  key={activeSession.sessionKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Session info bar */}
                  <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-5 h-[2px]" style={{ background: accent }} />
                      <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500 uppercase">
                        {activeSession.name}
                      </span>
                      {activeSession.dateStart && (
                        <span className="f-mono text-[10px] text-zinc-700">
                          {formatDate(activeSession.dateStart)}
                        </span>
                      )}
                    </div>

                    {/* Link to full dedicated pages for Quali / Race */}
                    {activeSession.name === "Qualifying" && (
                      <Link href={`/races/${raceId}/qualifying`}
                        className="f-mono text-[10px] border rounded-lg px-3 py-1.5 transition-colors"
                        style={{ borderColor: `${F1.gold}40`, color: F1.gold }}>
                        VIEW FULL QUALIFYING →
                      </Link>
                    )}
                    {activeSession.name === "Race" && (
                      <Link href={`/races/${raceId}/results`}
                        className="f-mono text-[10px] border rounded-lg px-3 py-1.5 transition-colors"
                        style={{ borderColor: `${F1.red}40`, color: F1.red }}>
                        VIEW RACE RESULTS →
                      </Link>
                    )}
                  </div>

                  {/* Results table for practice sessions */}
                  {activeSession.name !== "Qualifying" && activeSession.name !== "Race" && (
                    <PracticeTable results={results} loading={loadingResults} accent={accent} />
                  )}

                  {/* Redirect notice for Quali/Race */}
                  {(activeSession.name === "Qualifying" || activeSession.name === "Race") && (
                    <div className="rounded-2xl border p-8 flex flex-col items-center gap-4 text-center"
                      style={{ background: F1.card, borderColor: F1.hairline }}>
                      <div className="w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl"
                        style={{ borderColor: F1.hairline, background: "rgba(255,255,255,.03)" }}>
                        {activeSession.name === "Qualifying" ? "🟡" : "🏁"}
                      </div>
                      <div>
                        <p className="f-cond font-black text-lg text-white mb-1">
                          {activeSession.name === "Qualifying" ? "Full Q1 / Q2 / Q3 Classification" : "Race Results & Podium"}
                        </p>
                        <p className="f-mono text-xs text-zinc-500">
                          {activeSession.name === "Qualifying"
                            ? "Qualifying results with sector times are on the dedicated page."
                            : "Race classification, podium, and points are on the dedicated results page."}
                        </p>
                      </div>
                      <Link
                        href={activeSession.name === "Qualifying" ? `/races/${raceId}/qualifying` : `/races/${raceId}/results`}
                        className="px-6 py-2.5 rounded-xl f-cond font-black text-sm text-white transition-all"
                        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, boxShadow: `0 0 20px ${accent}30` }}
                      >
                        {activeSession.name === "Qualifying" ? "QUALIFYING RESULTS →" : "RACE RESULTS →"}
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}
