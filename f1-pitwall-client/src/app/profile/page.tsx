"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken, clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { createClient } from "@supabase/supabase-js";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROLE_CONFIG = {
    ADMIN: { color: "#ef4444", glow: "rgba(239,68,68,0.15)", label: "Admin", icon: "⚡", gradient: "from-red-500 to-orange-400" },
    ENGINEER: { color: "#3b82f6", glow: "rgba(59,130,246,0.15)", label: "Engineer", icon: "🔧", gradient: "from-blue-500 to-cyan-400" },
    VIEWER: { color: "#71717a", glow: "rgba(113,113,122,0.10)", label: "Viewer", icon: "👁", gradient: "from-zinc-500 to-zinc-400" },
};

export default function ProfilePage() {
    const router = useRouter();
    const { user } = useAuth();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [avatarPreview, setAvatarPreview] = useState("");
    const [editLoading, setEditLoading] = useState(false);
    const [editFeedback, setEditFeedback] = useState("");
    const [showEditForm, setShowEditForm] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdFeedback, setPwdFeedback] = useState("");
    const [showPwdForm, setShowPwdForm] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!getAccessToken()) { router.push("/login"); return; }
    }, []);

    useEffect(() => {
        if (user) {
            setDisplayName((user as any).displayName || "");
            setEmail(user.email || "");
            setAvatarUrl((user as any).avatarUrl || "");
            setAvatarPreview((user as any).avatarUrl || "");
        }
    }, [user]);

    const showFeedback = (setter: (s: string) => void, msg: string) => {
        setter(msg);
        setTimeout(() => setter(""), 4000);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { showFeedback(setEditFeedback, "✗ Please select an image file"); return; }
        if (file.size > 2 * 1024 * 1024) { showFeedback(setEditFeedback, "✗ Image must be smaller than 2MB"); return; }
        setUploadLoading(true);
        setAvatarPreview(URL.createObjectURL(file));
        try {
            const fileName = `${user?.username || "user"}-${Date.now()}.${file.name.split(".").pop()}`;
            const { error } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
            setAvatarUrl(urlData.publicUrl);
            setAvatarPreview(urlData.publicUrl);
            setShowEditForm(true);
            showFeedback(setEditFeedback, "✓ Avatar uploaded! Save to apply.");
        } catch (err: any) {
            setAvatarPreview(avatarUrl);
            showFeedback(setEditFeedback, "✗ Upload failed: " + (err.message || "Unknown error"));
        } finally { setUploadLoading(false); }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setEditLoading(true);
        try {
            const res = await authFetch(`${API}/api/auth/profile`, {
                method: "PATCH",
                body: JSON.stringify({ displayName, email, avatarUrl }),
            });
            if (res.ok) {
                showFeedback(setEditFeedback, "✓ Profile updated");
                setShowEditForm(false);
            } else {
                const data = await res.json();
                showFeedback(setEditFeedback, "✗ " + (data.error || "Update failed"));
            }
        } catch { showFeedback(setEditFeedback, "✗ Connection error"); }
        finally { setEditLoading(false); }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd !== confirmPwd) { showFeedback(setPwdFeedback, "✗ Passwords do not match"); return; }
        if (newPwd.length < 6) { showFeedback(setPwdFeedback, "✗ Min 6 characters"); return; }
        setPwdLoading(true);
        try {
            const res = await authFetch(`${API}/api/auth/change-password`, {
                method: "POST",
                body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
            });
            if (res.ok) {
                showFeedback(setPwdFeedback, "✓ Password changed successfully");
                setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
            } else {
                const data = await res.json();
                showFeedback(setPwdFeedback, "✗ " + (data.error || "Failed"));
            }
        } catch { showFeedback(setPwdFeedback, "✗ Connection error"); }
        finally { setPwdLoading(false); }
    };

    const handleLogout = () => { clearTokens(); router.push("/login"); };

    const role = user?.role as keyof typeof ROLE_CONFIG;
    const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.VIEWER;
    const displayedName = (user as any)?.displayName || user?.username || "";
    const initials = displayedName.slice(0, 2).toUpperCase();

    const strength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 10 ? 2 : /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) ? 4 : 3;
    const strengthColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
    const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

    return (
        <div className="min-h-screen bg-zinc-950">
            <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        .fade-up{animation:fadeUp .5s ease-out both}
        .spin{animation:spin 8s linear infinite}
        .glow-pulse{animation:pulse 3s ease-in-out infinite}
      `}</style>

            {/* Background */}
            <div className="fixed inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 bg-zinc-950" />
                <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[200px] glow-pulse" style={{ background: roleCfg.glow }} />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-zinc-900/30 rounded-full blur-[150px]" />
            </div>

            <Navbar />

            <main className="relative z-10 max-w-2xl mx-auto px-6 py-10">

                {/* Hero section */}
                <div className="relative mb-8 fade-up">
                    {/* Background banner */}
                    <div className="h-32 rounded-3xl overflow-hidden mb-0" style={{ background: `linear-gradient(135deg, ${roleCfg.color}20, ${roleCfg.color}05, transparent)` }}>
                        <div className="h-full w-full" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.01) 20px, rgba(255,255,255,0.01) 40px)" }} />
                    </div>

                    {/* Avatar overlapping banner */}
                    <div className="absolute left-8 -bottom-10 z-10">
                        <div className="relative">
                            {/* Spinning ring */}
                            <div className="absolute inset-[-4px] rounded-[28px] border-2 border-dashed opacity-30 spin" style={{ borderColor: roleCfg.color }} />
                            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-zinc-950"
                                style={{ background: `linear-gradient(135deg, ${roleCfg.color}30, ${roleCfg.color}10)` }}>
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarPreview("")} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white" style={{ textShadow: `0 0 20px ${roleCfg.color}` }}>
                                        {initials}
                                    </div>
                                )}
                                {uploadLoading && (
                                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-2xl">
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full" style={{ animation: "spin .7s linear infinite" }} />
                                    </div>
                                )}
                            </div>
                            {/* Camera button */}
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
                                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center text-sm border-2 border-zinc-950 transition-all hover:scale-110"
                                style={{ backgroundColor: roleCfg.color }}>
                                📷
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </div>
                    </div>

                    {/* Role badge top right of banner */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl text-xs font-black border backdrop-blur-sm"
                        style={{ color: roleCfg.color, borderColor: `${roleCfg.color}40`, backgroundColor: `${roleCfg.color}15` }}>
                        {roleCfg.icon} {roleCfg.label.toUpperCase()}
                    </div>
                </div>

                {/* Name & info */}
                <div className="mt-14 mb-6 fade-up" style={{ animationDelay: "100ms" }}>
                    <div className="flex items-end justify-between flex-wrap gap-3">
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">{displayedName}</h1>
                            {(user as any)?.displayName && <p className="text-zinc-500 font-mono text-sm mt-0.5">@{user?.username}</p>}
                            <p className="text-zinc-400 text-sm mt-1">{user?.email}</p>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-zinc-600 font-mono">ID <span className="text-zinc-400">#{user?.id}</span></span>
                                <span className="text-xs text-zinc-600 font-mono">
                                    Joined <span className="text-zinc-400">
                                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "—"}
                                    </span>
                                </span>
                            </div>
                        </div>
                        <button onClick={handleLogout}
                            className="text-xs border border-zinc-800 hover:border-red-500/40 text-zinc-500 hover:text-red-400 px-4 py-2 rounded-xl transition-all font-mono">
                            Logout
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl mb-6 fade-up" style={{ animationDelay: "150ms" }}>
                    {(["profile", "security"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all capitalize ${activeTab === tab
                                ? "text-white"
                                : "text-zinc-600 hover:text-zinc-400"
                                }`}
                            style={activeTab === tab ? { background: `${roleCfg.color}20`, color: roleCfg.color } : {}}>
                            {tab === "profile" ? "✏️ Edit Profile" : "🔐 Security"}
                        </button>
                    ))}
                </div>

                {/* Feedback */}
                {(editFeedback || pwdFeedback) && (
                    <div className={`mb-4 px-4 py-3 rounded-xl border text-xs font-mono fade-up ${(editFeedback || pwdFeedback).startsWith("✓")
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}>
                        {editFeedback || pwdFeedback}
                    </div>
                )}

                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 fade-up" style={{ animationDelay: "200ms" }}>
                        <div className="h-px w-full mb-6" style={{ background: `linear-gradient(90deg, transparent, ${roleCfg.color}40, transparent)` }} />

                        <form onSubmit={handleSaveProfile} className="space-y-5">
                            {/* Display name */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">DISPLAY NAME</label>
                                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                                    placeholder={user?.username || "Your display name"} maxLength={100}
                                    onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                                    className="w-full bg-zinc-950/60 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                                    style={{ borderColor: focused === "name" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                                <p className="text-xs text-zinc-700 font-mono mt-1">Shown in navbar and profile. Username stays unchanged.</p>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">EMAIL</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com" required
                                    onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                                    className="w-full bg-zinc-950/60 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                                    style={{ borderColor: focused === "email" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            </div>

                            {/* Avatar URL */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">AVATAR URL</label>
                                <div className="flex gap-3 items-center">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-700/50 flex-shrink-0 bg-zinc-800">
                                        {avatarPreview
                                            ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" onError={() => setAvatarPreview("")} />
                                            : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs font-mono">{initials}</div>
                                        }
                                    </div>
                                    <input type="url" value={avatarUrl} onChange={e => { setAvatarUrl(e.target.value); setAvatarPreview(e.target.value) }}
                                        placeholder="https://... or click 📷 to upload"
                                        onFocus={() => setFocused("avatar")} onBlur={() => setFocused(null)}
                                        className="flex-1 bg-zinc-950/60 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                                        style={{ borderColor: focused === "avatar" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                                </div>
                            </div>

                            <button type="submit" disabled={editLoading}
                                className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50 relative overflow-hidden"
                                style={{ background: `linear-gradient(135deg, ${roleCfg.color}, ${roleCfg.color}cc)` }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                                <span className="relative flex items-center justify-center gap-2">
                                    {editLoading
                                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin .7s linear infinite" }} />Saving...</>
                                        : "Save Changes"
                                    }
                                </span>
                            </button>
                        </form>
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === "security" && (
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 fade-up" style={{ animationDelay: "200ms" }}>
                        <div className="h-px w-full mb-6" style={{ background: `linear-gradient(90deg, transparent, ${roleCfg.color}40, transparent)` }} />

                        <div className="mb-5">
                            <h3 className="text-sm font-black text-white mb-1">Change Password</h3>
                            <p className="text-xs text-zinc-600 font-mono">Google login users can set a password to also log in with email.</p>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            {[
                                { key: "current", label: "Current Password", value: currentPwd, set: setCurrentPwd, ph: "Enter current password" },
                                { key: "new", label: "New Password", value: newPwd, set: setNewPwd, ph: "Min 6 characters" },
                                { key: "confirm", label: "Confirm Password", value: confirmPwd, set: setConfirmPwd, ph: "Repeat new password" },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">{f.label.toUpperCase()}</label>
                                    <div className="relative">
                                        <input type="password" value={f.value} onChange={e => f.set(e.target.value)}
                                            onFocus={() => setFocused(f.key)} onBlur={() => setFocused(null)}
                                            placeholder={f.ph} required
                                            className="w-full bg-zinc-950/60 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm"
                                            style={{ borderColor: focused === f.key ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                                        {focused === f.key && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: roleCfg.color }} />}
                                    </div>
                                    {f.key === "new" && newPwd.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex gap-1">{[1, 2, 3, 4].map(l => <div key={l} className="flex-1 h-1 rounded-full transition-all" style={{ backgroundColor: l <= strength ? strengthColors[strength] : "#27272a" }} />)}</div>
                                            <p className="text-xs mt-1 font-mono" style={{ color: strengthColors[strength] }}>{strengthLabels[strength]}</p>
                                        </div>
                                    )}
                                    {f.key === "confirm" && confirmPwd.length > 0 && (
                                        <p className={`text-xs mt-1 font-mono ${newPwd === confirmPwd ? "text-green-400" : "text-red-400"}`}>
                                            {newPwd === confirmPwd ? "✓ Passwords match" : "✗ Passwords do not match"}
                                        </p>
                                    )}
                                </div>
                            ))}

                            <button type="submit" disabled={pwdLoading}
                                className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50"
                                style={{ background: `linear-gradient(135deg, ${roleCfg.color}, ${roleCfg.color}cc)` }}>
                                <span className="flex items-center justify-center gap-2">
                                    {pwdLoading
                                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin .7s linear infinite" }} />Saving...</>
                                        : "Update Password"
                                    }
                                </span>
                            </button>
                        </form>

                        {/* Danger zone */}
                        <div className="mt-8 pt-6 border-t border-zinc-800/50">
                            <p className="text-xs font-mono text-zinc-600 tracking-widest mb-3">SESSION</p>
                            <button onClick={handleLogout}
                                className="w-full py-3 rounded-xl border border-red-500/20 text-red-500/70 hover:text-red-400 hover:border-red-500/40 text-xs font-bold transition-all font-mono">
                                Sign out of all devices
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}