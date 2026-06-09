"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch, getAccessToken, clearTokens } from "../lib/pitwall-auth";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import PitwallBackground from "../components/PitwallBackground";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ── Lazy Supabase client — created ONLY inside the upload handler at runtime.
// This prevents "supabaseUrl is required" at Next.js build/prerender time when
// NEXT_PUBLIC_SUPABASE_URL is not present in the build environment.
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars are missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). " +
      "Avatar upload is unavailable."
    );
  }
  // Dynamic import so the module can load without env vars at build time.
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, key);
}

const ROLE_CONFIG = {
  ADMIN:    { color: "#E10600", glow: "rgba(225,6,0,0.18)",    label: "Admin",    badge: "ADMIN" },
  ENGINEER: { color: "#3b82f6", glow: "rgba(59,130,246,0.15)", label: "Engineer", badge: "ENGINEER" },
  VIEWER:   { color: "#71717a", glow: "rgba(113,113,122,0.10)",label: "Viewer",   badge: "VIEWER" },
} as const;

interface ProfileData {
  displayName: string;
  email:       string;
  avatarUrl:   string;
  phone:       string;
  bio:         string;
  location:    string;
  dateOfBirth: string;
}

type Tab = "profile" | "security";

export default function ProfilePage() {
  const router = useRouter();
  const { user }    = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData>({
    displayName: "", email: "", avatarUrl: "", phone: "", bio: "", location: "", dateOfBirth: "",
  });
  const [avatarPreview, setAvatarPreview]   = useState("");
  const [uploadLoading, setUploadLoading]   = useState(false);
  const [saveLoading,   setSaveLoading]     = useState(false);
  const [feedback,      setFeedback]        = useState({ msg: "", ok: true });
  const [activeTab,     setActiveTab]       = useState<Tab>("profile");
  const [focused,       setFocused]         = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdFeedback, setPwdFeedback] = useState({ msg: "", ok: true });

  useEffect(() => { if (!getAccessToken()) router.push("/login"); }, [router]);

  useEffect(() => {
    if (user) {
      setProfile({
        displayName: user.displayName || "",
        email:       user.email       || "",
        avatarUrl:   user.avatarUrl   || "",
        phone:       user.phone       || "",
        bio:         user.bio         || "",
        location:    user.location    || "",
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

  // Avatar upload — Supabase client created lazily here, never at module scope.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showFeedback("Please select an image file", false); return; }
    if (file.size > 2 * 1024 * 1024)    { showFeedback("Image must be smaller than 2MB", false); return; }
    setUploadLoading(true);
    setAvatarPreview(URL.createObjectURL(file));
    try {
      const supabase = getSupabaseClient();
      const fileName = `${user?.username || "user"}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setProfile(p => ({ ...p, avatarUrl: urlData.publicUrl }));
      setAvatarPreview(urlData.publicUrl);
      showFeedback("Avatar uploaded — save to apply");
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
          localStorage.setItem("pitwall_avatar",      data.avatarUrl   || "");
          localStorage.setItem("pitwall_displayname", data.displayName || "");
        }
        showFeedback("Profile saved successfully");
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
    if (newPwd.length < 6)     { showPwdMsg("Min 6 characters", false);       return; }
    setPwdLoading(true);
    try {
      const res = await authFetch(`${API}/api/auth/change-password`, {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      if (res.ok) {
        showPwdMsg("Password changed successfully");
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      } else {
        const data = await res.json();
        showPwdMsg(data.error || "Failed", false);
      }
    } catch { showPwdMsg("Connection error", false); }
    finally { setPwdLoading(false); }
  };

  const role      = user?.role as keyof typeof ROLE_CONFIG;
  const roleCfg   = ROLE_CONFIG[role] || ROLE_CONFIG.VIEWER;
  const displayedName = user?.displayName || user?.username || "";
  const initials  = displayedName.slice(0, 2).toUpperCase() || "??";

  const strength = newPwd.length === 0 ? 0
    : newPwd.length < 6   ? 1
    : newPwd.length < 10  ? 2
    : /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) ? 4 : 3;
  const strengthColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

  const inputCls = (key: string) =>
    `w-full bg-zinc-950/70 border rounded-lg px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all f-mono text-sm ${
      focused === key ? "shadow-[0_0_0_2px_rgba(225,6,0,0.3)]" : ""
    }`;

  const borderStyle = (key: string) => ({
    borderColor: focused === key ? roleCfg.color : "rgba(63,63,70,0.45)",
  });

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden" style={{ background: "#0a0a0c" }}>
      <PitwallBackground glow="top-left" />
      <Navbar />

      <main className="relative z-10 max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-10">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="mb-10 rise" style={{ animationDelay: "0ms" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
            <p className="f-mono text-[#E10600]/60 text-xs tracking-[0.28em] uppercase">Pit Wall OS · User Profile</p>
          </div>
          <h1 className="f-cond font-black text-5xl sm:text-6xl tracking-tight leading-none">
            MY<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(135deg, ${roleCfg.color}, #ff9a6c)` }}>
              PROFILE
            </span>
          </h1>
        </div>

        {/* ── Avatar hero banner ──────────────────────────────────────── */}
        <div className="relative mb-14 rise" style={{ animationDelay: "60ms" }}>
          {/* Banner strip */}
          <div
            className="chamfer h-32 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${roleCfg.color}22, ${roleCfg.color}08, transparent)` }}
          >
            <div className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 14px,rgba(255,255,255,0.08) 14px,rgba(255,255,255,0.08) 28px)" }} />
          </div>

          {/* Role badge */}
          <div className="absolute top-3.5 right-4 f-mono text-xs font-black border backdrop-blur-sm px-2.5 py-1 rounded chamfer-sm tracking-widest"
            style={{ color: roleCfg.color, borderColor: `${roleCfg.color}45`, backgroundColor: `${roleCfg.color}18` }}>
            {roleCfg.badge}
          </div>

          {/* Avatar */}
          <div className="absolute left-6 -bottom-10">
            <div className="relative">
              <div
                className="absolute inset-[-5px] rounded-2xl border-2 border-dashed opacity-30"
                style={{ borderColor: roleCfg.color, animation: "spin-slow 12s linear infinite" }}
              />
              <div
                className="w-24 h-24 rounded-xl overflow-hidden border-4 border-[#0a0a0c] relative chamfer"
                style={{ background: `linear-gradient(135deg,${roleCfg.color}30,${roleCfg.color}08)` }}
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarPreview("")} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center f-cond text-3xl font-black text-white">
                    {initials}
                  </div>
                )}
                {uploadLoading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg flex items-center justify-center text-sm border-2 border-[#0a0a0c] hover:scale-110 transition-transform"
                style={{ backgroundColor: roleCfg.color }}
                title="Upload avatar"
              >
                📷
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>
        </div>

        {/* ── Name / meta row ─────────────────────────────────────────── */}
        <div className="mb-6 rise" style={{ animationDelay: "100ms" }}>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h2 className="f-cond text-2xl font-black text-white leading-tight">{displayedName}</h2>
              {user?.displayName && (
                <p className="f-mono text-zinc-500 text-xs">@{user?.username}</p>
              )}
              <p className="text-zinc-500 text-sm mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="f-mono text-xs text-zinc-600">ID <span className="text-zinc-400">#{user?.id}</span></span>
                <span className="f-mono text-xs text-zinc-600">
                  Joined{" "}
                  <span className="text-zinc-400">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short" })
                      : "—"}
                  </span>
                </span>
                {profile.location && (
                  <span className="f-mono text-xs text-zinc-500">📍 {profile.location}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => { clearTokens(); router.push("/login"); }}
              className="f-mono text-xs border border-zinc-800 hover:border-red-500/40 text-zinc-500 hover:text-red-400 px-4 py-2 rounded-lg transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Segmented tab control ───────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-zinc-900/70 border border-[rgba(255,255,255,0.06)] rounded-xl mb-5 rise" style={{ animationDelay: "140ms" }}>
          {(["profile", "security"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex-1 py-2.5 rounded-lg f-mono text-xs font-bold transition-all ${
                activeTab === tab ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              }`}
              style={activeTab === tab ? { background: `${roleCfg.color}20`, color: roleCfg.color } : {}}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: `${roleCfg.color}18`, borderColor: `${roleCfg.color}30` }}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative">
                {tab === "profile" ? "EDIT PROFILE" : "SECURITY"}
              </span>
            </button>
          ))}
        </div>

        {/* ── Global feedback banner ──────────────────────────────────── */}
        <AnimatePresence>
          {feedback.msg && (
            <motion.div
              key="fb"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mb-4 px-4 py-3 rounded-lg border f-mono text-xs ${
                feedback.ok
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-red-500/10  border-red-500/30  text-red-400"
              }`}
            >
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* PROFILE TAB                                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile-tab"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              <form
                onSubmit={handleSave}
                className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6 space-y-5"
                style={{ backdropFilter: "blur(20px)" }}
              >
                {/* Accent line */}
                <div className="h-px" style={{ background: `linear-gradient(90deg,transparent,${roleCfg.color}55,transparent)` }} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Display name */}
                  <div>
                    <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">DISPLAY NAME</label>
                    <input
                      type="text"
                      value={profile.displayName}
                      onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                      placeholder={user?.username || "Your name"}
                      maxLength={100}
                      onFocus={() => setFocused("dn")}
                      onBlur={() => setFocused(null)}
                      className={inputCls("dn")}
                      style={borderStyle("dn")}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">EMAIL</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      placeholder="your@email.com"
                      required
                      onFocus={() => setFocused("em")}
                      onBlur={() => setFocused(null)}
                      className={inputCls("em")}
                      style={borderStyle("em")}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">PHONE</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+84 xxx xxx xxx"
                      maxLength={20}
                      onFocus={() => setFocused("ph")}
                      onBlur={() => setFocused(null)}
                      className={inputCls("ph")}
                      style={borderStyle("ph")}
                    />
                  </div>

                  {/* Date of birth */}
                  <div>
                    <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">DATE OF BIRTH</label>
                    <input
                      type="date"
                      value={profile.dateOfBirth}
                      onChange={e => setProfile(p => ({ ...p, dateOfBirth: e.target.value }))}
                      onFocus={() => setFocused("dob")}
                      onBlur={() => setFocused(null)}
                      className={`${inputCls("dob")} [color-scheme:dark]`}
                      style={borderStyle("dob")}
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">LOCATION</label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                      placeholder="Ho Chi Minh City, Vietnam"
                      maxLength={100}
                      onFocus={() => setFocused("loc")}
                      onBlur={() => setFocused(null)}
                      className={inputCls("loc")}
                      style={borderStyle("loc")}
                    />
                  </div>

                  {/* Avatar URL */}
                  <div>
                    <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">AVATAR URL</label>
                    <div className="flex gap-2 items-center">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-700/50 flex-shrink-0 bg-zinc-800/80 chamfer-sm">
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarPreview} alt="" className="w-full h-full object-cover" onError={() => setAvatarPreview("")} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 f-cond text-xs font-black">{initials}</div>
                        )}
                      </div>
                      <input
                        type="url"
                        value={profile.avatarUrl}
                        onChange={e => { setProfile(p => ({ ...p, avatarUrl: e.target.value })); setAvatarPreview(e.target.value); }}
                        placeholder="https://... or click 📷"
                        onFocus={() => setFocused("av")}
                        onBlur={() => setFocused(null)}
                        className={inputCls("av")}
                        style={borderStyle("av")}
                      />
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">BIO</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell us a bit about yourself..."
                    maxLength={300}
                    rows={3}
                    onFocus={() => setFocused("bio")}
                    onBlur={() => setFocused(null)}
                    className={`${inputCls("bio")} resize-none`}
                    style={borderStyle("bio")}
                  />
                  <p className="f-mono text-xs text-zinc-700 mt-1 text-right">{profile.bio.length}/300</p>
                </div>

                {/* Save button */}
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full py-3.5 rounded-lg f-cond font-black text-base text-white transition-all disabled:opacity-50 relative overflow-hidden chamfer-sm"
                  style={{ background: `linear-gradient(135deg, ${roleCfg.color}, ${roleCfg.color}bb)`, boxShadow: `0 0 18px ${roleCfg.color}40` }}
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    {saveLoading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />SAVING...</>
                      : "SAVE PROFILE"
                    }
                  </span>
                </button>
              </form>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* SECURITY TAB                                                  */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === "security" && (
            <motion.div
              key="security-tab"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              <div
                className="chamfer bg-[rgba(18,18,21,0.78)] border border-[rgba(255,255,255,0.06)] p-6"
                style={{ backdropFilter: "blur(20px)" }}
              >
                <div className="h-px mb-6" style={{ background: `linear-gradient(90deg,transparent,${roleCfg.color}55,transparent)` }} />

                <div className="mb-5">
                  <h3 className="f-cond text-lg font-black text-white mb-1">Change Password</h3>
                  <p className="f-mono text-xs text-zinc-600">Google users can set a password to also log in with email.</p>
                </div>

                <AnimatePresence>
                  {pwdFeedback.msg && (
                    <motion.div
                      key="pwdfb"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`mb-4 px-4 py-3 rounded-lg border f-mono text-xs ${
                        pwdFeedback.ok
                          ? "bg-green-500/10 border-green-500/30 text-green-400"
                          : "bg-red-500/10  border-red-500/30  text-red-400"
                      }`}
                    >
                      {pwdFeedback.msg}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {[
                    { key: "cur", label: "CURRENT PASSWORD", value: currentPwd, set: setCurrentPwd, ph: "Enter current password" },
                    { key: "new", label: "NEW PASSWORD",     value: newPwd,     set: setNewPwd,     ph: "Min 6 characters" },
                    { key: "con", label: "CONFIRM PASSWORD", value: confirmPwd, set: setConfirmPwd, ph: "Repeat new password" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block f-mono text-xs text-zinc-500 tracking-widest mb-2">{f.label}</label>
                      <div className="relative">
                        <input
                          type="password"
                          value={f.value}
                          onChange={e => f.set(e.target.value)}
                          onFocus={() => setFocused(f.key)}
                          onBlur={() => setFocused(null)}
                          placeholder={f.ph}
                          required
                          className="w-full bg-zinc-950/70 border rounded-lg px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all f-mono text-sm"
                          style={{ borderColor: focused === f.key ? roleCfg.color : "rgba(63,63,70,0.45)" }}
                        />
                        {focused === f.key && (
                          <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{ backgroundColor: roleCfg.color }}
                          />
                        )}
                      </div>

                      {/* Strength meter */}
                      {f.key === "new" && newPwd.length > 0 && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map(l => (
                              <div
                                key={l}
                                className="flex-1 h-1 rounded-full transition-all duration-300"
                                style={{ backgroundColor: l <= strength ? strengthColors[strength] : "#27272a" }}
                              />
                            ))}
                          </div>
                          <p className="f-mono text-xs mt-1" style={{ color: strengthColors[strength] }}>
                            {strengthLabels[strength]}
                          </p>
                        </div>
                      )}

                      {/* Match indicator */}
                      {f.key === "con" && confirmPwd.length > 0 && (
                        <p className={`f-mono text-xs mt-1 ${newPwd === confirmPwd ? "text-green-400" : "text-red-400"}`}>
                          {newPwd === confirmPwd ? "✓ Passwords match" : "✗ Passwords do not match"}
                        </p>
                      )}
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="w-full py-3.5 rounded-lg f-cond font-black text-base text-white transition-all disabled:opacity-50 chamfer-sm"
                    style={{ background: `linear-gradient(135deg, ${roleCfg.color}, ${roleCfg.color}bb)`, boxShadow: `0 0 18px ${roleCfg.color}40` }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {pwdLoading
                        ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />SAVING...</>
                        : "UPDATE PASSWORD"
                      }
                    </span>
                  </button>
                </form>

                {/* Sign out */}
                <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.06)]">
                  <p className="f-mono text-xs text-zinc-600 tracking-widest mb-3">SESSION</p>
                  <button
                    onClick={() => { clearTokens(); router.push("/login"); }}
                    className="w-full py-3 rounded-lg border border-red-500/20 text-red-500/60 hover:text-red-400 hover:border-red-500/40 f-mono text-xs font-bold transition-all"
                  >
                    Sign out of all sessions
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
