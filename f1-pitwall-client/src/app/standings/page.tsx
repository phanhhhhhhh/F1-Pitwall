"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import { useSeason } from "../context/SeasonContext";
import {
  downloadDriverStandingsCsv,
  downloadConstructorStandingsCsv,
  downloadStandingsPdf,
} from "../lib/export";
import Navbar from "../components/Navbar";
import ExportButton from "../components/ExportButton";
import Link from "next/link";
import { SkeletonTable } from "../components/LoadingSkeleton";
import PodiumSpotlight from "../components/PodiumSpotlight";
import dynamic from "next/dynamic";
import { useCountUp } from "../lib/f1-theme";
import type { DriverStanding, ConstructorStanding } from "../types/f1";
import StandingsBumpChart from "../components/StandingsBumpChart";
import ChampionshipCalculator from "../components/ChampionshipCalculator";

const GapToLeaderChart = dynamic(() => import("../components/GapToLeaderChart"), { ssr: false });

const Pts = ({ points, delay = 0 }: { points: number; delay?: number }) => <>{useCountUp(Math.round(points), 900, delay)}</>;

const MEDAL = ["#FFD23F", "#C8CDD4", "#D8853B"];

export default function StandingsPage() {
  const { season } = useSeason();
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [drivers, setDrivers] = useState<DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [viewFeature, setViewFeature] = useState<"table" | "bump" | "calculator" | "gap">("table");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [d, c] = await Promise.all([
          authFetch(`${API}/api/race-results/standings/drivers/${season}`),
          authFetch(`${API}/api/race-results/standings/constructors/${season}`),
        ]);
        setDrivers(await d.json());
        setConstructors(await c.json());
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Failed to load standings data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [season]);

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-carbon">
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-[3px] bg-red-600 rounded-full shadow-[0_0_8px_#E10600]" />
              <span className="f-mono text-xs text-red-500 font-bold tracking-widest uppercase">
                {season} WORLD CHAMPIONSHIP
              </span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black f-cond tracking-tight uppercase">
              CHAMPIONSHIP <span className="text-red-600">STANDINGS</span>
            </h1>
            {drivers[0] && (
              <p className="f-mono text-xs text-zinc-400 mt-2 font-bold">
                CHAMPIONSHIP LEADER: <span className="text-white">{drivers[0].driverName}</span>
                <span className="text-amber-400 ml-2">({Math.round(drivers[0].totalPoints)} PTS)</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton
              label="CSV"
              variant="csv"
              onClick={() =>
                tab === "drivers"
                  ? downloadDriverStandingsCsv(season)
                  : downloadConstructorStandingsCsv(season)
              }
            />
            <ExportButton label="PDF Report" variant="pdf" onClick={() => downloadStandingsPdf(season)} />
            <Link
              href="/races"
              className="f-mono text-xs text-zinc-400 hover:text-white border border-zinc-700/80 bg-black/40 px-3.5 py-2 rounded-xl transition-all font-bold"
            >
              ← RACE CALENDAR
            </Link>
          </div>
        </div>

        {/* 3D Podium Spotlight for Top 3 */}
        {tab === "drivers" && drivers.length >= 3 && (
          <PodiumSpotlight standings={drivers} />
        )}

        {/* Tabs + Feature View Selector */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded-2xl border border-zinc-800">
            {(["drivers", "constructors"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-xl f-cond font-bold text-xs sm:text-sm tracking-wider transition-all uppercase ${
                  tab === t
                    ? "bg-red-600 text-white shadow-[0_0_12px_rgba(225,6,0,0.5)]"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t === "drivers" ? "🏎 DRIVERS (WDC)" : "🏗 CONSTRUCTORS (WCC)"}
              </button>
            ))}
          </div>

          {!loading && (
            <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-zinc-800 flex-wrap">
              {[
                { id: "table", label: "📋 TABLE" },
                { id: "bump", label: "📈 BUMP CHART" },
                { id: "calculator", label: "🔮 TITLE SIMULATOR" },
                { id: "gap", label: "📊 GAP TRAJECTORY" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setViewFeature(f.id as typeof viewFeature)}
                  className={`px-3 py-1.5 rounded-xl f-mono text-xs font-bold tracking-wider transition-all ${
                    viewFeature === f.id
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl border border-red-800 bg-red-950/40 text-sm text-red-300 f-mono">
            {error}
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={10} cols={6} />
        ) : (
          <>
            {viewFeature === "bump" && (
              <div className="mb-6">
                <StandingsBumpChart
                  drivers={drivers}
                  constructors={constructors}
                  type={tab}
                />
              </div>
            )}

            {viewFeature === "calculator" && (
              <div className="mb-6">
                <ChampionshipCalculator initialStandings={drivers} season={season} />
              </div>
            )}

            {viewFeature === "gap" && (drivers.length > 0 || constructors.length > 0) && (
              <div className="mb-6">
                <GapToLeaderChart drivers={drivers} constructors={constructors} tab={tab} />
              </div>
            )}

            {tab === "drivers" ? (
              <div className="rounded-3xl border border-zinc-800 bg-black/70 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-12 gap-2 px-6 py-3.5 border-b border-zinc-800 f-mono text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
                  <div className="col-span-1">POS</div>
                  <div className="col-span-5 sm:col-span-4">DRIVER</div>
                  <div className="col-span-3 hidden sm:block">TEAM</div>
                  <div className="col-span-1 text-center">WINS</div>
                  <div className="col-span-2 sm:col-span-1 text-right">GAP</div>
                  <div className="col-span-3 sm:col-span-2 text-right">TOTAL PTS</div>
                </div>

                {drivers.map((d, i) => {
                  const col = d.teamColor || "#E10600";
                  return (
                    <div
                      key={d.driverId}
                      className={`relative grid grid-cols-12 gap-2 px-6 py-4 border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/60 ${
                        i === 0 ? "bg-red-950/20" : ""
                      }`}
                      onMouseEnter={() => setHovered(d.driverId)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {hovered === d.driverId && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ background: col, boxShadow: `0 0 10px ${col}` }}
                        />
                      )}
                      <div className="col-span-1 flex items-center">
                        <span
                          className="f-orbitron font-black text-xl tabular-nums"
                          style={{ color: i < 3 ? MEDAL[i] : "#71717a" }}
                        >
                          {d.position}
                        </span>
                      </div>
                      <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0">
                        <span
                          className="w-1.5 h-8 rounded-full flex-shrink-0"
                          style={{ background: col, boxShadow: `0 0 8px ${col}80` }}
                        />
                        <div className="min-w-0">
                          <p className="f-cond font-bold text-base text-white truncate uppercase tracking-wide">
                            {d.driverName}
                          </p>
                          <p className="f-mono text-[10px] font-bold" style={{ color: col }}>
                            #{d.carNumber}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-3 hidden sm:flex items-center">
                        <span
                          className="f-mono text-xs px-2.5 py-1 rounded-lg font-bold"
                          style={{ color: col, background: `${col}18` }}
                        >
                          {d.teamName}
                        </span>
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <span className={`f-cond font-bold text-base ${d.wins > 0 ? "text-amber-400" : "text-zinc-600"}`}>
                          {d.wins}
                        </span>
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                        <span className="f-mono text-xs text-zinc-400">
                          {d.gapToLeader > 0 ? `-${Math.round(d.gapToLeader)}` : "—"}
                        </span>
                      </div>
                      <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
                        <span
                          className="f-orbitron font-black text-lg tabular-nums"
                          style={{ color: i === 0 ? "#E10600" : "#fff" }}
                        >
                          <Pts points={d.totalPoints} delay={i * 30} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {constructors.map((c, i) => {
                  const col = c.teamColor || "#E10600";
                  return (
                    <div
                      key={c.teamId}
                      className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-black/70 p-5 sm:p-6 shadow-xl transition-transform hover:-translate-y-1"
                    >
                      <div className="h-[3px] w-full absolute top-0 left-0 right-0" style={{ background: col, boxShadow: `0 0 12px ${col}` }} />
                      <div className="flex items-center gap-4 sm:gap-6">
                        <span
                          className="f-orbitron font-black text-3xl sm:text-4xl tabular-nums w-12 text-center"
                          style={{ color: i < 3 ? MEDAL[i] : "#71717a" }}
                        >
                          {c.position}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h2 className="f-cond font-black text-2xl text-white uppercase tracking-wide truncate">
                            {c.teamName}
                          </h2>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {[{ n: c.driver1Name, p: c.driver1Points }, { n: c.driver2Name, p: c.driver2Points }]
                              .filter((x) => x.n)
                              .map((x, di) => (
                                <span key={di} className="f-mono text-xs text-zinc-400 font-bold">
                                  {x.n.split(" ").pop()} <span className="text-white font-black">{Math.round(x.p)}</span> PTS
                                </span>
                              ))}
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-6 text-center">
                          <div>
                            <div className="f-orbitron font-black text-xl text-amber-400">{c.wins}</div>
                            <div className="f-mono text-[9px] text-zinc-500 font-bold uppercase">WINS</div>
                          </div>
                          <div>
                            <div className="f-orbitron font-black text-xl text-white">{c.podiums}</div>
                            <div className="f-mono text-[9px] text-zinc-500 font-bold uppercase">PODIUMS</div>
                          </div>
                        </div>
                        <div className="text-right min-w-[80px]">
                          {c.gapToLeader > 0 && (
                            <p className="f-mono text-[10px] text-zinc-500 font-bold mb-0.5">-{Math.round(c.gapToLeader)}</p>
                          )}
                          <p
                            className="f-orbitron font-black text-3xl leading-none"
                            style={{ color: i === 0 ? "#E10600" : "#fff" }}
                          >
                            <Pts points={c.totalPoints} delay={i * 50} />
                          </p>
                          <p className="f-mono text-[9px] text-zinc-500 font-bold tracking-widest mt-1 uppercase">PTS</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
