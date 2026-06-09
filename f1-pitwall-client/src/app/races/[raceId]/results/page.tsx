"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { authFetch, getAccessToken } from "../../../lib/pitwall-auth";
import Navbar from "../../../components/Navbar";
import PitwallBackground from "../../../components/PitwallBackground";
import { SkeletonTable, SkeletonCard } from "../../../components/LoadingSkeleton";
import { F1, getTeamColor, flagForCountry } from "../../../lib/f1-theme";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Driver { id: number; name: string; carNumber: number; team: { name: string; colorHex: string }; }
interface ResultRow {
  driverId: number; driverName: string; teamName: string; teamColor: string;
  carNumber: number; startPosition: number; finishPosition: number;
  hasFastestLap: boolean; fastestLapTime: number; dnfReason: string;
}
interface RaceResultResponse {
  id: number; finishPosition: number; driverName: string; teamName: string;
  teamColor: string; points: number; hasFastestLap: boolean; dnfReason: string;
}

// ── Podium stand heights (px) for P1/P2/P3 visual
const PODIUM_HEIGHT = { 1: 140, 2: 108, 3: 88 } as const;
const PODIUM_MEDAL: Record<number, string> = { 1: F1.gold, 2: "#C0C0C0", 3: "#CD7F32" };
const PODIUM_LABEL: Record<number, string> = { 1: "P1", 2: "P2", 3: "P3" };

function PodiumBlock({ result, pos, delay }: { result: RaceResultResponse; pos: 1 | 2 | 3; delay: number }) {
  const tc = getTeamColor(result.teamName, result.teamColor);
  const h = PODIUM_HEIGHT[pos];
  const medal = PODIUM_MEDAL[pos];
  const lastName = result.driverName.split(" ").slice(-1)[0].toUpperCase();

  return (
    <motion.div
      className="flex flex-col items-center gap-0 flex-1"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {/* Driver card above stand */}
      <div
        className="w-full max-w-[160px] rounded-xl border p-3 mb-2 flex flex-col items-center gap-1.5 relative overflow-hidden"
        style={{
          background: pos === 1
            ? `linear-gradient(160deg, rgba(255,210,0,.12), rgba(255,210,0,.03))`
            : "rgba(18,18,21,.85)",
          borderColor: pos === 1 ? "rgba(255,210,0,.35)" : "rgba(255,255,255,.08)",
          boxShadow: pos === 1 ? `0 0 32px rgba(255,210,0,.18)` : "none",
        }}
      >
        {/* Team color stripe at top */}
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl" style={{ background: tc }} />

        {/* Position badge */}
        <div
          className="f-cond font-black text-3xl leading-none mt-1"
          style={{ color: medal, textShadow: pos === 1 ? `0 0 20px ${medal}80` : "none" }}
        >
          {PODIUM_LABEL[pos]}
        </div>

        {/* Driver name */}
        <p className="f-cond font-black text-white text-base sm:text-lg tracking-wide leading-tight text-center">{lastName}</p>

        {/* Team name */}
        <span
          className="f-mono text-[10px] font-bold px-2 py-0.5 rounded truncate max-w-full"
          style={{ color: tc, background: `${tc}18` }}
        >
          {result.teamName}
        </span>

        {/* Points */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="f-mono text-[10px] text-zinc-500">PTS</span>
          <span className="f-cond font-black text-white text-base">{result.points}</span>
        </div>

        {result.hasFastestLap && (
          <span className="f-mono text-[9px] text-purple-300 bg-purple-500/15 border border-purple-500/25 px-2 py-0.5 rounded">
            ⚡ FASTEST LAP
          </span>
        )}
      </div>

      {/* Podium stand */}
      <div
        className="w-full max-w-[160px] rounded-t-lg flex items-end justify-center pb-2"
        style={{
          height: h,
          background: pos === 1
            ? `linear-gradient(180deg, rgba(255,210,0,.22) 0%, rgba(255,210,0,.08) 100%)`
            : pos === 2
            ? "linear-gradient(180deg, rgba(192,192,192,.15) 0%, rgba(192,192,192,.05) 100%)"
            : "linear-gradient(180deg, rgba(205,127,50,.12) 0%, rgba(205,127,50,.04) 100%)",
          borderTop: `3px solid ${medal}60`,
          borderLeft: `1px solid ${medal}18`,
          borderRight: `1px solid ${medal}18`,
        }}
      >
        <span className="f-cond font-black text-5xl" style={{ color: `${medal}50` }}>{pos}</span>
      </div>
    </motion.div>
  );
}

export default function RaceResultsPage() {
  const router = useRouter();
  const params = useParams();
  const raceId = params.raceId as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [race, setRace] = useState<any>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [existingResults, setExistingResults] = useState<RaceResultResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, [raceId]);

  const fetchData = async () => {
    try {
      const [raceRes, driversRes, resultsRes] = await Promise.all([
        authFetch(`${API}/api/races/${raceId}`),
        authFetch(`${API}/api/drivers`),
        authFetch(`${API}/api/race-results/race/${raceId}`),
      ]);
      const [raceData, driversData, resultsData] = await Promise.all([raceRes.json(), driversRes.json(), resultsRes.json()]);
      setRace(raceData); setDrivers(driversData); setExistingResults(resultsData);
      if (resultsData.length > 0) setMode("view");
      else { initRows(driversData); setMode("edit"); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const initRows = (d: Driver[]) => {
    const sorted = [...d].sort((a, b) => a.carNumber - b.carNumber);
    setRows(sorted.map((dr, i) => ({
      driverId: dr.id, driverName: dr.name, teamName: dr.team?.name || "", teamColor: dr.team?.colorHex || "#666",
      carNumber: dr.carNumber, startPosition: i + 1, finishPosition: i + 1, hasFastestLap: false, fastestLapTime: 0, dnfReason: "",
    })));
  };

  const updateRow = (index: number, field: keyof ResultRow, value: ResultRow[keyof ResultRow]) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "hasFastestLap" && value === true) next.forEach((r, i) => { if (i !== index) next[i] = { ...next[i], hasFastestLap: false }; });
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = rows.map(r => ({
        driverId: r.driverId, startPosition: r.startPosition, finishPosition: r.finishPosition,
        hasFastestLap: r.hasFastestLap, fastestLapTime: r.fastestLapTime, fastestLapNumber: 0, dnfReason: r.dnfReason || null,
      }));
      const res = await authFetch(`${API}/api/race-results/race/${raceId}`, { method: "POST", body: JSON.stringify(payload) });
      if (res.ok) { setExistingResults(await res.json()); setMode("view"); setSubmitted(true); }
      else alert("Failed to submit results.");
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleResync = async () => {
    if (!confirm("This will delete current results and re-fetch from OpenF1.\nContinue?")) return;
    setResyncing(true); setFeedback("");
    try {
      const res = await authFetch(`${API}/api/sync/race/${raceId}/results`, { method: "POST" });
      const data = await res.json();
      if (data.success) { setFeedback("✓ Re-sync successful!"); await fetchData(); }
      else setFeedback("✗ Re-sync failed: " + (data.error || "unknown error"));
    } catch { setFeedback("✗ Connection error"); }
    finally { setResyncing(false); setTimeout(() => setFeedback(""), 4000); }
  };

  // Derive podium from results sorted by finishPosition
  const sorted = [...existingResults].sort((a, b) => {
    if (a.dnfReason && !b.dnfReason) return 1;
    if (!a.dnfReason && b.dnfReason) return -1;
    return a.finishPosition - b.finishPosition;
  });
  const p1 = sorted.find(r => !r.dnfReason && r.finishPosition === 1);
  const p2 = sorted.find(r => !r.dnfReason && r.finishPosition === 2);
  const p3 = sorted.find(r => !r.dnfReason && r.finishPosition === 3);
  const hasPodium = p1 && p2 && p3;

  const countryFlag = flagForCountry(race?.circuit?.country);

  // ── Loading state
  if (loading) return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: F1.bg }}>
      <PitwallBackground glow="top-left" />
      <Navbar />
      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        <div className="mb-6">
          <div className="h-3 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
          <div className="h-10 w-72 bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="h-3 w-48 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
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

        {/* ── Page header */}
        <motion.div
          className="mb-8 sm:mb-10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href="/races"
            className="f-mono text-[11px] tracking-widest text-zinc-600 hover:text-[#ff6a52] transition-colors mb-4 inline-flex items-center gap-1.5"
          >
            ← BACK TO CALENDAR
          </Link>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-block w-8 h-[3px] rounded-full" style={{ background: F1.red }} />
            <span className="f-mono text-[11px] tracking-[0.3em] text-zinc-500 uppercase">
              {race?.circuit?.country && `${countryFlag} `}
              {race?.date ? race.date.slice(0, 4) : "2026"}
              {race?.roundNumber ? ` · ROUND ${race.roundNumber}` : ""}
              {race?.circuit?.country ? ` · ${race.circuit.country.toUpperCase()}` : ""}
            </span>
          </div>

          <h1 className="f-cond font-black tracking-tight leading-[0.85]" style={{ fontSize: "clamp(40px,7vw,76px)" }}>
            <span className="block text-white">{race?.name?.toUpperCase().replace(/ GRAND PRIX$/, "") || "RACE"}</span>
            <span
              className="block text-transparent bg-clip-text"
              style={{ backgroundImage: `linear-gradient(90deg, ${F1.red}, ${F1.orange})` }}
            >
              RACE RESULTS
            </span>
          </h1>

          {race?.circuit?.name && (
            <p className="f-mono text-xs text-zinc-500 mt-2">{race.circuit.name}</p>
          )}
        </motion.div>

        {/* ── Submitted success banner */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              className="border rounded-2xl px-5 py-4 mb-6 flex items-center gap-3"
              style={{ background: "rgba(0,230,118,.07)", borderColor: "rgba(0,230,118,.2)" }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <span className="text-[#00E676] text-sm f-mono">✓ Results submitted — Championship standings updated automatically</span>
              <Link href="/standings" className="text-xs text-[#00E676] hover:text-emerald-300 f-mono ml-auto">VIEW STANDINGS →</Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Feedback toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              className={`mb-4 text-xs f-mono px-4 py-2.5 rounded-xl border inline-flex items-center gap-2 ${feedback.startsWith("✓") ? "text-[#00E676] border-[#00E676]/25 bg-[#00E676]/08" : "text-red-400 border-red-500/25 bg-red-500/08"}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── VIEW MODE */}
        {mode === "view" && existingResults.length > 0 ? (
          <div className="space-y-8">

            {/* Action bar */}
            <motion.div
              className="flex flex-wrap items-center gap-3 justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={handleResync}
                disabled={resyncing}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all f-mono ${resyncing ? "border-zinc-700 text-zinc-500" : "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/08"}`}
              >
                {resyncing ? (
                  <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />RE-SYNCING...</>
                ) : "⚠ RE-SYNC (PENALTY)"}
              </button>
              <button
                onClick={() => { setMode("edit"); initRows(drivers); }}
                className="text-xs border border-zinc-700 hover:border-[#E10600]/40 text-zinc-500 hover:text-[#ff6a52] px-4 py-2 rounded-xl transition-all f-mono"
              >
                EDIT RESULTS
              </button>
            </motion.div>

            {/* Podium visualization */}
            {hasPodium && (
              <div>
                <motion.div
                  className="flex items-center gap-2 mb-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="inline-block w-5 h-[2px]" style={{ background: F1.gold }} />
                  <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500">PODIUM FINISH</span>
                </motion.div>

                {/* P2 | P1 | P3 layout */}
                <div
                  className="relative rounded-2xl border p-6 sm:p-8 overflow-hidden"
                  style={{ background: F1.card, borderColor: F1.hairline }}
                >
                  {/* Gold glow behind P1 */}
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-48 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(255,210,0,.10) 0%, transparent 70%)", filter: "blur(30px)" }}
                  />
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${F1.gold}50, transparent)` }} />

                  {/* Podium row: P2, P1, P3 */}
                  <div className="flex items-end justify-center gap-2 sm:gap-4">
                    <PodiumBlock result={p2} pos={2} delay={0.3} />
                    <PodiumBlock result={p1} pos={1} delay={0.1} />
                    <PodiumBlock result={p3} pos={3} delay={0.5} />
                  </div>
                </div>
              </div>
            )}

            {/* Full classification table */}
            <div>
              <motion.div
                className="flex items-center gap-2 mb-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <span className="inline-block w-5 h-[2px]" style={{ background: F1.red }} />
                <span className="f-mono text-[10px] tracking-[0.35em] text-zinc-500">FULL CLASSIFICATION</span>
                <span className="ml-auto f-mono text-[10px] text-[#00E676] border border-[#00E676]/25 bg-[#00E676]/08 px-3 py-1 rounded-lg font-bold">✓ RACE COMPLETE</span>
              </motion.div>

              <div
                className="rounded-2xl border overflow-hidden"
                style={{ background: F1.card, borderColor: F1.hairline }}
              >
                {/* Top accent */}
                <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${F1.red}70, transparent)` }} />

                {/* Table header */}
                <div className="grid grid-cols-[40px_1fr_auto_auto_auto] sm:grid-cols-[48px_1fr_auto_auto_auto_auto] gap-0 border-b px-4 sm:px-6 py-3"
                  style={{ borderColor: "rgba(255,255,255,.06)" }}>
                  {["POS", "DRIVER", "TEAM", "GAP", "FL", "PTS"].map((h, i) => (
                    <span
                      key={h}
                      className={`f-mono text-[10px] tracking-widest text-zinc-600 ${i === 0 ? "text-left" : i === 1 ? "text-left" : i >= 4 ? "text-center" : "text-right"} ${i === 2 ? "hidden sm:block pr-6" : ""} ${i === 3 ? "text-right pr-6 hidden sm:block" : ""}`}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {sorted.map((r, idx) => {
                  const isDNF = !!r.dnfReason;
                  const isP1 = !isDNF && r.finishPosition === 1;
                  const tc = getTeamColor(r.teamName, r.teamColor);
                  const winnerResult = sorted.find(x => !x.dnfReason && x.finishPosition === 1);
                  // Gap: not computed server-side, so just show position delta label
                  const isTop3 = !isDNF && r.finishPosition <= 3;

                  return (
                    <motion.div
                      key={r.id}
                      className="grid grid-cols-[40px_1fr_auto_auto_auto] sm:grid-cols-[48px_1fr_auto_auto_auto_auto] items-center px-4 sm:px-6 py-3 border-b transition-colors group"
                      style={{
                        borderColor: "rgba(255,255,255,.04)",
                        background: isP1
                          ? "rgba(255,210,0,.045)"
                          : isTop3
                          ? "rgba(255,255,255,.015)"
                          : "transparent",
                      }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: isDNF ? 0.45 : 1, x: 0 }}
                      transition={{ duration: 0.35, delay: 0.05 + idx * 0.025 }}
                      whileHover={{ backgroundColor: "rgba(255,255,255,.03)" }}
                    >
                      {/* Position */}
                      <div>
                        <span
                          className="f-cond font-black text-xl leading-none"
                          style={{
                            color: isDNF ? "#52525b"
                              : r.finishPosition === 1 ? F1.gold
                              : r.finishPosition === 2 ? "#C0C0C0"
                              : r.finishPosition === 3 ? "#CD7F32"
                              : "#52525b",
                          }}
                        >
                          {isDNF ? "DNF" : r.finishPosition}
                        </span>
                      </div>

                      {/* Driver */}
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div className="w-[3px] h-9 rounded-full flex-shrink-0" style={{ background: tc }} />
                        <div className="min-w-0">
                          <p className={`f-cond font-black text-base leading-tight truncate ${isP1 ? "text-[#FFD200]" : "text-white"}`}>
                            {r.driverName}
                          </p>
                          {isDNF && (
                            <p className="f-mono text-[10px] text-zinc-600 truncate">{r.dnfReason}</p>
                          )}
                        </div>
                      </div>

                      {/* Team — hidden on xs */}
                      <div className="hidden sm:flex items-center pr-6">
                        <span
                          className="f-mono text-[10px] font-bold px-2.5 py-0.5 rounded truncate"
                          style={{ color: tc, background: `${tc}15` }}
                        >
                          {r.teamName}
                        </span>
                      </div>

                      {/* Gap placeholder — hidden on xs */}
                      <div className="hidden sm:flex items-center justify-end pr-6">
                        {isP1 && winnerResult ? (
                          <span className="f-mono text-[10px] text-[#FFD200]">WINNER</span>
                        ) : isDNF ? (
                          <span className="f-mono text-[10px] text-zinc-700">—</span>
                        ) : (
                          <span className="f-mono text-[10px] text-zinc-600">+{r.finishPosition - 1} LAP{r.finishPosition - 1 !== 1 ? "S" : ""}</span>
                        )}
                      </div>

                      {/* Fastest lap */}
                      <div className="flex items-center justify-center">
                        {r.hasFastestLap && (
                          <span className="f-mono text-[9px] text-purple-300 bg-purple-500/15 border border-purple-500/25 px-2 py-0.5 rounded whitespace-nowrap">
                            ⚡ FL
                          </span>
                        )}
                      </div>

                      {/* Points */}
                      <div className="flex items-center justify-end">
                        <span className={`f-cond font-black text-lg ${isP1 ? "text-[#FFD200]" : r.points > 0 ? "text-white" : "text-zinc-700"}`}>
                          {r.points}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

        ) : mode === "view" && existingResults.length === 0 ? (
          // No data yet — premium empty state
          <motion.div
            className="flex flex-col items-center justify-center text-center py-24 border border-dashed rounded-2xl"
            style={{ borderColor: "rgba(255,255,255,.07)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mb-5"
              style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
              <span className="text-2xl">🏁</span>
            </div>
            <p className="f-cond font-black text-xl text-white mb-1">Results Not Available</p>
            <p className="f-mono text-xs text-zinc-500 max-w-xs">
              Session not yet complete · Results will appear here once the race has finished
            </p>
          </motion.div>

        ) : (
          // ── EDIT MODE
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div
              className="rounded-2xl border overflow-hidden mb-5"
              style={{ background: F1.card, borderColor: F1.hairline }}
            >
              <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${F1.red}60, transparent)` }} />
              <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,.06)" }}>
                <span className="inline-block w-5 h-[2px]" style={{ background: F1.red }} />
                <div>
                  <h2 className="f-mono text-[11px] tracking-[0.3em] text-zinc-400">INPUT RACE RESULTS</h2>
                  <p className="f-mono text-[10px] text-zinc-600 mt-0.5">Set finish positions, mark DNFs, and select the fastest lap driver</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
                      {["DRIVER", "START", "FINISH", "FL", "DNF REASON"].map(h => (
                        <th key={h} className={`px-4 py-3 f-mono text-[10px] tracking-widest text-zinc-600 ${h === "DRIVER" ? "text-left" : "text-center"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const tc = getTeamColor(row.teamName, row.teamColor);
                      return (
                        <tr key={row.driverId} className="border-b transition-colors hover:bg-white/[0.015]" style={{ borderColor: "rgba(255,255,255,.04)" }}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-[3px] h-9 rounded-full flex-shrink-0" style={{ background: tc }} />
                              <div>
                                <p className="f-cond font-black text-white text-sm">{row.driverName}</p>
                                <p className="f-mono text-[10px]" style={{ color: tc }}>#{row.carNumber}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="number" min="1" max="22" value={row.startPosition}
                              onChange={e => updateRow(i, "startPosition", Number(e.target.value))}
                              className="w-14 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-red-500/50 f-mono"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="number" min="1" max="22" value={row.finishPosition}
                              onChange={e => updateRow(i, "finishPosition", Number(e.target.value))}
                              disabled={!!row.dnfReason}
                              className="w-14 bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-center text-white text-sm focus:outline-none focus:border-red-500/50 disabled:opacity-40 f-mono"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input type="checkbox" checked={row.hasFastestLap}
                              onChange={e => updateRow(i, "hasFastestLap", e.target.checked)}
                              disabled={!!row.dnfReason}
                              className="w-4 h-4 accent-purple-500 cursor-pointer disabled:opacity-40"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input type="text" placeholder="e.g. Mechanical, Accident..." value={row.dnfReason}
                              onChange={e => updateRow(i, "dnfReason", e.target.value)}
                              className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-red-500/50 placeholder-zinc-700 f-mono"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="f-mono text-[10px] text-zinc-600">Points scale: 25-18-15-12-10-8-6-4-2-1 · +1 fastest lap (top 10 finishers)</p>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 rounded-xl f-cond font-black text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={!submitting ? { background: `linear-gradient(135deg, ${F1.red}, #dc2626)`, boxShadow: `0 0 24px rgba(225,6,0,.3)` } : { background: "#27272a" }}
              >
                {submitting ? "SUBMITTING..." : "SUBMIT RESULTS →"}
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
