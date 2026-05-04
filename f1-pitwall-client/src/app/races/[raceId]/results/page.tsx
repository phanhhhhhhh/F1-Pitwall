"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { authFetch, getAccessToken } from "../../../lib/pitwall-auth";
import Navbar from "../../../components/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface Driver {
  id: number;
  name: string;
  carNumber: number;
  team: { name: string; colorHex: string };
}

interface ResultRow {
  driverId: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  carNumber: number;
  startPosition: number;
  finishPosition: number;
  hasFastestLap: boolean;
  fastestLapTime: number;
  dnfReason: string;
}

interface RaceResultResponse {
  id: number;
  finishPosition: number;
  driverName: string;
  teamName: string;
  teamColor: string;
  points: number;
  hasFastestLap: boolean;
  dnfReason: string;
}

export default function RaceResultsPage() {
  const router = useRouter();
  const params = useParams();
  const raceId = params.raceId as string;

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
      const [raceData, driversData, resultsData] = await Promise.all([
        raceRes.json(), driversRes.json(), resultsRes.json(),
      ]);
      setRace(raceData);
      setDrivers(driversData);
      setExistingResults(resultsData);
      if (resultsData.length > 0) setMode("view");
      else { initRows(driversData); setMode("edit"); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const initRows = (driversData: Driver[]) => {
    const sorted = [...driversData].sort((a, b) => a.carNumber - b.carNumber);
    setRows(sorted.map((d, i) => ({
      driverId: d.id, driverName: d.name,
      teamName: d.team?.name || "", teamColor: d.team?.colorHex || "#666",
      carNumber: d.carNumber, startPosition: i + 1, finishPosition: i + 1,
      hasFastestLap: false, fastestLapTime: 0, dnfReason: "",
    })));
  };

  const updateRow = (index: number, field: keyof ResultRow, value: any) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "hasFastestLap" && value === true) {
        next.forEach((r, i) => { if (i !== index) next[i] = { ...next[i], hasFastestLap: false }; });
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = rows.map(r => ({
        driverId: r.driverId, startPosition: r.startPosition,
        finishPosition: r.finishPosition, hasFastestLap: r.hasFastestLap,
        fastestLapTime: r.fastestLapTime, fastestLapNumber: 0,
        dnfReason: r.dnfReason || null,
      }));
      const res = await authFetch(`${API}/api/race-results/race/${raceId}`, {
        method: "POST", body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setExistingResults(data);
        setMode("view");
        setSubmitted(true);
      } else {
        alert("Failed to submit results.");
      }
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  // Re-sync từ OpenF1 — dùng khi có penalty thay đổi thứ hạng
  const handleResync = async () => {
    if (!confirm("Re-sync sẽ xóa kết quả hiện tại và fetch lại từ OpenF1.\nTiếp tục?")) return;
    setResyncing(true);
    setFeedback("");
    try {
      const res = await authFetch(`${API}/api/sync/race/${raceId}/results`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setFeedback("✓ Re-sync thành công!");
        await fetchData();
      } else {
        setFeedback("✗ Re-sync thất bại: " + (data.error || "unknown error"));
      }
    } catch (e) {
      setFeedback("✗ Lỗi kết nối");
    } finally {
      setResyncing(false);
      setTimeout(() => setFeedback(""), 4000);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950"><Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 animate-pulse font-mono text-sm">LOADING...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <Link href="/races" className="text-zinc-600 hover:text-zinc-400 text-xs font-mono mb-3 block">← BACK TO RACES</Link>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
              Round {race?.roundNumber} · {race?.date}
            </p>
            <h1 className="text-3xl font-black tracking-tighter text-white">{race?.name}</h1>
            <p className="text-zinc-500 text-sm mt-1">{race?.circuit?.name} · {race?.circuit?.country}</p>
          </div>
          <div className="flex items-center gap-3">
            {feedback && (
              <span className={`text-xs font-mono px-3 py-1.5 rounded border ${
                feedback.startsWith("✓") ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-red-400 border-red-500/30 bg-red-500/10"
              }`}>{feedback}</span>
            )}
            {mode === "view" && existingResults.length > 0 && (
              <>
                <button onClick={handleResync} disabled={resyncing}
                  className={`text-xs border px-4 py-2 rounded-lg transition-all font-mono flex items-center gap-2 ${
                    resyncing ? "border-zinc-700 text-zinc-500" : "border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  }`}>
                  {resyncing ? (
                    <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />RE-SYNCING...</>
                  ) : "⚠️ RE-SYNC (PENALTY)"}
                </button>
                <button onClick={() => { setMode("edit"); initRows(drivers); }}
                  className="text-xs border border-zinc-700 hover:border-red-500 text-zinc-500 hover:text-red-400 px-4 py-2 rounded-lg transition-all font-mono">
                  EDIT RESULTS
                </button>
              </>
            )}
          </div>
        </div>

        {submitted && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <span className="text-green-400 text-sm">✓ Results submitted — Championship standings updated automatically</span>
            <Link href="/standings" className="text-xs text-green-400 hover:text-green-300 font-mono ml-auto">VIEW STANDINGS →</Link>
          </div>
        )}

        {mode === "view" && existingResults.length > 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-300 tracking-widest">RACE RESULTS</h2>
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded font-mono">COMPLETED</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">POS</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">DRIVER</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500 hidden md:table-cell">TEAM</th>
                  <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500">FL</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-zinc-500">PTS</th>
                </tr>
              </thead>
              <tbody>
                {existingResults.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                    <td className="px-4 py-3">
                      <span className={`text-lg font-black ${r.finishPosition === 1 ? "text-yellow-400" : r.finishPosition === 2 ? "text-zinc-300" : r.finishPosition === 3 ? "text-amber-600" : "text-zinc-600"}`}>
                        {r.dnfReason ? "DNF" : r.finishPosition}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: r.teamColor }} />
                        <span className="text-sm font-bold text-white">{r.driverName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-bold" style={{ color: r.teamColor }}>{r.teamName}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.hasFastestLap && <span className="text-xs text-purple-400 font-mono bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded">FL</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-black text-white">{r.points}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-zinc-800">
                <h2 className="text-sm font-bold text-zinc-300 tracking-widest">INPUT RACE RESULTS</h2>
                <p className="text-xs text-zinc-600 mt-1">Set finish positions, mark DNFs, and select the fastest lap driver</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">DRIVER</th>
                      <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500">START</th>
                      <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500">FINISH</th>
                      <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500">FL</th>
                      <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">DNF REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.driverId} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: row.teamColor }} />
                            <div>
                              <p className="text-sm font-bold text-white">{row.driverName}</p>
                              <p className="text-xs font-mono" style={{ color: row.teamColor }}>#{row.carNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input type="number" min="1" max="22" value={row.startPosition}
                            onChange={e => updateRow(i, "startPosition", Number(e.target.value))}
                            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-red-500" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input type="number" min="1" max="22" value={row.finishPosition}
                            onChange={e => updateRow(i, "finishPosition", Number(e.target.value))}
                            disabled={!!row.dnfReason}
                            className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-center text-white text-sm focus:outline-none focus:border-red-500 disabled:opacity-40" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input type="checkbox" checked={row.hasFastestLap}
                            onChange={e => updateRow(i, "hasFastestLap", e.target.checked)}
                            disabled={!!row.dnfReason}
                            className="w-4 h-4 accent-purple-500 cursor-pointer disabled:opacity-40" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="text" placeholder="e.g. Mechanical, Accident..."
                            value={row.dnfReason}
                            onChange={e => updateRow(i, "dnfReason", e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 placeholder-zinc-600" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-600 font-mono">Points: 25-18-15-12-10-8-6-4-2-1 · +1 fastest lap (top 10 only)</p>
              <button onClick={handleSubmit} disabled={submitting}
                className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-bold px-8 py-3 rounded-lg transition-colors text-sm">
                {submitting ? "SUBMITTING..." : "SUBMIT RESULTS →"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
