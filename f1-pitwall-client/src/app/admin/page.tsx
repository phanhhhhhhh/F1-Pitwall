"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import { useCountUp } from "../lib/f1-theme";
import Navbar from "../components/Navbar";
import PitwallBackground from "../components/PitwallBackground";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface User { id: number; username: string; email: string; role: "ADMIN" | "ENGINEER" | "VIEWER"; }
interface Stats {
  totalUsers: number; totalDrivers: number; totalTeams: number; totalRaces: number;
  totalRaceResults: number; totalNotifications: number; unreadNotifications: number;
  usersByRole: { ADMIN: number; ENGINEER: number; VIEWER: number };
}
interface SyncResult { synced: string[]; skipped: string[]; errors: string[]; total: number; }

const ROLE_COLORS = {
  ADMIN:    "text-red-400 bg-red-500/10  border-red-500/30",
  ENGINEER: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  VIEWER:   "text-zinc-400 bg-zinc-800/50 border-zinc-700",
} as const;

/* ── Animated stat tile ──────────────────────────────────────────────────── */
function StatTile({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  const displayed = useCountUp(value, 900, delay);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: delay / 1000 }}
      className="relative chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6 text-center overflow-hidden group cursor-default"
      style={{ backdropFilter: "blur(18px)" }}
      whileHover={{ scale: 1.025 }}
    >
      {/* Top hairline accent */}
      <div className="absolute inset-x-0 top-0 h-px transition-opacity duration-300 group-hover:opacity-100 opacity-60"
        style={{ background: `linear-gradient(90deg,transparent,${color}70,transparent)` }} />
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${color}12, transparent 70%)` }} />
      <p className="f-cond font-black text-5xl tabular-nums relative z-10" style={{ color }}>{displayed}</p>
      <p className="f-mono text-xs text-zinc-600 mt-2 tracking-widest relative z-10">{label}</p>
    </motion.div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"stats" | "users" | "data">("stats");
  const [syncing,     setSyncing]     = useState(false);
  const [syncResult,  setSyncResult]  = useState<SyncResult | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newUser,     setNewUser]     = useState({ username: "", email: "", password: "", role: "VIEWER" });
  const [createError, setCreateError] = useState("");
  const [resetUser,   setResetUser]   = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [feedback,    setFeedback]    = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleSyncAll = async () => {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await authFetch(`${API}/api/sync/all`, { method: "POST" });
      const data: SyncResult = await res.json();
      setSyncResult(data);
      showFeedback(`Sync complete — ${data.total} sessions synced`);
      fetchData();
    } catch { showFeedback("Sync failed"); }
    finally { setSyncing(false); }
  };

  const updateRole = async (userId: number, role: string) => {
    const res = await authFetch(`${API}/api/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as User["role"] } : u));
      showFeedback("Role updated");
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    const res = await authFetch(`${API}/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showFeedback("User deleted");
      fetchData();
    } else {
      const d = await res.json();
      alert(d.error || "Delete failed");
    }
  };

  const resetPassword = async () => {
    if (!resetUser || newPassword.length < 6) return;
    const res = await authFetch(`${API}/api/admin/users/${resetUser.id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) { setResetUser(null); setNewPassword(""); showFeedback("Password reset"); }
  };

  const createUser = async () => {
    setCreateError("");
    if (!newUser.username || !newUser.password || !newUser.email) { setCreateError("All fields required"); return; }
    const res = await authFetch(`${API}/api/admin/users`, { method: "POST", body: JSON.stringify(newUser) });
    if (res.ok) {
      const created = await res.json();
      setUsers(prev => [...prev, created]);
      setShowCreate(false);
      setNewUser({ username: "", email: "", password: "", role: "VIEWER" });
      showFeedback("User created");
      fetchData();
    } else {
      const d = await res.json();
      setCreateError(d.error || "Create failed");
    }
  };

  const TABS = [
    { key: "stats", label: "DASHBOARD" },
    { key: "users", label: "USERS" },
    { key: "data",  label: "DATA SYNC" },
  ] as const;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <PitwallBackground glow="top-right" />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4 rise">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
              <p className="f-mono text-[#E10600]/60 text-xs tracking-[0.28em] uppercase">Pit Wall OS · System</p>
            </div>
            <h1 className="f-cond font-black text-5xl sm:text-6xl tracking-tight leading-none">
              ADMIN<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E10600] to-[#ff5a3c]">PANEL</span>
            </h1>
          </div>

          <AnimatePresence>
            {feedback && (
              <motion.div
                key="adm-fb"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`f-mono text-sm px-4 py-2 rounded-lg border chamfer-sm ${
                  feedback.startsWith("Sync failed") || feedback.startsWith("✗")
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-green-500/10 border-green-500/30 text-green-400"
                }`}
              >
                {feedback}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div
          className="flex gap-1 bg-zinc-900/80 border border-[rgba(255,255,255,0.06)] rounded-xl p-1 w-fit mb-8 rise"
          style={{ animationDelay: "80ms", backdropFilter: "blur(16px)" }}
        >
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-5 py-2.5 rounded-lg f-mono text-xs font-black border transition-all ${
                tab === t.key
                  ? "bg-red-500/10 border-red-500/50 text-red-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="f-mono text-red-500/70 text-xs tracking-widest animate-pulse">LOADING SYSTEMS...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">

            {/* ════════════════════════════════ STATS TAB ══════════════ */}
            {tab === "stats" && stats && (
              <motion.div
                key="stats-tab"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="space-y-6"
              >
                {/* Stat tiles with useCountUp */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatTile label="TOTAL USERS"   value={stats.totalUsers}        color="#E10600" delay={0} />
                  <StatTile label="DRIVERS"        value={stats.totalDrivers}      color="#ff5a3c" delay={60} />
                  <StatTile label="TEAMS"          value={stats.totalTeams}        color="#3b82f6" delay={120} />
                  <StatTile label="RACE RESULTS"   value={stats.totalRaceResults}  color="#00E676" delay={180} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* User roles */}
                  <div
                    className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6"
                    style={{ backdropFilter: "blur(18px)" }}
                  >
                    <h2 className="f-mono text-xs text-zinc-500 tracking-widest mb-5">USER ROLES</h2>
                    <div className="space-y-4">
                      {(Object.entries(stats.usersByRole) as [string, number][]).map(([r, count]) => {
                        const c = r === "ADMIN" ? "#E10600" : r === "ENGINEER" ? "#3b82f6" : "#71717a";
                        return (
                          <div key={r}>
                            <div className="flex justify-between text-xs mb-2">
                              <span className={`f-mono font-black px-2 py-0.5 rounded border ${ROLE_COLORS[r as keyof typeof ROLE_COLORS]}`}>{r}</span>
                              <span className="text-zinc-400 f-mono">{count} users</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${(count / (stats.totalUsers || 1)) * 100}%`, backgroundColor: c, boxShadow: `0 0 6px ${c}60` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Data overview */}
                  <div
                    className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6"
                    style={{ backdropFilter: "blur(18px)" }}
                  >
                    <h2 className="f-mono text-xs text-zinc-500 tracking-widest mb-5">DATA OVERVIEW</h2>
                    <div className="space-y-3">
                      {[
                        { label: "Races in DB",            value: stats.totalRaces,         icon: "🏁" },
                        { label: "Race Results Synced",    value: stats.totalRaceResults,   icon: "📊" },
                        { label: "Notifications Total",    value: stats.totalNotifications, icon: "🔔" },
                        { label: "Unread Notifications",   value: stats.unreadNotifications, icon: "🔴" },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                          <div className="flex items-center gap-2.5">
                            <span>{s.icon}</span>
                            <span className="text-sm text-zinc-400">{s.label}</span>
                          </div>
                          <span className="text-white font-black f-mono">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════ DATA TAB ═══════════════ */}
            {tab === "data" && (
              <motion.div
                key="data-tab"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
                className="space-y-5"
              >
                <div
                  className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6"
                  style={{ backdropFilter: "blur(18px)" }}
                >
                  <div className="h-px mb-6" style={{ background: "linear-gradient(90deg,transparent,#E1060055,transparent)" }} />
                  <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
                    <div>
                      <h2 className="f-cond text-xl font-black text-white mb-1">OpenF1 Auto-Sync</h2>
                      <p className="text-zinc-500 text-sm max-w-lg">Automatically fetch race and sprint results from OpenF1 API, correctly calculate points according to F1 system.</p>
                    </div>
                    <button
                      onClick={handleSyncAll}
                      disabled={syncing}
                      className={`relative overflow-hidden flex items-center gap-2 px-6 py-3 rounded-lg f-cond font-black text-sm transition-all chamfer-sm ${
                        syncing ? "bg-zinc-700/50 text-zinc-400 border border-zinc-600" : "text-white"
                      }`}
                      style={!syncing ? { background: "linear-gradient(135deg,#E10600,#dc2626)", boxShadow: "0 0 20px rgba(225,6,0,0.3)" } : {}}
                    >
                      {syncing
                        ? <><div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />SYNCING...</>
                        : "SYNC ALL RESULTS"
                      }
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Race Points",  value: "25-18-15-12-10-8-6-4-2-1", color: "#E10600" },
                      { label: "Sprint Points", value: "8-7-6-5-4-3-2-1",         color: "#ff5a3c" },
                      { label: "Auto-sync",     value: "Every 1 hour",             color: "#00E676" },
                    ].map(s => (
                      <div key={s.label} className="chamfer-sm bg-zinc-800/40 border border-[rgba(255,255,255,0.05)] rounded-xl p-3 text-center">
                        <p className="f-mono text-xs font-black" style={{ color: s.color }}>{s.value}</p>
                        <p className="f-mono text-xs text-zinc-600 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="f-mono text-xs text-zinc-600 bg-zinc-800/30 rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.04)]">
                    Only sync completed races without results in DB · Fastest lap +1pt for top 10 (Race only)
                  </p>
                </div>

                {/* Sync results */}
                <AnimatePresence>
                  {syncResult && (
                    <motion.div
                      key="sync-result"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6"
                      style={{ backdropFilter: "blur(18px)" }}
                    >
                      <h3 className="f-mono text-xs text-zinc-500 tracking-widest mb-5">SYNC RESULTS</h3>
                      {syncResult.synced.length > 0 && (
                        <div className="mb-4">
                          <p className="f-mono text-xs text-green-400 mb-2">SYNCED ({syncResult.synced.length})</p>
                          <div className="space-y-1">
                            {syncResult.synced.map((s, i) => (
                              <div key={i} className="f-mono text-xs text-zinc-300 bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2">🏁 {s}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {syncResult.skipped.length > 0 && (
                        <div className="mb-4">
                          <p className="f-mono text-xs text-zinc-500 mb-2">SKIPPED ({syncResult.skipped.length})</p>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {syncResult.skipped.map((s, i) => (
                              <div key={i} className="f-mono text-xs text-zinc-600 bg-zinc-800/40 rounded-lg px-3 py-1.5">{s}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {syncResult.errors.length > 0 && (
                        <div>
                          <p className="f-mono text-xs text-red-400 mb-2">ERRORS ({syncResult.errors.length})</p>
                          <div className="space-y-1">
                            {syncResult.errors.map((s, i) => (
                              <div key={i} className="f-mono text-xs text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">{s}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {syncResult.total === 0 && syncResult.errors.length === 0 && (
                        <p className="text-zinc-500 text-sm f-mono">All races already synced.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* How it works */}
                <div
                  className="chamfer bg-[rgba(18,18,21,0.60)] border border-[rgba(255,255,255,0.04)] p-5"
                  style={{ backdropFilter: "blur(12px)" }}
                >
                  <h3 className="f-mono text-xs text-zinc-500 tracking-widest mb-3">HOW IT WORKS</h3>
                  <div className="space-y-2">
                    {[
                      "Fetch all 2026 sessions from OpenF1 API",
                      "Filter only completed Race and Sprint sessions",
                      "Match with race in database by country name",
                      "Fetch positions → calculate points using correct system",
                      "Save to DB and push notification",
                      "Auto-repeat every 1 hour",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3 f-mono text-xs text-zinc-600">
                        <span className="font-black text-zinc-700 w-4 flex-shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════ USERS TAB ══════════════ */}
            {tab === "users" && (
              <motion.div
                key="users-tab"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22 }}
              >
                <div className="flex items-center justify-between mb-5">
                  <p className="f-mono text-zinc-500 text-sm">{users.length} users registered</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-5 py-2.5 rounded-lg f-cond font-black text-sm text-white chamfer-sm"
                    style={{ background: "linear-gradient(135deg,#E10600,#dc2626)", boxShadow: "0 0 15px rgba(225,6,0,0.25)" }}
                  >
                    + CREATE USER
                  </button>
                </div>

                <div
                  className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] overflow-hidden"
                  style={{ backdropFilter: "blur(18px)" }}
                >
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.06)]">
                        {["USER", "EMAIL", "ROLE", "ACTIONS"].map((h, i) => (
                          <th
                            key={h}
                            className={`px-5 py-4 f-mono text-xs text-zinc-600 ${i >= 2 ? "text-center" : "text-left"} ${i === 1 ? "hidden md:table-cell" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, idx) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <p className="f-cond text-sm font-black text-white">{user.username}</p>
                            <p className="f-mono text-xs text-zinc-600">#{user.id}</p>
                          </td>
                          <td className="px-5 py-4 hidden md:table-cell">
                            <span className="f-mono text-xs text-zinc-400">{user.email}</span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <select
                              value={user.role}
                              onChange={e => updateRole(user.id, e.target.value)}
                              className={`f-mono text-xs px-2 py-1 rounded-lg border bg-transparent cursor-pointer focus:outline-none ${ROLE_COLORS[user.role]}`}
                            >
                              {["ADMIN", "ENGINEER", "VIEWER"].map(r => (
                                <option key={r} value={r} className="bg-zinc-900 text-white">{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => { setResetUser(user); setNewPassword(""); }}
                                className="f-mono text-xs text-zinc-500 hover:text-blue-400 border border-zinc-700 hover:border-blue-500/50 px-3 py-1.5 rounded-lg transition-all"
                              >
                                RESET PWD
                              </button>
                              <button
                                onClick={() => deleteUser(user)}
                                className="f-mono text-xs text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500/50 px-3 py-1.5 rounded-lg transition-all"
                              >
                                DELETE
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Create User Modal ────────────────────────────────────────── */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              key="create-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            >
              <motion.div
                initial={{ scale: 0.92, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 24 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="chamfer bg-zinc-900 border border-[rgba(255,255,255,0.08)] p-6 w-full max-w-md shadow-2xl"
                style={{ backdropFilter: "blur(24px)" }}
              >
                <div className="h-px w-full mb-6" style={{ background: "linear-gradient(90deg,transparent,#E10600,transparent)" }} />
                <h2 className="f-cond text-2xl font-black text-white mb-5">CREATE USER</h2>
                <div className="space-y-4">
                  {[
                    { label: "USERNAME", key: "username", type: "text",     ph: "e.g. engineer1" },
                    { label: "EMAIL",    key: "email",    type: "email",    ph: "user@pitwall.f1" },
                    { label: "PASSWORD", key: "password", type: "password", ph: "min 6 chars" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="f-mono text-xs text-zinc-500 tracking-widest block mb-1.5">{f.label}</label>
                      <input
                        type={f.type}
                        placeholder={f.ph}
                        value={newUser[f.key as keyof typeof newUser]}
                        onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500/50 transition-colors f-mono"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="f-mono text-xs text-zinc-500 tracking-widest block mb-1.5">ROLE</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                      className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none f-mono"
                    >
                      {["ADMIN", "ENGINEER", "VIEWER"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  {createError && (
                    <p className="f-mono text-red-400 text-xs bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{createError}</p>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={createUser}
                    className="flex-1 text-white f-cond font-black py-3 rounded-lg text-sm chamfer-sm"
                    style={{ background: "linear-gradient(135deg,#E10600,#dc2626)" }}
                  >
                    CREATE
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setCreateError(""); }}
                    className="flex-1 border border-zinc-700/50 text-zinc-400 hover:text-white py-3 rounded-lg text-sm transition-colors f-mono"
                  >
                    CANCEL
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Reset Password Modal ─────────────────────────────────────── */}
        <AnimatePresence>
          {resetUser && (
            <motion.div
              key="reset-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            >
              <motion.div
                initial={{ scale: 0.92, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 24 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="chamfer bg-zinc-900 border border-[rgba(255,255,255,0.08)] p-6 w-full max-w-sm shadow-2xl"
                style={{ backdropFilter: "blur(24px)" }}
              >
                <div className="h-px w-full mb-6" style={{ background: "linear-gradient(90deg,transparent,#3b82f6,transparent)" }} />
                <h2 className="f-cond text-2xl font-black text-white mb-1">RESET PASSWORD</h2>
                <p className="f-mono text-zinc-500 text-sm mb-5">
                  For: <span className="text-white font-bold">{resetUser.username}</span>
                </p>
                <input
                  type="password"
                  placeholder="New password (min 6 chars)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 mb-5 f-mono"
                />
                <div className="flex gap-3">
                  <button
                    onClick={resetPassword}
                    disabled={newPassword.length < 6}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white f-cond font-black py-3 rounded-lg text-sm transition-colors chamfer-sm"
                  >
                    RESET
                  </button>
                  <button
                    onClick={() => setResetUser(null)}
                    className="flex-1 border border-zinc-700/50 text-zinc-400 hover:text-white py-3 rounded-lg text-sm transition-colors f-mono"
                  >
                    CANCEL
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
