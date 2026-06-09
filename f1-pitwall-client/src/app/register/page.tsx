"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { register } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import PitwallBackground from "../components/PitwallBackground";
import { F1 } from "../lib/f1-theme";

/* ── Shared micro-components (local copies keep page self-contained) ─────── */

function RedLine() {
    return (
        <div
            className="h-px w-full"
            style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }}
        />
    );
}

function Spinner() {
    return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

function ErrorBanner({ msg }: { msg: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-lg f-mono text-xs text-red-400 text-center flex items-center gap-2 justify-center chamfer-sm"
            style={{ background: "rgba(225,6,0,0.08)", border: `1px solid rgba(225,6,0,0.28)` }}
        >
            <span className="text-base">⚠</span> {msg}
        </motion.div>
    );
}

/* ── Password strength ───────────────────────────────────────────────────── */
const STRENGTH_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function strengthScore(p: string): number {
    if (!p) return 0;
    return p.length < 6 ? 1 : p.length < 10 ? 2 : /[A-Z]/.test(p) && /[0-9]/.test(p) ? 4 : 3;
}

function StrengthBar({ password }: { password: string }) {
    const s = strengthScore(password);
    if (!password) return null;
    return (
        <div className="mt-1.5">
            <div className="flex gap-1 mb-0.5">
                {[1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        className="h-0.5 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= s ? STRENGTH_COLORS[s] : "rgba(63,63,70,0.5)" }}
                    />
                ))}
            </div>
            <p className="f-mono text-[10px]" style={{ color: STRENGTH_COLORS[s] }}>{STRENGTH_LABELS[s]}</p>
        </div>
    );
}

/* ── Logo lockup ─────────────────────────────────────────────────────────── */
function PitwallLogo({ sub }: { sub: string }) {
    return (
        <div className="text-center mb-7">
            <div className="relative inline-flex items-center justify-center mb-4">
                <svg
                    className="absolute"
                    width="64" height="64" viewBox="0 0 64 64"
                    style={{ animation: "spin-slow 9s linear infinite" }}
                >
                    <circle cx="32" cy="32" r="30" fill="none" stroke={F1.red} strokeWidth="1" strokeDasharray="6 5" opacity="0.35" />
                </svg>
                <svg
                    className="absolute"
                    width="50" height="50" viewBox="0 0 50 50"
                    style={{ animation: "spin-slow 5s linear infinite reverse" }}
                >
                    <circle cx="25" cy="25" r="22" fill="none" stroke={F1.red} strokeWidth="0.8" strokeDasharray="3 9" opacity="0.2" />
                </svg>
                <div
                    className="relative w-12 h-12 rounded-full flex items-center justify-center text-xl"
                    style={{
                        background: "rgba(225,6,0,0.10)",
                        border: `1px solid rgba(225,6,0,0.22)`,
                        boxShadow: "0 0 22px rgba(225,6,0,0.15)",
                    }}
                >
                    🏎️
                </div>
            </div>
            <h1 className="f-cond font-black tracking-tight leading-none"
                style={{ fontSize: "clamp(2rem,6vw,2.6rem)" }}>
                <span style={{ color: F1.red }}>PIT</span>
                <span className="text-white">WALL</span>
            </h1>
            <div className="mt-1 mx-auto h-px w-14" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
            <p className="f-mono text-zinc-500 text-[10px] tracking-[0.4em] uppercase mt-1.5">{sub}</p>
        </div>
    );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => { setTimeout(() => setMounted(true), 30); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!username.trim() || username.trim().length < 3) { setError("Callsign must be at least 3 characters"); return; }
        if (!email.trim() || !email.includes("@") || !email.includes(".")) { setError("Please enter a valid email address"); return; }
        if (password !== confirm) { setError("Passwords do not match"); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
        setIsLoading(true);
        try {
            await register(username, password, email);
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed");
        } finally {
            setIsLoading(false);
        }
    };

    const fields: Array<{
        key: string; label: string; type: string; value: string;
        set: (v: string) => void; placeholder: string; autoComplete: string;
    }> = [
        { key: "username", label: "Callsign", type: "text",     value: username,  set: setUsername,  placeholder: "e.g. hamilton44",   autoComplete: "username"     },
        { key: "email",    label: "Email",    type: "email",    value: email,     set: setEmail,     placeholder: "you@pitwall.f1",    autoComplete: "email"        },
        { key: "password", label: "Access Code",   type: "password", value: password,  set: setPassword,  placeholder: "min 6 characters",  autoComplete: "new-password" },
        { key: "confirm",  label: "Confirm Code",  type: "password", value: confirm,   set: setConfirm,   placeholder: "••••••••",          autoComplete: "new-password" },
    ];

    const inputStyle = (key: string) => ({
        borderColor: focused === key ? F1.red : F1.hairline,
        boxShadow: focused === key ? `0 0 18px rgba(225,6,0,0.18)` : "none",
        background: "rgba(10,10,12,0.82)",
    });

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
            style={{ background: F1.bg }}
        >
            <PitwallBackground glow="top-center" streaks={4} />

            <div
                className={`relative z-10 w-full max-w-md transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            >
                {/* Glow halo */}
                <div
                    className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(225,6,0,0.07),transparent 70%)" }}
                />

                {/* Card */}
                <div
                    className="relative rounded-xl overflow-hidden shadow-2xl"
                    style={{
                        background: F1.card,
                        border: `1px solid ${F1.hairline}`,
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                    }}
                >
                    <RedLine />

                    <div className="p-7 sm:p-8">
                        <PitwallLogo sub="Create Account" />

                        <AnimatePresence>
                            {error && <ErrorBanner msg={error} />}
                        </AnimatePresence>

                        {/* Google */}
                        <a
                            href={`${API}/oauth2/authorize/google`}
                            className="flex items-center justify-center gap-3 w-full py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-white transition-all duration-200 mb-1"
                            style={{ border: `1px solid ${F1.hairline}`, background: "rgba(255,255,255,0.03)" }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.15)";
                                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLAnchorElement).style.borderColor = F1.hairline;
                                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.03)";
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
                                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
                                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
                                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z" />
                            </svg>
                            Continue with Google
                        </a>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px" style={{ background: F1.hairline }} />
                            <span className="f-mono text-zinc-600 text-[10px] tracking-widest uppercase">or</span>
                            <div className="flex-1 h-px" style={{ background: F1.hairline }} />
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            {fields.map((f, i) => (
                                <motion.div
                                    key={f.key}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 + i * 0.04 }}
                                >
                                    <label className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-1.5">{f.label}</label>
                                    <div className="relative">
                                        <input
                                            type={f.type}
                                            value={f.value}
                                            onChange={e => f.set(e.target.value)}
                                            onFocus={() => setFocused(f.key)}
                                            onBlur={() => setFocused(null)}
                                            autoComplete={f.autoComplete}
                                            placeholder={f.placeholder}
                                            required
                                            className="w-full f-mono border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg px-4 py-3 text-sm"
                                            style={inputStyle(f.key)}
                                        />
                                        {focused === f.key && (
                                            <span
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
                                                style={{ background: F1.red }}
                                            />
                                        )}
                                    </div>

                                    {/* Password strength meter */}
                                    {f.key === "password" && <StrengthBar password={password} />}

                                    {/* Confirm match */}
                                    {f.key === "confirm" && confirm.length > 0 && (
                                        <p className={`f-mono text-[10px] mt-1 ${password === confirm ? "text-green-400" : "text-red-400"}`}>
                                            {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                                        </p>
                                    )}
                                </motion.div>
                            ))}

                            {/* Role notice */}
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                                className="rounded-lg px-4 py-3"
                                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${F1.hairline}` }}
                            >
                                <p className="f-mono text-[10px] text-zinc-500">
                                    🔒 New accounts receive <span className="text-zinc-300 font-bold">VIEWER</span> role.
                                    Contact an admin to upgrade.
                                </p>
                            </motion.div>

                            {/* Submit */}
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="relative w-full py-3.5 rounded-lg f-mono font-bold text-xs tracking-[0.2em] uppercase overflow-hidden transition-all duration-300 disabled:opacity-50 text-white chamfer-sm"
                                    style={{
                                        background: isLoading ? "rgba(39,39,42,0.8)" : `linear-gradient(135deg,${F1.red},#dc2626)`,
                                        boxShadow: isLoading ? "none" : `0 0 28px rgba(225,6,0,0.30)`,
                                    }}
                                >
                                    {!isLoading && (
                                        <span className="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ width: "60%" }} />
                                    )}
                                    <span className="relative flex items-center justify-center gap-2">
                                        {isLoading ? <><Spinner /> Creating Account...</> : "Create Account →"}
                                    </span>
                                </button>
                            </motion.div>
                        </form>

                        {/* Footer */}
                        <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${F1.hairline}` }}>
                            <p className="f-mono text-zinc-600 text-[11px]">
                                Already have an account?{" "}
                                <a href="/login" className="text-red-500 hover:text-red-400 transition-colors font-bold">Sign in</a>
                            </p>
                        </div>
                    </div>

                    <div className="h-px w-full" style={{ background: F1.hairline }} />
                    <div className="h-0.5 w-1/3 mx-auto" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
                </div>
            </div>
        </div>
    );
}
