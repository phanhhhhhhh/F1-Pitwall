"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken, clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const ROLE_CONFIG = {
    ADMIN: { color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/30", label: "Admin", icon: "⚡" },
    ENGINEER: { color: "#3b82f6", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Engineer", icon: "🔧" },
    VIEWER: { color: "#71717a", bg: "bg-zinc-800", border: "border-zinc-700", label: "Viewer", icon: "👁" },
};

export default function ProfilePage() {
    const router = useRouter();
    const { user } = useAuth();

    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdFeedback, setPwdFeedback] = useState("");
    const [showPwdForm, setShowPwdForm] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);

    useEffect(() => {
        if (!getAccessToken()) { router.push("/login"); }
    }, []);

    const showFeedback = (msg: string) => {
        setPwdFeedback(msg);
        setTimeout(() => setPwdFeedback(""), 4000);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd !== confirmPwd) { showFeedback("✗ Passwords do not match"); return; }
        if (newPwd.length < 6) { showFeedback("✗ Password must be at least 6 characters"); return; }

        setPwdLoading(true);
        try {
            const res = await authFetch(`${API}/api/auth/change-password`, {
                method: "POST",
                body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
            });
            if (res.ok) {
                showFeedback("✓ Password changed successfully");
                setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
                setShowPwdForm(false);
            } else {
                const data = await res.json();
                showFeedback("✗ " + (data.error || "Failed to change password"));
            }
        } catch {
            showFeedback("✗ Connection error");
        } finally {
            setPwdLoading(false);
        }
    };

    const handleLogout = () => { clearTokens(); router.push("/login"); };

    const role = user?.role as keyof typeof ROLE_CONFIG;
    const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.VIEWER;

    const strength = newPwd.length === 0 ? 0
        : newPwd.length < 6 ? 1
            : newPwd.length < 10 ? 2
                : /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) ? 4 : 3;
    const strengthColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
    const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

    return (
        <div className="min-h-screen bg-zinc-950 relative overflow-x-hidden">
            <style>{`
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes glow { 0%,100%{opacity:.3} 50%{opacity:.8} }
        .slide-up { animation: slideUp .4s ease-out both; }
        .glow-pulse { animation: glow 3s ease-in-out infinite; }
      `}</style>

            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-zinc-950" />
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/4 rounded-full blur-[150px] glow-pulse" />
                <div className="absolute inset-0 opacity-[0.012]" style={{
                    backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)",
                    backgroundSize: "60px 60px",
                }} />
            </div>

            <Navbar />

            <main className="relative z-10 max-w-3xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="mb-8 slide-up">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <p className="text-red-500/60 font-mono text-xs tracking-[0.3em]">ACCOUNT · PROFILE</p>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-white leading-none">
                        MY<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PROFILE</span>
                    </h1>
                </div>

                {/* Profile card */}
                <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden mb-5 slide-up" style={{ animationDelay: "100ms" }}>
                    <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
                    <div className="p-6">
                        <div className="flex items-start gap-5 flex-wrap">
                            {/* Avatar */}
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white border border-zinc-700/50"
                                    style={{ background: `linear-gradient(135deg, ${roleCfg.color}20, ${roleCfg.color}05)` }}>
                                    {user?.username?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                                    style={{ backgroundColor: roleCfg.color }}>
                                    {roleCfg.icon}
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap mb-1">
                                    <h2 className="text-2xl font-black text-white">{user?.username}</h2>
                                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${roleCfg.bg} ${roleCfg.border}`}
                                        style={{ color: roleCfg.color }}>
                                        {roleCfg.icon} {roleCfg.label}
                                    </span>
                                </div>
                                <p className="text-zinc-400 font-mono text-sm mb-3">{user?.email || "—"}</p>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="text-xs text-zinc-600 font-mono">
                                        ID: <span className="text-zinc-400">#{user?.id}</span>
                                    </div>
                                    <div className="text-xs text-zinc-600 font-mono">
                                        Joined: <span className="text-zinc-400">
                                            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Logout */}
                            <button onClick={handleLogout}
                                className="text-xs border border-zinc-700 hover:border-red-500/50 text-zinc-500 hover:text-red-400 px-4 py-2 rounded-xl transition-all font-mono">
                                LOGOUT
                            </button>
                        </div>
                    </div>
                </div>

                {/* Permissions */}
                <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 mb-5 slide-up" style={{ animationDelay: "150ms" }}>
                    <h3 className="text-xs font-mono text-zinc-500 tracking-widest mb-4">PERMISSIONS</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                            { label: "View races & standings", allowed: true },
                            { label: "View drivers & teams", allowed: true },
                            { label: "Access pit strategy tool", allowed: true },
                            { label: "View live telemetry", allowed: true },
                            { label: "Submit race results", allowed: role === "ADMIN" || role === "ENGINEER" },
                            { label: "Sync race data", allowed: role === "ADMIN" || role === "ENGINEER" },
                            { label: "Manage users", allowed: role === "ADMIN" },
                            { label: "Access admin panel", allowed: role === "ADMIN" },
                        ].map(p => (
                            <div key={p.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${p.allowed ? "border-green-500/20 bg-green-500/5" : "border-zinc-800/50 bg-zinc-800/20 opacity-50"
                                }`}>
                                <span className={`text-sm ${p.allowed ? "text-green-400" : "text-zinc-600"}`}>
                                    {p.allowed ? "✓" : "✗"}
                                </span>
                                <span className={`text-xs font-mono ${p.allowed ? "text-zinc-300" : "text-zinc-600"}`}>
                                    {p.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    {role === "VIEWER" && (
                        <p className="text-xs text-zinc-600 font-mono mt-4 bg-zinc-800/30 px-3 py-2 rounded-lg border border-zinc-700/20">
                            💡 Contact an admin to upgrade your role to Engineer or Admin.
                        </p>
                    )}
                </div>

                {/* Change password */}
                <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800/50 rounded-2xl overflow-hidden slide-up" style={{ animationDelay: "200ms" }}>
                    <button onClick={() => setShowPwdForm(p => !p)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-800/20 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🔐</span>
                            <span className="text-sm font-black text-white">Change Password</span>
                        </div>
                        <svg className={`w-4 h-4 text-zinc-500 transition-transform ${showPwdForm ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showPwdForm && (
                        <div className="px-6 pb-6 border-t border-zinc-800/50">
                            {pwdFeedback && (
                                <div className={`mt-4 px-4 py-2.5 rounded-xl border text-xs font-mono ${pwdFeedback.startsWith("✓")
                                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                                    : "bg-red-500/10 border-red-500/30 text-red-400"
                                    }`}>{pwdFeedback}</div>
                            )}

                            <form onSubmit={handleChangePassword} className="space-y-4 mt-4">
                                {[
                                    { key: "current", label: "Current Password", value: currentPwd, set: setCurrentPwd, placeholder: "Enter current password" },
                                    { key: "new", label: "New Password", value: newPwd, set: setNewPwd, placeholder: "Min 6 characters" },
                                    { key: "confirm", label: "Confirm Password", value: confirmPwd, set: setConfirmPwd, placeholder: "Repeat new password" },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-1.5">{f.label.toUpperCase()}</label>
                                        <div className="relative">
                                            <input type="password" value={f.value} onChange={e => f.set(e.target.value)}
                                                onFocus={() => setFocused(f.key)} onBlur={() => setFocused(null)}
                                                placeholder={f.placeholder} required
                                                className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono text-sm"
                                                style={{
                                                    borderColor: focused === f.key ? "#ef4444" : "rgba(63,63,70,0.5)",
                                                    boxShadow: focused === f.key ? "0 0 15px rgba(239,68,68,0.1)" : "none",
                                                }} />
                                            {focused === f.key && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                                        </div>

                                        {/* Password strength */}
                                        {f.key === "new" && newPwd.length > 0 && (
                                            <div className="mt-2">
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4].map(l => (
                                                        <div key={l} className="flex-1 h-1 rounded-full transition-all duration-300"
                                                            style={{ backgroundColor: l <= strength ? strengthColors[strength] : "#27272a" }} />
                                                    ))}
                                                </div>
                                                <p className="text-xs mt-1 font-mono" style={{ color: strengthColors[strength] }}>
                                                    {strengthLabels[strength]}
                                                </p>
                                            </div>
                                        )}

                                        {/* Confirm match */}
                                        {f.key === "confirm" && confirmPwd.length > 0 && (
                                            <p className={`text-xs mt-1 font-mono ${newPwd === confirmPwd ? "text-green-400" : "text-red-400"}`}>
                                                {newPwd === confirmPwd ? "✓ Passwords match" : "✗ Passwords do not match"}
                                            </p>
                                        )}
                                    </div>
                                ))}

                                <div className="flex gap-3 pt-2">
                                    <button type="submit" disabled={pwdLoading}
                                        className="flex-1 py-3 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50"
                                        style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 15px rgba(239,68,68,0.2)" }}>
                                        {pwdLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                SAVING...
                                            </span>
                                        ) : "CHANGE PASSWORD"}
                                    </button>
                                    <button type="button" onClick={() => { setShowPwdForm(false); setCurrentPwd(""); setNewPwd(""); setConfirmPwd(""); }}
                                        className="px-5 py-3 rounded-xl border border-zinc-700/50 text-zinc-400 hover:text-white text-sm transition-colors">
                                        CANCEL
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}