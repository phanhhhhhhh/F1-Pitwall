"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken } from "../lib/pitwall-auth";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface User {
  id: number;
  username: string;
  email: string;
  role: "ADMIN" | "ENGINEER" | "VIEWER";
}

interface Stats {
  totalUsers: number;
  totalDrivers: number;
  totalTeams: number;
  totalRaces: number;
  totalRaceResults: number;
  totalNotifications: number;
  unreadNotifications: number;
  usersByRole: { ADMIN: number; ENGINEER: number; VIEWER: number };
}

interface SyncResult {
  synced: string[];
  skipped: string[];
  errors: string[];
  total: number;
}

const ROLE_COLORS = {
  ADMIN: "text-red-400 bg-red-500/10 border-red-500/30",
  ENGINEER: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  VIEWER: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

const ROLE_OPTIONS = ["ADMIN", "ENGINEER", "VIEWER"];

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "users" | "data">("stats");

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", role: "VIEWER" });
  const [createError, setCreateError] = useState("");

  // Password reset modal
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Feedback
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!getAccessToken()) { router.push("/login"); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        authFetch(`${API}/api/admin/stats`),
        authFetch(`${API}/api/admin/users`),
      ]);
      if (statsRes.status === 403) { router.push("/"); return; }
      setStats(await statsRes.json());
      setUsers(await usersRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 3000);
  };

  // ─── Sync all results from OpenF1 ──────────────────────────────────────
  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await authFetch(`${API}/api/sync/all`, { method: "POST" });
      const data: SyncResult = await res.json();
      setSyncResult(data);
      showFeedback(`✓ Sync complete — ${data.total} sessions synced`);
      fetchData(); // refresh stats
    } catch (e) {
      showFeedback("✗ Sync failed");
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  // ─── User management ───────────────────────────────────────────────────
  const updateRole = async (userId: number, role: string) => {
    const res = await authFetch(`${API}/api/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as User["role"] } : u));
      showFeedback("✓ Role updated");
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    const res = await authFetch(`${API}/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showFeedback("✓ User deleted");
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Delete failed");
    }
  };

  const resetPassword = async () => {
    if (!resetUser || newPassword.length < 6) return;
    const res = await authFetch(`${API}/api/admin/users/${resetUser.id}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) { setResetUser(null); setNewPassword(""); showFeedback("✓ Password reset"); }
  };

  const createUser = async () => {
    setCreateError("");
    if (!newUser.username || !newUser.password || !newUser.email) {
      setCreateError("All fields required"); return;
    }
    const res = await authFetch(`${API}/api/admin/users`, {
      method: "POST",
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      const created = await res.json();
      setUsers(prev => [...prev, created]);
      setShowCreate(false);
      setNewUser({ username: "", email: "", password: "", role: "VIEWER" });
      showFeedback("✓ User created");
      fetchData();
    } else {
      const data = await res.json();
      setCreateError(data.error || "Create failed");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-zinc-500 font-mono text-xs tracking-widest uppercase mb-2">System · Admin Only</p>
            <h1 className="text-4xl font-black tracking-tighter text-white">
              ADMIN <span className="text-red-500">PANEL</span>
            </h1>
          </div>
          {feedback && (
            <div className={`text-sm px-4 py-2 rounded-lg font-mono border ${
              feedback.startsWith("✓")
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {feedback}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { key: "stats", label: "📊 DASHBOARD" },
            { key: "users", label: "👥 USERS" },
            { key: "data", label: "🔄 DATA SYNC" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-5 py-2 rounded-lg text-xs font-bold border transition-all ${
                tab === t.key ? "bg-red-500/20 border-red-500 text-red-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-red-500 animate-pulse font-mono text-sm">
            <div className="w-2 h-2 bg-red-500 rounded-full" /> LOADING...
          </div>
        ) : tab === "stats" && stats ? (
          /* ─── Dashboard ───────────────────────────────────────────── */
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "TOTAL USERS", value: stats.totalUsers, color: "text-red-400" },
                { label: "DRIVERS", value: stats.totalDrivers, color: "text-orange-400" },
                { label: "TEAMS", value: stats.totalTeams, color: "text-blue-400" },
                { label: "RACE RESULTS", value: stats.totalRaceResults, color: "text-green-400" },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <p className={`text-4xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-zinc-600 font-mono mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-bold text-zinc-300 tracking-widest mb-5">USER ROLES</h2>
                <div className="space-y-4">
                  {(Object.entries(stats.usersByRole) as [string, number][]).map(([role, count]) => (
                    <div key={role}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-bold px-2 py-0.5 rounded border ${ROLE_COLORS[role as keyof typeof ROLE_COLORS]}`}>{role}</span>
                        <span className="text-zinc-400 font-mono">{count} users</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(count / (stats.totalUsers || 1)) * 100}%`,
                          backgroundColor: role === "ADMIN" ? "#ef4444" : role === "ENGINEER" ? "#3b82f6" : "#52525b"
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-bold text-zinc-300 tracking-widest mb-5">DATA OVERVIEW</h2>
                <div className="space-y-3">
                  {[
                    { label: "Races in DB", value: stats.totalRaces, icon: "🏁" },
                    { label: "Race Results Synced", value: stats.totalRaceResults, icon: "📊" },
                    { label: "Notifications Total", value: stats.totalNotifications, icon: "🔔" },
                    { label: "Unread Notifications", value: stats.unreadNotifications, icon: "🔴" },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                      <div className="flex items-center gap-2">
                        <span>{s.icon}</span>
                        <span className="text-sm text-zinc-400">{s.label}</span>
                      </div>
                      <span className="text-white font-bold font-mono">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        ) : tab === "data" ? (
          /* ─── Data Sync Tab ───────────────────────────────────────── */
          <div className="space-y-6">

            {/* Main sync card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-black text-white mb-1">OpenF1 Auto-Sync</h2>
                  <p className="text-zinc-500 text-sm">Tự động fetch kết quả race và sprint từ OpenF1 API, tính điểm đúng theo hệ thống F1.</p>
                </div>
                <button onClick={handleSyncAll} disabled={syncing}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
                    syncing
                      ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }`}>
                  {syncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                      SYNCING...
                    </>
                  ) : (
                    <>🔄 SYNC ALL RESULTS</>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Race Points", value: "25-18-15-12-10-8-6-4-2-1", color: "text-red-400" },
                  { label: "Sprint Points", value: "8-7-6-5-4-3-2-1", color: "text-orange-400" },
                  { label: "Auto-sync", value: "Every 1 hour", color: "text-green-400" },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <p className={`text-xs font-mono font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-zinc-600 font-mono">
                ℹ️ Chỉ sync các race đã hoàn thành và chưa có kết quả trong DB · Fastest lap +1pt cho top 10 (Race only)
              </p>
            </div>

            {/* Sync result */}
            {syncResult && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                <h3 className="text-sm font-bold text-white tracking-widest mb-4">SYNC RESULTS</h3>

                {syncResult.synced.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-mono text-green-400 mb-2">✅ SYNCED ({syncResult.synced.length})</p>
                    <div className="space-y-1">
                      {syncResult.synced.map((s, i) => (
                        <div key={i} className="text-xs text-zinc-300 bg-green-500/5 border border-green-500/20 rounded px-3 py-1.5 font-mono">
                          🏁 {s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {syncResult.skipped.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-mono text-zinc-500 mb-2">⏭️ SKIPPED ({syncResult.skipped.length})</p>
                    <div className="space-y-1">
                      {syncResult.skipped.map((s, i) => (
                        <div key={i} className="text-xs text-zinc-600 bg-zinc-800/50 rounded px-3 py-1.5 font-mono">{s}</div>
                      ))}
                    </div>
                  </div>
                )}

                {syncResult.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-red-400 mb-2">❌ ERRORS ({syncResult.errors.length})</p>
                    <div className="space-y-1">
                      {syncResult.errors.map((s, i) => (
                        <div key={i} className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-1.5 font-mono">{s}</div>
                      ))}
                    </div>
                  </div>
                )}

                {syncResult.total === 0 && syncResult.errors.length === 0 && (
                  <p className="text-zinc-500 text-sm font-mono">All races already synced — nothing new to fetch.</p>
                )}
              </div>
            )}

            {/* Info */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-5">
              <h3 className="text-xs font-mono text-zinc-500 tracking-widest mb-3">HOW IT WORKS</h3>
              <div className="space-y-2 text-xs text-zinc-600">
                <p>1. Fetch tất cả sessions 2026 từ OpenF1 API</p>
                <p>2. Lọc chỉ Race và Sprint sessions đã hoàn thành</p>
                <p>3. Match với race trong database theo tên quốc gia</p>
                <p>4. Fetch positions → tính điểm đúng hệ thống</p>
                <p>5. Lưu vào DB và push notification</p>
                <p>6. Auto-repeat mỗi 1 tiếng</p>
              </div>
            </div>
          </div>

        ) : tab === "users" ? (
          /* ─── Users Tab ───────────────────────────────────────────── */
          <div>
            <div className="flex items-center justify-between mb-5">
              <p className="text-zinc-500 text-sm">{users.length} users registered</p>
              <button onClick={() => setShowCreate(true)}
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors">
                + CREATE USER
              </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500">USER</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-zinc-500 hidden md:table-cell">EMAIL</th>
                    <th className="text-center px-4 py-3 text-xs font-mono text-zinc-500">ROLE</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-zinc-500">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-white">{user.username}</p>
                        <p className="text-xs text-zinc-600 font-mono">ID: {user.id}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-zinc-400">{user.email}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select value={user.role} onChange={e => updateRole(user.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border bg-transparent font-mono cursor-pointer focus:outline-none ${ROLE_COLORS[user.role]}`}>
                          {ROLE_OPTIONS.map(r => (
                            <option key={r} value={r} className="bg-zinc-900 text-white">{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setResetUser(user); setNewPassword(""); }}
                            className="text-xs text-zinc-500 hover:text-blue-400 border border-zinc-700 hover:border-blue-500 px-2 py-1 rounded transition-all font-mono">
                            RESET PWD
                          </button>
                          <button onClick={() => deleteUser(user)}
                            className="text-xs text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500 px-2 py-1 rounded transition-all font-mono">
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Create User Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-black text-white mb-5">CREATE USER</h2>
              <div className="space-y-3">
                {[
                  { label: "USERNAME", key: "username", type: "text", placeholder: "e.g. engineer1" },
                  { label: "EMAIL", key: "email", type: "email", placeholder: "user@pitwall.f1" },
                  { label: "PASSWORD", key: "password", type: "password", placeholder: "min 6 chars" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs font-mono text-zinc-500 block mb-1">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder}
                      value={(newUser as any)[f.key]}
                      onChange={e => setNewUser(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-mono text-zinc-500 block mb-1">ROLE</label>
                  <select value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500">
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {createError && <p className="text-red-400 text-xs font-mono">{createError}</p>}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={createUser} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm">CREATE</button>
                <button onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="flex-1 border border-zinc-700 text-zinc-400 hover:text-white py-2 rounded-lg text-sm">CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetUser && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm">
              <h2 className="text-lg font-black text-white mb-1">RESET PASSWORD</h2>
              <p className="text-zinc-500 text-sm mb-5">For: <span className="text-white">{resetUser.username}</span></p>
              <input type="password" placeholder="New password (min 6 chars)"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 mb-4" />
              <div className="flex gap-3">
                <button onClick={resetPassword} disabled={newPassword.length < 6}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-bold py-2 rounded-lg text-sm">RESET</button>
                <button onClick={() => setResetUser(null)}
                  className="flex-1 border border-zinc-700 text-zinc-400 hover:text-white py-2 rounded-lg text-sm">CANCEL</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
