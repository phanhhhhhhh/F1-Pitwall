"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface DriverStanding {
  position: number;
  driverId: number;
  driverName: string;
  carNumber: number;
  nationality: string;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  gapToLeader: number;
  gapToAhead: number;
}

interface ConstructorStanding {
  position: number;
  teamId: number;
  teamName: string;
  teamColor: string;
  country: string;
  totalPoints: number;
  wins: number;
  podiums: number;
  gapToLeader: number;
  driver1Name: string;
  driver2Name: string;
  driver1Points: number;
  driver2Points: number;
}

export default function StandingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchStandings();
  }, []);

  const fetchStandings = async () => {
    try {
      const [dRes, cRes] = await Promise.all([
        authFetch(`${API}/api/race-results/standings/drivers/2026`),
        authFetch(`${API}/api/race-results/standings/constructors/2026`),
      ]);
      setDrivers(await dRes.json());
      setConstructors(await cRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const maxPoints = drivers[0]?.totalPoints || 1;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">

        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
              2026 Season · Live Standings
            </p>
            <h1 className="text-4xl font-black tracking-tighter text-white">
              CHAMPIONSHIP <span className="text-red-500">STANDINGS</span>
            </h1>
          </div>
          <Link href="/races" className="text-xs text-zinc-500 hover:text-red-400 font-mono border border-zinc-700 hover:border-red-500 px-4 py-2 rounded-lg transition-all">
            ← RACE CALENDAR
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(["drivers", "constructors"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg text-xs font-bold border transition-all ${
                tab === t ? "bg-red-500/20 border-red-500 text-red-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
              }`}>
              {t === "drivers" ? "DRIVERS" : "CONSTRUCTORS"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" /> LOADING STANDINGS...
          </div>
        ) : tab === "drivers" ? (
          /* Driver Standings Table */
          drivers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-zinc-500 text-lg mb-2">No results yet</p>
              <p className="text-zinc-700 text-sm font-mono">Submit race results to see standings</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">POS</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">DRIVER</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500 hidden md:table-cell">TEAM</th>
                    <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500">W</th>
                    <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500 hidden sm:table-cell">POD</th>
                    <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500 hidden sm:table-cell">FL</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-zinc-500">GAP</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-zinc-500">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.driverId} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                      <td className="px-4 py-3">
                        <span className={`text-lg font-black ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-600"}`}>
                          {d.position}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-0.5 h-8 rounded-full" style={{ backgroundColor: d.teamColor }} />
                          <div>
                            <p className="text-sm font-bold text-white">{d.driverName}</p>
                            <p className="text-xs text-zinc-500 font-mono">#{d.carNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-bold" style={{ color: d.teamColor }}>{d.teamName}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-white">{d.wins}</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-sm text-zinc-400">{d.podiums}</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="text-sm text-zinc-400">{d.fastestLaps}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-mono text-zinc-500">
                          {d.gapToLeader > 0 ? `-${d.gapToLeader.toFixed(0)}` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div>
                          <span className="text-sm font-black text-white">{d.totalPoints.toFixed(0)}</span>
                          {/* Points bar */}
                          <div className="w-16 h-1 bg-zinc-800 rounded-full mt-1 ml-auto">
                            <div className="h-full rounded-full" style={{ width: `${(d.totalPoints / maxPoints) * 100}%`, backgroundColor: d.teamColor }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Constructor Standings */
          constructors.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-zinc-500 text-lg mb-2">No results yet</p>
              <p className="text-zinc-700 text-sm font-mono">Submit race results to see standings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {constructors.map((c, i) => (
                <div key={c.teamId} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all">
                  <div className="h-0.5 w-full" style={{ backgroundColor: c.teamColor }} />
                  <div className="flex items-center gap-6 px-6 py-4">
                    <span className={`text-3xl font-black w-8 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-zinc-700"}`}>
                      {c.position}
                    </span>
                    <div className="flex-1">
                      <h2 className="text-lg font-black text-white">{c.teamName}</h2>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-zinc-500">{c.driver1Name} <span className="text-white font-mono">{c.driver1Points.toFixed(0)}pts</span></span>
                        {c.driver2Name && (
                          <span className="text-xs text-zinc-500">{c.driver2Name} <span className="text-white font-mono">{c.driver2Points.toFixed(0)}pts</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-6 text-center hidden sm:flex">
                      <div>
                        <p className="text-lg font-black text-white">{c.wins}</p>
                        <p className="text-xs text-zinc-600">WINS</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-white">{c.podiums}</p>
                        <p className="text-xs text-zinc-600">POD</p>
                      </div>
                    </div>
                    <div className="text-right min-w-20">
                      {c.gapToLeader > 0 && <p className="text-xs text-zinc-600 font-mono">-{c.gapToLeader.toFixed(0)}</p>}
                      <p className="text-2xl font-black text-white">{c.totalPoints.toFixed(0)}</p>
                      <p className="text-xs text-zinc-600">PTS</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
