"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const NATIONALITY_FLAGS: Record<string, string> = {
  "British": "🇬🇧", "Australian": "🇦🇺", "Dutch": "🇳🇱", "French": "🇫🇷",
  "German": "🇩🇪", "Spanish": "🇪🇸", "Finnish": "🇫🇮", "Canadian": "🇨🇦",
  "Mexican": "🇲🇽", "Brazilian": "🇧🇷", "Italian": "🇮🇹", "Monegasque": "🇲🇨",
  "Thai": "🇹🇭", "New Zealander": "🇳🇿", "Argentine": "🇦🇷", "New Zealand": "🇳🇿",
};

const COUNTRY_FLAGS: Record<string, string> = {
  "United Kingdom": "🇬🇧", "Italy": "🇮🇹", "Austria": "🇦🇹", "Germany": "🇩🇪",
  "France": "🇫🇷", "United States": "🇺🇸",
};

interface Driver { id: number; name: string; carNumber: number; nationality: string; }
interface Team {
  id: number; name: string; country: string; colorHex: string;
  championships: number; annualBudgetM: number; base: string; foundedYear: number;
}

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    Promise.all([
      authFetch(`${API}/api/teams`).then(r => r.json()),
      authFetch(`${API}/api/drivers`).then(r => r.json()),
    ]).then(([t, d]) => { setTeams(t); setDrivers(d); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const getTeamDrivers = (teamName: string) =>
    drivers.filter((d: any) => d.team?.name === teamName);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">
        <div className="mb-10">
          <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">
            2026 Season · {teams.length} Constructors
          </p>
          <h1 className="text-4xl font-black tracking-tighter text-white">
            CONSTRUCTOR <span className="text-red-500">STANDINGS</span>
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            LOADING...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {teams.map((team, i) => {
              const teamDrivers = getTeamDrivers(team.name);
              return (
                <div key={team.id} className="group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all duration-300">
                  {/* Top color bar */}
                  <div className="h-1 w-full" style={{ backgroundColor: team.colorHex }} />

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-zinc-600">#{i + 1}</span>
                          <span className="text-sm">{COUNTRY_FLAGS[team.country] || "🏴"}</span>
                        </div>
                        <h2 className="text-xl font-black text-white">{team.name}</h2>
                        <p className="text-xs text-zinc-500 mt-1">{team.country} · Est. {team.foundedYear}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-black" style={{ color: team.colorHex }}>
                          {team.championships}
                        </p>
                        <p className="text-xs text-zinc-600">TITLES</p>
                      </div>
                    </div>

                    {/* Drivers */}
                    {teamDrivers.length > 0 && (
                      <div className="flex gap-2 mb-4">
                        {teamDrivers.map((d: any) => (
                          <div key={d.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2 flex-1">
                            <span className="text-sm">{NATIONALITY_FLAGS[d.nationality] || "🏴"}</span>
                            <div>
                              <p className="text-xs font-bold text-white">{d.name.split(" ").pop()}</p>
                              <p className="text-xs text-zinc-500 font-mono">#{d.carNumber}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                      <div>
                        <p className="text-xs text-zinc-600 mb-1">BASE</p>
                        <p className="text-sm text-zinc-300 font-mono">{team.base}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-600 mb-1">BUDGET</p>
                        <p className="text-sm font-mono" style={{ color: team.colorHex }}>${team.annualBudgetM}M</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
