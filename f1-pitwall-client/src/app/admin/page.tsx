"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface User { id: number; username: string; email: string; role: "ADMIN" | "ENGINEER" | "VIEWER"; }
interface Stats {
  totalUsers: number; totalDrivers: number; totalTeams: number; totalRaces: number;
  totalRaceResults: number; totalNotifications: number; unreadNotifications: number;
  usersByRole: { ADMIN: number; ENGINEER: number; VIEWER: number };
}
interface SyncResult { synced: string[]; skipped: string[]; errors: string[]; total: number; }

const ROLE_COLORS = {
  ADMIN: "text-red-400 bg-red-500/10 border-red-500/30",
  ENGINEER: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  VIEWER: "text-zinc-400 bg-zinc-800/50 border-zinc-700",
};

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "users" | "data">("stats");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "VIEWER" });
  const [createError, setCreateError] = useState("");
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sRes, uRes] = await Promise.all([
        authFetch(`${API}/api/admin/stats`),
        authFetch(`${API}/api/admin/users`),
      ]);
      if (sRes.status === 403) { router.push("/"); return; }
      setStats(await sRes.json());
      setUsers(await uRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showFeedback = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); };

  const handleSyncAll = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await authFetch(`${API}/api/sync/all`, { method: "POST" });
      const data: SyncResult = await res.json();
      setSyncResult(data);
      showFeedback(`✓ Sync complete — ${data.total} sessions synced`);
      fetchData();
    } catch { showFeedback("✗ Sync failed"); }
    finally { setSyncing(false); }
  };

  const updateRole = async (userId: number, role: string) => {
    const res = await authFetch(`${API}/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    if (res.ok) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as User["role"] } : u)); showFeedback("✓ Role updated"); }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    const res = await authFetch(`${API}/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) { setUsers(prev => prev.filter(u => u.id !== user.id)); showFeedback("✓ User deleted"); fetchData(); }
    else { const d = await res.json(); alert(d.error || "Delete failed"); }
  };

  const resetPassword = async () => {
    if (!resetUser || newPassword.length < 6) return;
    const res = await authFetch(`${API}/api/admin/users/${resetUser.id}/password`, { method: "PATCH", body: JSON.stringify({ password: newPassword }) });
    if (res.ok) { setResetUser(null); setNewPassword(""); showFeedback("✓ Password reset"); }
  };

  const createUser = async () => {
    setCreateError("");
    if (!newUser.username || !newUser.password || !newUser.email) { setCreateError("All fields required"); return; }
    const res = await authFetch(`${API}/api/admin/users`, { method: "POST", body: JSON.stringify(newUser) });
    if (res.ok) {
      const created = await res.json();
      setUsers(prev => [...prev, created]);
      setShowCreate(false); setNewUser({ username: "", email: "", password: "", role: "VIEWER" });
      showFeedback("✓ User created"); fetchData();
    } else { const d = await res.json(); setCreateError(d.error || "Create failed"); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
      <style>{`
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes glow{0%,100%{opacity:.3}50%{opacity:.8}}
        .slide-up{animation:slideUp .4s ease-out both}
        .glow-pulse{animation:glow 3s ease-in-out infinite}
      `}</style>
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-zinc-950" />
        <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-red-500/4 rounded-full blur-[150px] glow-pulse" />
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>
      <Navbar />
      <main className="relative z-10 max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 slide-up">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">SYSTEM · ADMIN ONLY</p>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
              ADMIN<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PANEL</span>
            </h1>
          </div>
          {feedback && (
            <div className={`text-sm px-4 py-2 rounded-xl font-mono border ${feedback.startsWith("✓") ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              {feedback}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-xl p-1 w-fit mb-8 slide-up" style={{ animationDelay: "100ms" }}>
          {[{ key: "stats", label: "📊 DASHBOARD" }, { key: "users", label: "👥 USERS" }, { key: "data", label: "🔄 DATA SYNC" }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-2.5 rounded-lg text-xs font-black border transition-all ${tab === t.key ? "bg-red-500/10 border-red-500/50 text-red-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="text-red-500/70 font-mono text-xs tracking-widest animate-pulse">LOADING...</p>
          </div>
        ) : tab === "stats" && stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "TOTAL USERS", value: stats.totalUsers, color: "#ef4444" },
                { label: "DRIVERS", value: stats.totalDrivers, color: "#f97316" },
                { label: "TEAMS", value: stats.totalTeams, color: "#3b82f6" },
                { label: "RACE RESULTS", value: stats.totalRaceResults, color: "#22c55e" },
              ].map((s, i) => (
                <div key={s.label} className="relative bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 text-center slide-up hover:border-zinc-600/50 transition-all overflow-hidden"
                  style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${s.color}50,transparent)` }} />
                  <p className="text-5xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-zinc-600 font-mono mt-2 tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 slide-up" style={{ animationDelay: "250ms" }}>
                <h2 className="text-xs font-mono text-zinc-500 tracking-widest mb-5">USER ROLES</h2>
                <div className="space-y-4">
                  {(Object.entries(stats.usersByRole) as [string, number][]).map(([role, count]) => {
                    const c = role === "ADMIN" ? "#ef4444" : role === "ENGINEER" ? "#3b82f6" : "#71717a";
                    return (
                      <div key={role}>
                        <div className="flex justify-between text-xs mb-2">
                          <span className={`font-black px-2 py-0.5 rounded border ${ROLE_COLORS[role as keyof typeof ROLE_COLORS]}`}>{role}</span>
                          <span className="text-zinc-400 font-mono">{count} users</span>
                        </div>
                        <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(count / (stats.totalUsers || 1)) * 100}%`, backgroundColor: c, boxShadow: `0 0 6px ${c}60` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 slide-up" style={{ animationDelay: "300ms" }}>
                <h2 className="text-xs font-mono text-zinc-500 tracking-widest mb-5">DATA OVERVIEW</h2>
                <div className="space-y-3">
                  {[
                    { label: "Races in DB", value: stats.totalRaces, icon: "🏁" },
                    { label: "Race Results Synced", value: stats.totalRaceResults, icon: "📊" },
                    { label: "Notifications Total", value: stats.totalNotifications, icon: "🔔" },
                    { label: "Unread Notifications", value: stats.unreadNotifications, icon: "🔴" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
                      <div className="flex items-center gap-2.5"><span>{s.icon}</span><span className="text-sm text-zinc-400">{s.label}</span></div>
                      <span className="text-white font-black font-mono">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        ) : tab === "data" ? (
          <div className="space-y-5">
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 slide-up">
              <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
                <div>
                  <h2 className="text-lg font-black text-white mb-1">OpenF1 Auto-Sync</h2>
                  <p className="text-zinc-500 text-sm max-w-lg">Automatically fetch race and sprint results from OpenF1 API, correctly calculate points according to F1 system.</p>
                </div>
                <button onClick={handleSyncAll} disabled={syncing}
                  className={`relative overflow-hidden flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all ${syncing ? "bg-zinc-700/50 text-zinc-400 border border-zinc-600" : "text-white"}`}
                  style={!syncing ? { background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 20px rgba(239,68,68,0.3)" } : {}}>
                  {syncing ? (<><div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />SYNCING...</>) : <>🔄 SYNC ALL RESULTS</>}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Race Points", value: "25-18-15-12-10-8-6-4-2-1", color: "#ef4444" },
                  { label: "Sprint Points", value: "8-7-6-5-4-3-2-1", color: "#f97316" },
                  { label: "Auto-sync", value: "Every 1 hour", color: "#22c55e" },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl p-3 text-center">
                    <p className="text-xs font-mono font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600 font-mono bg-zinc-800/30 rounded-lg px-3 py-2 border border-zinc-700/20">
                ℹ️ Only sync completed races without results in DB · Fastest lap +1pt for top 10 (Race only)
              </p>
            </div>
            {syncResult && (
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700/50 rounded-2xl p-6 slide-up">
                <h3 className="text-xs font-mono text-zinc-500 tracking-widest mb-5">SYNC RESULTS</h3>
                {syncResult.synced.length > 0 && <div className="mb-4"><p className="text-xs font-mono text-green-400 mb-2">✅ SYNCED ({syncResult.synced.length})</p><div className="space-y-1">{syncResult.synced.map((s, i) => <div key={i} className="text-xs text-zinc-300 bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2 font-mono">🏁 {s}</div>)}</div></div>}
                {syncResult.skipped.length > 0 && <div className="mb-4"><p className="text-xs font-mono text-zinc-500 mb-2">⏭️ SKIPPED ({syncResult.skipped.length})</p><div className="space-y-1 max-h-48 overflow-y-auto">{syncResult.skipped.map((s, i) => <div key={i} className="text-xs text-zinc-600 bg-zinc-800/40 rounded-lg px-3 py-1.5 font-mono">{s}</div>)}</div></div>}
                {syncResult.errors.length > 0 && <div><p className="text-xs font-mono text-red-400 mb-2">❌ ERRORS ({syncResult.errors.length})</p><div className="space-y-1">{syncResult.errors.map((s, i) => <div key={i} className="text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2 font-mono">{s}</div>)}</div></div>}
                {syncResult.total === 0 && syncResult.errors.length === 0 && <p className="text-zinc-500 text-sm font-mono">All races already synced.</p>}
              </div>
            )}
            <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-2xl p-5 slide-up" style={{ animationDelay: "150ms" }}>
              <h3 className="text-xs font-mono text-zinc-500 tracking-widest mb-3">HOW IT WORKS</h3>
              <div className="space-y-2">
                {["Fetch all 2026 sessions from OpenF1 API", "Filter only completed Race and Sprint sessions", "Match with race in database by country name", "Fetch positions → calculate points using correct system", "Save to DB and push notification", "Auto-repeat every 1 hour"].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs text-zinc-600">
                    <span className="font-black text-zinc-700 w-4 flex-shrink-0">{i + 1}.</span><span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : tab === "users" ? (
          <div className="slide-up">
            <div className="flex items-center justify-between mb-5">
              <p className="text-zinc-500 text-sm font-mono">{users.length} users registered</p>
              <button onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl font-black text-xs text-white"
                style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 15px rgba(239,68,68,0.25)" }}>
                + CREATE USER
              </button>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    {["USER", "EMAIL", "ROLE", "ACTIONS"].map((h, i) => (
                      <th key={h} className={`px-5 py-4 text-xs font-mono text-zinc-600 ${i >= 2 ? "text-center" : "text-left"} ${i === 1 ? "hidden md:table-cell" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-5 py-4"><p className="text-sm font-black text-white">{user.username}</p><p className="text-xs text-zinc-600 font-mono">ID: {user.id}</p></td>
                      <td className="px-5 py-4 hidden md:table-cell"><span className="text-xs text-zinc-400 font-mono">{user.email}</span></td>
                      <td className="px-5 py-4 text-center">
                        <select value={user.role} onChange={e => updateRole(user.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-lg border bg-transparent font-mono cursor-pointer focus:outline-none ${ROLE_COLORS[user.role]}`}>
                          {["ADMIN", "ENGINEER", "VIEWER"].map(r => <option key={r} value={r} className="bg-zinc-900 text-white">{r}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-center">
                          <button onClick={() => { setResetUser(user); setNewPassword(""); }} className="text-xs text-zinc-500 hover:text-blue-400 border border-zinc-700 hover:border-blue-500/50 px-3 py-1.5 rounded-lg transition-all font-mono">RESET PWD</button>
                          <button onClick={() => deleteUser(user)} className="text-xs text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 px-3 py-1.5 rounded-lg transition-all font-mono">DELETE</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent mb-6" />
              <h2 className="text-xl font-black text-white mb-5">CREATE USER</h2>
              <div className="space-y-4">
                {[{ label: "USERNAME", key: "username", type: "text", ph: "e.g. engineer1" }, { label: "EMAIL", key: "email", type: "email", ph: "user@pitwall.f1" }, { label: "PASSWORD", key: "password", type: "password", ph: "min 6 chars" }].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-mono text-zinc-500 tracking-widest block mb-1.5">{f.label}</label>
                    <input type={f.type} placeholder={f.ph} value={(newUser as any)[f.key]} onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-mono text-zinc-500 tracking-widest block mb-1.5">ROLE</label>
                  <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {["ADMIN", "ENGINEER", "VIEWER"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {createError && <p className="text-red-400 text-xs font-mono bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{createError}</p>}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={createUser} className="flex-1 text-white font-black py-3 rounded-xl text-sm" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>CREATE</button>
                <button onClick={() => { setShowCreate(false); setCreateError(""); }} className="flex-1 border border-zinc-700/50 text-zinc-400 hover:text-white py-3 rounded-xl text-sm transition-colors">CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Modal */}
        {resetUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent mb-6" />
              <h2 className="text-xl font-black text-white mb-1">RESET PASSWORD</h2>
              <p className="text-zinc-500 text-sm mb-5">For: <span className="text-white font-bold">{resetUser.username}</span></p>
              <input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 mb-5" />
              <div className="flex gap-3">
                <button onClick={resetPassword} disabled={newPassword.length < 6} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-black py-3 rounded-xl text-sm transition-colors">RESET</button>
                <button onClick={() => setResetUser(null)} className="flex-1 border border-zinc-700/50 text-zinc-400 hover:text-white py-3 rounded-xl text-sm transition-colors">CANCEL</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}