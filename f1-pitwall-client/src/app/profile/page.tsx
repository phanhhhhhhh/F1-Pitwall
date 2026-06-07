"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getAccessToken, clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { createClient } from "@supabase/supabase-js";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const ROLE_CONFIG = {
    ADMIN: { color: "#ef4444", glow: "rgba(239,68,68,0.15)", label: "Admin", icon: "⚡" },
    ENGINEER: { color: "#3b82f6", glow: "rgba(59,130,246,0.15)", label: "Engineer", icon: "🔧" },
    VIEWER: { color: "#71717a", glow: "rgba(113,113,122,0.10)", label: "Viewer", icon: "👁" },
};

interface ProfileData {
    displayName: string;
    email: string;
    avatarUrl: string;
    phone: string;
    bio: string;
    location: string;
    dateOfBirth: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<ProfileData>({
        displayName: "", email: "", avatarUrl: "", phone: "", bio: "", location: "", dateOfBirth: "",
    });
    const [avatarPreview, setAvatarPreview] = useState("");
    const [uploadLoading, setUploadLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [feedback, setFeedback] = useState({ msg: "", ok: true });
    const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
    const [focused, setFocused] = useState<string | null>(null);

    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdFeedback, setPwdFeedback] = useState({ msg: "", ok: true });

    useEffect(() => { if (!getAccessToken()) router.push("/login"); }, []);

    useEffect(() => {
        if (user) {
            setProfile({
                displayName: user.displayName || "",
                email: user.email || "",
                avatarUrl: user.avatarUrl || "",
                phone: user.phone || "",
                bio: user.bio || "",
                location: user.location || "",
                dateOfBirth: user.dateOfBirth || "",
            });
            setAvatarPreview(user.avatarUrl || "");
        }
    }, [user]);

    const showFeedback = (msg: string, ok = true) => {
        setFeedback({ msg, ok });
        setTimeout(() => setFeedback({ msg: "", ok: true }), 4000);
    };
    const showPwdMsg = (msg: string, ok = true) => {
        setPwdFeedback({ msg, ok });
        setTimeout(() => setPwdFeedback({ msg: "", ok: true }), 4000);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { showFeedback("Please select an image file", false); return; }
        if (file.size > 2 * 1024 * 1024) { showFeedback("Image must be smaller than 2MB", false); return; }
        setUploadLoading(true);
        setAvatarPreview(URL.createObjectURL(file));
        try {
            const fileName = `${user?.username || "user"}-${Date.now()}.${file.name.split(".").pop()}`;
            const { error } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
            setProfile(p => ({ ...p, avatarUrl: urlData.publicUrl }));
            setAvatarPreview(urlData.publicUrl);
            showFeedback("✓ Avatar uploaded — save to apply");
        } catch (err: unknown) {
            setAvatarPreview(profile.avatarUrl);
            showFeedback("Upload failed: " + ((err as Error).message || "Unknown error"), false);
        } finally { setUploadLoading(false); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveLoading(true);
        try {
            const res = await authFetch(`${API}/api/auth/profile`, {
                method: "PATCH",
                body: JSON.stringify(profile),
            });
            if (res.ok) {
                const data = await res.json();
                if (typeof window !== "undefined") {
                    localStorage.setItem("pitwall_avatar", data.avatarUrl || "");
                    localStorage.setItem("pitwall_displayname", data.displayName || "");
                }
                showFeedback("✓ Profile saved successfully");
            } else {
                const data = await res.json();
                showFeedback(data.error || "Update failed", false);
            }
        } catch { showFeedback("Connection error", false); }
        finally { setSaveLoading(false); }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd !== confirmPwd) { showPwdMsg("Passwords do not match", false); return; }
        if (newPwd.length < 6) { showPwdMsg("Min 6 characters", false); return; }
        setPwdLoading(true);
        try {
            const res = await authFetch(`${API}/api/auth/change-password`, {
                method: "POST",
                body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
            });
            if (res.ok) {
                showPwdMsg("✓ Password changed successfully");
                setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
            } else {
                const data = await res.json();
                showPwdMsg(data.error || "Failed", false);
            }
        } catch { showPwdMsg("Connection error", false); }
        finally { setPwdLoading(false); }
    };

    const role = user?.role as keyof typeof ROLE_CONFIG;
    const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.VIEWER;
    const displayedName = user?.displayName || user?.username || "";
    const initials = displayedName.slice(0, 2).toUpperCase();

    const strength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 10 ? 2 : /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) ? 4 : 3;
    const strengthColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
    const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

    const inputCls = (key: string) =>
        `w-full bg-zinc-950/60 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all font-mono text-sm ${focused === key ? "border-opacity-100" : "border-zinc-700/50"
        }`;

    return (
        <div className="min-h-screen bg-zinc-950">
            <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spinSlow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes glowPulse{0%,100%{opacity:.3}50%{opacity:.8}}
        .fade-up{animation:fadeUp .4s ease-out both}
        .spin-slow{animation:spinSlow 10s linear infinite}
        .glow-pulse{animation:glowPulse 3s ease-in-out infinite}
      `}</style>

            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-zinc-950" />
                <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[200px] glow-pulse" style={{ background: roleCfg.glow }} />
            </div>

            <Navbar />

            <main className="relative z-10 max-w-2xl mx-auto px-6 py-10">

                {/* Banner + Avatar */}
                <div className="relative mb-14 fade-up">
                    <div className="h-36 rounded-3xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${roleCfg.color}25, ${roleCfg.color}08, transparent)` }}>
                        <div className="h-full w-full opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 15px,rgba(255,255,255,0.03) 15px,rgba(255,255,255,0.03) 30px)" }} />
                    </div>

                    {/* Role badge */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl text-xs font-black border backdrop-blur-sm"
                        style={{ color: roleCfg.color, borderColor: `${roleCfg.color}40`, backgroundColor: `${roleCfg.color}15` }}>
                        {roleCfg.icon} {roleCfg.label.toUpperCase()}
                    </div>

                    {/* Avatar */}
                    <div className="absolute left-8 -bottom-10">
                        <div className="relative">
                            <div className="absolute inset-[-5px] rounded-[26px] border-2 border-dashed opacity-25 spin-slow" style={{ borderColor: roleCfg.color }} />
                            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-zinc-950 relative"
                                style={{ background: `linear-gradient(135deg,${roleCfg.color}30,${roleCfg.color}08)` }}>
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarPreview("")} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                                        {initials}
                                    </div>
                                )}
                                {uploadLoading && (
                                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}
                                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center text-sm border-2 border-zinc-950 hover:scale-110 transition-transform"
                                style={{ backgroundColor: roleCfg.color }}>
                                📷
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </div>
                    </div>
                </div>

                {/* Name row */}
                <div className="mb-6 fade-up" style={{ animationDelay: "80ms" }}>
                    <div className="flex items-end justify-between flex-wrap gap-3">
                        <div>
                            <h1 className="text-2xl font-black text-white">{displayedName}</h1>
                            {user?.displayName && <p className="text-zinc-500 font-mono text-sm">@{user?.username}</p>}
                            <p className="text-zinc-500 text-sm mt-0.5">{user?.email}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="text-xs text-zinc-600 font-mono">ID <span className="text-zinc-400">#{user?.id}</span></span>
                                <span className="text-xs text-zinc-600 font-mono">
                                    Joined <span className="text-zinc-400">
                                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "—"}
                                    </span>
                                </span>
                                {profile.location && <span className="text-xs text-zinc-500">📍 {profile.location}</span>}
                            </div>
                        </div>
                        <button onClick={() => { clearTokens(); router.push("/login"); }}
                            className="text-xs border border-zinc-800 hover:border-red-500/40 text-zinc-500 hover:text-red-400 px-4 py-2 rounded-xl transition-all font-mono">
                            Logout
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl mb-5 fade-up" style={{ animationDelay: "120ms" }}>
                    {(["profile", "security"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}
                            style={activeTab === tab ? { background: `${roleCfg.color}20`, color: roleCfg.color } : {}}>
                            {tab === "profile" ? "✏️ Edit Profile" : "🔐 Security"}
                        </button>
                    ))}
                </div>

                {/* Feedback */}
                {feedback.msg && (
                    <div className={`mb-4 px-4 py-3 rounded-xl border text-xs font-mono fade-up ${feedback.ok ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}>{feedback.msg}</div>
                )}

                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <form onSubmit={handleSave} className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 space-y-5 fade-up" style={{ animationDelay: "160ms" }}>
                        <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${roleCfg.color}40,transparent)` }} />

                        {/* 2-col grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Display name */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">DISPLAY NAME</label>
                                <input type="text" value={profile.displayName} onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                                    placeholder={user?.username || "Your name"} maxLength={100}
                                    onFocus={() => setFocused("dn")} onBlur={() => setFocused(null)}
                                    className={inputCls("dn")} style={{ borderColor: focused === "dn" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">EMAIL</label>
                                <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                                    placeholder="your@email.com" required
                                    onFocus={() => setFocused("em")} onBlur={() => setFocused(null)}
                                    className={inputCls("em")} style={{ borderColor: focused === "em" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">PHONE</label>
                                <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="+84 xxx xxx xxx" maxLength={20}
                                    onFocus={() => setFocused("ph")} onBlur={() => setFocused(null)}
                                    className={inputCls("ph")} style={{ borderColor: focused === "ph" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            </div>

                            {/* Date of Birth */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">DATE OF BIRTH</label>
                                <input type="date" value={profile.dateOfBirth} onChange={e => setProfile(p => ({ ...p, dateOfBirth: e.target.value }))}
                                    onFocus={() => setFocused("dob")} onBlur={() => setFocused(null)}
                                    className={inputCls("dob") + " [color-scheme:dark]"} style={{ borderColor: focused === "dob" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">LOCATION</label>
                                <input type="text" value={profile.location} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                                    placeholder="Ho Chi Minh City, Vietnam" maxLength={100}
                                    onFocus={() => setFocused("loc")} onBlur={() => setFocused(null)}
                                    className={inputCls("loc")} style={{ borderColor: focused === "loc" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            </div>

                            {/* Avatar URL */}
                            <div>
                                <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">AVATAR URL</label>
                                <div className="flex gap-2 items-center">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-700/50 flex-shrink-0 bg-zinc-800">
                                        {avatarPreview
                                            ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" onError={() => setAvatarPreview("")} />
                                            : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">{initials}</div>
                                        }
                                    </div>
                                    <input type="url" value={profile.avatarUrl} onChange={e => { setProfile(p => ({ ...p, avatarUrl: e.target.value })); setAvatarPreview(e.target.value) }}
                                        placeholder="https://... or click 📷"
                                        onFocus={() => setFocused("av")} onBlur={() => setFocused(null)}
                                        className={inputCls("av")} style={{ borderColor: focused === "av" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                                </div>
                            </div>
                        </div>

                        {/* Bio — full width */}
                        <div>
                            <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">BIO</label>
                            <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                                placeholder="Tell us a bit about yourself..." maxLength={300} rows={3}
                                onFocus={() => setFocused("bio")} onBlur={() => setFocused(null)}
                                className={`${inputCls("bio")} resize-none`} style={{ borderColor: focused === "bio" ? roleCfg.color : "rgba(63,63,70,0.5)" }} />
                            <p className="text-xs text-zinc-700 font-mono mt-1 text-right">{profile.bio.length}/300</p>
                        </div>

                        <button type="submit" disabled={saveLoading}
                            className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50 relative overflow-hidden"
                            style={{ background: `linear-gradient(135deg,${roleCfg.color},${roleCfg.color}bb)` }}>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                            <span className="relative flex items-center justify-center gap-2">
                                {saveLoading
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                                    : "Save Profile"
                                }
                            </span>
                        </button>
                    </form>
                )}

                {/* Security Tab */}
                {activeTab === "security" && (
                    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 fade-up" style={{ animationDelay: "160ms" }}>
                        <div className="h-px mb-6" style={{ background: `linear-gradient(90deg,transparent,${roleCfg.color}40,transparent)` }} />

                        <div className="mb-5">
                            <h3 className="text-sm font-black text-white mb-1">Change Password</h3>
                            <p className="text-xs text-zinc-600 font-mono">Google users can set a password to also log in with email.</p>
                        </div>

                        {pwdFeedback.msg && (
                            <div className={`mb-4 px-4 py-3 rounded-xl border text-xs font-mono ${pwdFeedback.ok ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}>{pwdFeedback.msg}</div>
                        )}

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            {[
                                { key: "cur", label: "CURRENT PASSWORD", value: currentPwd, set: setCurrentPwd, ph: "Enter current password" },
                                { key: "new", label: "NEW PASSWORD", value: newPwd, set: setNewPwd, ph: "Min 6 characters" },
                                { key: "con", label: "CONFIRM PASSWORD", value: confirmPwd, set: setConfirmPwd, ph: "Repeat new password" },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-xs font-mono text-zinc-500 tracking-widest mb-2">{f.label}</label>
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
                                    {f.key === "con" && confirmPwd.length > 0 && (
                                        <p className={`text-xs mt-1 font-mono ${newPwd === confirmPwd ? "text-green-400" : "text-red-400"}`}>
                                            {newPwd === confirmPwd ? "✓ Passwords match" : "✗ Passwords do not match"}
                                        </p>
                                    )}
                                </div>
                            ))}
                            <button type="submit" disabled={pwdLoading}
                                className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-50"
                                style={{ background: `linear-gradient(135deg,${roleCfg.color},${roleCfg.color}bb)` }}>
                                <span className="flex items-center justify-center gap-2">
                                    {pwdLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</> : "Update Password"}
                                </span>
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-zinc-800/50">
                            <p className="text-xs font-mono text-zinc-600 tracking-widest mb-3">SESSION</p>
                            <button onClick={() => { clearTokens(); router.push("/login"); }}
                                className="w-full py-3 rounded-xl border border-red-500/20 text-red-500/60 hover:text-red-400 hover:border-red-500/40 text-xs font-bold transition-all font-mono">
                                Sign out
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}