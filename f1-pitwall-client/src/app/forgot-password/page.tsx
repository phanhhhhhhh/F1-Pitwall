"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendForgotPasswordOtp, resetPassword } from "../lib/pitwall-auth";
import { motion, AnimatePresence } from "framer-motion";
import PitwallBackground from "../components/PitwallBackground";
import { F1 } from "../lib/f1-theme";

type Step = "email" | "reset" | "done";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function RedLine() {
    return (
        <div className="h-px w-full" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
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

const STRENGTH_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function strengthScore(p: string): number {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
}

/* ── Step indicator ──────────────────────────────────────────────────────── */
const STEPS: Step[] = ["email", "reset", "done"];
const STEP_LABELS = ["Email", "Reset", "Done"];

function StepIndicator({ current }: { current: Step }) {
    const ci = STEPS.indexOf(current);
    return (
        <div className="flex items-center gap-2 mb-7">
            {STEPS.map((s, i) => {
                const done = ci > i;
                const active = ci === i;
                return (
                    <div key={s} className="flex items-center gap-2 flex-1">
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center f-mono text-[10px] font-black transition-all duration-300"
                                style={{
                                    background: done ? "rgba(225,6,0,0.30)" : active ? F1.red : "rgba(39,39,42,0.8)",
                                    border: done || active ? `1px solid rgba(225,6,0,0.5)` : `1px solid ${F1.hairline}`,
                                    color: done || active ? "#fff" : "#52525b",
                                    boxShadow: active ? `0 0 12px rgba(225,6,0,0.35)` : "none",
                                }}
                            >
                                {done ? "✓" : i + 1}
                            </div>
                            <span className="f-mono text-[9px] uppercase tracking-wider" style={{ color: active ? F1.red : done ? "rgba(225,6,0,0.6)" : "#52525b" }}>
                                {STEP_LABELS[i]}
                            </span>
                        </div>
                        {i < 2 && (
                            <div
                                className="flex-1 h-px mb-3 transition-all duration-500"
                                style={{ background: done ? `rgba(225,6,0,0.4)` : F1.hairline }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);

    const pw = strengthScore(newPassword);

    async function handleSendOtp(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (!email.trim()) { setError("Email is required"); return; }
        setLoading(true);
        try {
            await sendForgotPasswordOtp(email.trim());
            setStep("reset");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    }

    async function handleReset(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (!otp.trim()) { setError("OTP is required"); return; }
        if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
        setLoading(true);
        try {
            await resetPassword(email.trim(), otp.trim(), newPassword);
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Reset failed");
        } finally {
            setLoading(false);
        }
    }

    const inputStyle = (field: string) => ({
        borderColor: focused === field ? F1.red : F1.hairline,
        boxShadow: focused === field ? `0 0 18px rgba(225,6,0,0.18)` : "none",
        background: "rgba(10,10,12,0.82)",
    });

    const labelEl = (txt: string) => (
        <label className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-1.5">{txt}</label>
    );

    const primaryBtn = (label: React.ReactNode, disabled = false) => (
        <button
            type="submit"
            disabled={disabled}
            className="relative w-full py-3.5 rounded-lg f-mono font-bold text-xs tracking-[0.2em] uppercase overflow-hidden transition-all duration-300 disabled:opacity-50 text-white chamfer-sm"
            style={{
                background: disabled ? "rgba(39,39,42,0.8)" : `linear-gradient(135deg,${F1.red},#dc2626)`,
                boxShadow: disabled ? "none" : `0 0 28px rgba(225,6,0,0.30)`,
            }}
        >
            {!disabled && <span className="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ width: "60%" }} />}
            <span className="relative flex items-center justify-center gap-2">{label}</span>
        </button>
    );

    const stepTitles: Record<Step, [string, string]> = {
        email: ["RESET", " ACCESS"],
        reset: ["ENTER", " CODE"],
        done:  ["ACCESS", " UPDATED"],
    };
    const [red, white] = stepTitles[step];

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
            style={{ background: F1.bg }}
        >
            <PitwallBackground glow="top-center" streaks={3} />

            <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-md"
            >
                <div
                    className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 50% 40%,rgba(225,6,0,0.07),transparent 70%)" }}
                />

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
                        {/* Header */}
                        <div className="text-center mb-7">
                            <div className="relative inline-flex items-center justify-center mb-4">
                                <svg
                                    className="absolute" width="60" height="60" viewBox="0 0 60 60"
                                    style={{ animation: "spin-slow 9s linear infinite" }}
                                >
                                    <circle cx="30" cy="30" r="28" fill="none" stroke={F1.red} strokeWidth="1" strokeDasharray="6 5" opacity="0.35" />
                                </svg>
                                <div
                                    className="relative w-12 h-12 rounded-full flex items-center justify-center text-xl"
                                    style={{
                                        background: "rgba(225,6,0,0.10)",
                                        border: `1px solid rgba(225,6,0,0.22)`,
                                        boxShadow: "0 0 22px rgba(225,6,0,0.15)",
                                    }}
                                >
                                    🔑
                                </div>
                            </div>
                            <h1 className="f-cond font-black tracking-tight leading-none"
                                style={{ fontSize: "clamp(1.9rem,5vw,2.4rem)" }}>
                                <span style={{ color: F1.red }}>{red}</span>
                                <span className="text-white">{white}</span>
                            </h1>
                            <div className="mt-1 mx-auto h-px w-12" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
                            <p className="f-mono text-zinc-500 text-[10px] tracking-[0.35em] uppercase mt-1.5">
                                {step === "email" && "Enter your registered email"}
                                {step === "reset" && "Check your inbox for the code"}
                                {step === "done"  && "Access code updated successfully"}
                            </p>
                        </div>

                        <StepIndicator current={step} />

                        <AnimatePresence>
                            {error && <ErrorBanner msg={error} />}
                        </AnimatePresence>

                        <AnimatePresence mode="wait">
                            {/* Step 1: Email */}
                            {step === "email" && (
                                <motion.form
                                    key="step-email"
                                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                                    transition={{ duration: 0.22 }}
                                    onSubmit={handleSendOtp}
                                    className="space-y-4"
                                >
                                    <div>
                                        {labelEl("Email Address")}
                                        <div className="relative">
                                            <input
                                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                                onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                                                className="w-full f-mono border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg px-4 py-3 text-sm"
                                                style={inputStyle("email")}
                                                placeholder="you@example.com" required autoComplete="email"
                                            />
                                            {focused === "email" && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: F1.red }} />
                                            )}
                                        </div>
                                    </div>
                                    {primaryBtn(loading ? <><Spinner /> Sending...</> : "Send Reset Code →", loading)}
                                </motion.form>
                            )}

                            {/* Step 2: OTP + new password */}
                            {step === "reset" && (
                                <motion.form
                                    key="step-reset"
                                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                                    transition={{ duration: 0.22 }}
                                    onSubmit={handleReset}
                                    className="space-y-4"
                                >
                                    {/* OTP input */}
                                    <div>
                                        {labelEl("Verification Code")}
                                        <input
                                            type="text" value={otp}
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                            onFocus={() => setFocused("otp")} onBlur={() => setFocused(null)}
                                            className="w-full f-mono border focus:outline-none transition-all duration-300 rounded-lg px-4 py-3.5 text-white text-center text-2xl tracking-[0.6em]"
                                            style={{
                                                ...inputStyle("otp"),
                                                letterSpacing: "0.6em",
                                            }}
                                            placeholder="——————" required autoComplete="one-time-code"
                                            inputMode="numeric" maxLength={6} autoFocus
                                        />
                                        <p className="f-mono text-zinc-600 text-[10px] mt-1.5">Sent to {email} · expires in 5 min</p>
                                    </div>

                                    {/* New password */}
                                    <div>
                                        {labelEl("New Access Code")}
                                        <div className="relative">
                                            <input
                                                type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                                onFocus={() => setFocused("newpw")} onBlur={() => setFocused(null)}
                                                className="w-full f-mono border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg px-4 py-3 text-sm"
                                                style={inputStyle("newpw")}
                                                placeholder="••••••••" required autoComplete="new-password"
                                            />
                                            {focused === "newpw" && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: F1.red }} />
                                            )}
                                        </div>
                                        {newPassword && (
                                            <div className="mt-1.5">
                                                <div className="flex gap-1 mb-0.5">
                                                    {[1, 2, 3, 4].map(i => (
                                                        <div
                                                            key={i}
                                                            className="h-0.5 flex-1 rounded-full transition-all duration-300"
                                                            style={{ background: i <= pw ? STRENGTH_COLORS[pw] : "rgba(63,63,70,0.5)" }}
                                                        />
                                                    ))}
                                                </div>
                                                <p className="f-mono text-[10px]" style={{ color: STRENGTH_COLORS[pw] }}>{STRENGTH_LABELS[pw]}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm password */}
                                    <div>
                                        {labelEl("Confirm Access Code")}
                                        <div className="relative">
                                            <input
                                                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                                onFocus={() => setFocused("confirmpw")} onBlur={() => setFocused(null)}
                                                className="w-full f-mono border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg px-4 py-3 text-sm"
                                                style={{
                                                    borderColor: (confirmPassword && confirmPassword !== newPassword)
                                                        ? "#ef4444"
                                                        : (focused === "confirmpw" ? F1.red : F1.hairline),
                                                    boxShadow: focused === "confirmpw" ? `0 0 18px rgba(225,6,0,0.18)` : "none",
                                                    background: "rgba(10,10,12,0.82)",
                                                }}
                                                placeholder="••••••••" required autoComplete="new-password"
                                            />
                                            {focused === "confirmpw" && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: F1.red }} />
                                            )}
                                        </div>
                                        {confirmPassword && (
                                            <p className={`f-mono text-[10px] mt-1 ${newPassword === confirmPassword ? "text-green-400" : "text-red-400"}`}>
                                                {newPassword === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => { setStep("email"); setError(""); setOtp(""); }}
                                            className="flex-1 py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-zinc-400 transition-all duration-200"
                                            style={{ border: `1px solid ${F1.hairline}`, background: "transparent" }}
                                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"}
                                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = F1.hairline}
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-[2] py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 disabled:opacity-50 chamfer-sm"
                                            style={{
                                                background: loading ? "rgba(39,39,42,0.8)" : `linear-gradient(135deg,${F1.red},#dc2626)`,
                                                boxShadow: loading ? "none" : `0 0 24px rgba(225,6,0,0.28)`,
                                            }}
                                        >
                                            {loading
                                                ? <span className="flex items-center justify-center gap-2"><Spinner /> Resetting...</span>
                                                : "Reset Access →"}
                                        </button>
                                    </div>
                                </motion.form>
                            )}

                            {/* Step 3: Done */}
                            {step === "done" && (
                                <motion.div
                                    key="step-done"
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-center space-y-5"
                                >
                                    <div
                                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl"
                                        style={{
                                            background: "rgba(0,230,118,0.10)",
                                            border: `1px solid rgba(0,230,118,0.30)`,
                                            boxShadow: "0 0 24px rgba(0,230,118,0.15)",
                                        }}
                                    >
                                        ✓
                                    </div>
                                    <p className="f-mono text-zinc-300 text-sm">
                                        Your access code has been updated.<br />
                                        <span className="text-zinc-500 text-xs">You can now log in with your new password.</span>
                                    </p>
                                    <button
                                        onClick={() => router.push("/login")}
                                        className="relative w-full py-3.5 rounded-lg f-mono font-bold text-xs tracking-[0.2em] uppercase overflow-hidden transition-all duration-300 text-white chamfer-sm"
                                        style={{
                                            background: `linear-gradient(135deg,${F1.red},#dc2626)`,
                                            boxShadow: `0 0 28px rgba(225,6,0,0.30)`,
                                        }}
                                    >
                                        <span className="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ width: "60%" }} />
                                        <span className="relative">Back to Login →</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Footer */}
                        <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${F1.hairline}` }}>
                            <p className="f-mono text-zinc-600 text-[11px]">
                                Remember it?{" "}
                                <a href="/login" className="text-red-500 hover:text-red-400 transition-colors">Back to login</a>
                            </p>
                        </div>
                    </div>

                    <div className="h-px w-full" style={{ background: F1.hairline }} />
                    <div className="h-0.5 w-1/3 mx-auto" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
                </div>
            </motion.div>
        </div>
    );
}
