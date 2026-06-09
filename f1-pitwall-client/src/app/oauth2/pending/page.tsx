"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOauth2Otp, sendOauth2Otp } from "../../lib/pitwall-auth";
import { motion, AnimatePresence } from "framer-motion";
import PitwallBackground from "../../components/PitwallBackground";
import { F1 } from "../../lib/f1-theme";

const OTP_EXPIRY_SECONDS = 300;

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

/* ── Timer ring ──────────────────────────────────────────────────────────── */
function TimerRing({ timeLeft }: { timeLeft: number }) {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const seconds = String(timeLeft % 60).padStart(2, "0");
    const urgent = timeLeft > 0 && timeLeft <= 60;
    const expired = timeLeft === 0;

    // SVG ring progress
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const progress = timeLeft / OTP_EXPIRY_SECONDS;
    const dashOffset = circumference * (1 - progress);

    return (
        <div className="flex flex-col items-center gap-1 mb-6">
            <div className="relative w-16 h-16 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 64 64" className="absolute">
                    {/* Track */}
                    <circle cx="32" cy="32" r={radius} fill="none" stroke={F1.hairline} strokeWidth="2.5" />
                    {/* Progress */}
                    {!expired && (
                        <circle
                            cx="32" cy="32" r={radius}
                            fill="none"
                            stroke={urgent ? "#ef4444" : F1.red}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            transform="rotate(-90 32 32)"
                            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                        />
                    )}
                </svg>
                <span
                    className="f-mono font-bold text-xs tabular-nums"
                    style={{ color: expired ? "#ef4444" : urgent ? "#f97316" : "#a1a1aa" }}
                >
                    {expired ? "EXP" : `${minutes}:${seconds}`}
                </span>
            </div>
            <span
                className="f-mono text-[9px] uppercase tracking-widest"
                style={{ color: expired ? "#ef4444" : urgent ? "#f97316" : "#52525b" }}
            >
                {expired ? "Code Expired" : urgent ? "Expiring Soon" : "Time Remaining"}
            </span>
        </div>
    );
}

/* ── Main handler ────────────────────────────────────────────────────────── */
function PendingHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email") || "";

    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS);
    const [focused, setFocused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!email) { router.replace("/login?error=no_email"); return; }
        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) { clearInterval(timerRef.current!); return 0; }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current!);
    }, [email, router]);

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (otp.length !== 6) { setError("Enter the 6-digit code"); return; }
        setLoading(true);
        try {
            const data = await verifyOauth2Otp(email, otp.trim());
            if (typeof window !== "undefined") {
                sessionStorage.setItem("pitwall_username", data.username);
                sessionStorage.setItem("pitwall_role", data.role);
            }
            setTimeout(() => { window.location.href = "/"; }, 200);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        setError("");
        setResending(true);
        try {
            await sendOauth2Otp(email);
            setTimeLeft(OTP_EXPIRY_SECONDS);
            setOtp("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to resend OTP");
        } finally {
            setResending(false);
        }
    }

    const resendAvailableAt = 240; // allow resend after 60 s elapsed

    return (
        <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md"
        >
            <div
                className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(225,6,0,0.08),transparent 70%)" }}
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
                                className="absolute" width="72" height="72" viewBox="0 0 72 72"
                                style={{ animation: "spin-slow 9s linear infinite" }}
                            >
                                <circle cx="36" cy="36" r="33" fill="none" stroke={F1.red} strokeWidth="1" strokeDasharray="8 6" opacity="0.35" />
                            </svg>
                            <svg
                                className="absolute" width="56" height="56" viewBox="0 0 56 56"
                                style={{ animation: "spin-slow 5s linear infinite reverse" }}
                            >
                                <circle cx="28" cy="28" r="24" fill="none" stroke={F1.red} strokeWidth="0.8" strokeDasharray="4 10" opacity="0.2" />
                            </svg>
                            <div
                                className="relative w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                                style={{
                                    background: "rgba(225,6,0,0.10)",
                                    border: `1px solid rgba(225,6,0,0.22)`,
                                    boxShadow: "0 0 24px rgba(225,6,0,0.18)",
                                }}
                            >
                                🔐
                            </div>
                        </div>

                        <h1 className="f-cond font-black tracking-tight leading-none"
                            style={{ fontSize: "clamp(2rem,5.5vw,2.6rem)" }}>
                            <span style={{ color: F1.red }}>2FA</span>
                            <span className="text-white"> VERIFY</span>
                        </h1>
                        <div className="mt-1 mx-auto h-px w-12" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
                        <p className="f-mono text-zinc-500 text-[10px] tracking-[0.35em] uppercase mt-1.5">
                            Google Login Verification
                        </p>
                    </div>

                    {/* Email badge */}
                    <div
                        className="mb-5 p-3 rounded-lg f-mono text-xs text-center"
                        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${F1.hairline}` }}
                    >
                        Code sent to{" "}
                        <span className="font-bold" style={{ color: F1.red }}>{email}</span>
                    </div>

                    {/* Timer */}
                    <TimerRing timeLeft={timeLeft} />

                    <AnimatePresence>
                        {error && <ErrorBanner msg={error} />}
                    </AnimatePresence>

                    {/* OTP form */}
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div>
                            <label className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-1.5">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                className="w-full f-mono border focus:outline-none transition-all duration-300 rounded-lg px-4 py-4 text-white text-center text-3xl"
                                style={{
                                    borderColor: focused ? F1.red : F1.hairline,
                                    boxShadow: focused ? `0 0 22px rgba(225,6,0,0.20)` : "none",
                                    background: "rgba(10,10,12,0.82)",
                                    letterSpacing: "0.6em",
                                }}
                                placeholder="——————"
                                required
                                autoComplete="one-time-code"
                                inputMode="numeric"
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || timeLeft === 0}
                            className="relative w-full py-3.5 rounded-lg f-mono font-bold text-xs tracking-[0.2em] uppercase overflow-hidden transition-all duration-300 disabled:opacity-50 text-white chamfer-sm"
                            style={{
                                background: (loading || timeLeft === 0)
                                    ? "rgba(39,39,42,0.8)"
                                    : `linear-gradient(135deg,${F1.red},#dc2626)`,
                                boxShadow: (loading || timeLeft === 0)
                                    ? "none"
                                    : `0 0 28px rgba(225,6,0,0.30)`,
                            }}
                        >
                            {!(loading || timeLeft === 0) && (
                                <span className="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ width: "60%" }} />
                            )}
                            <span className="relative flex items-center justify-center gap-2">
                                {loading
                                    ? <><Spinner /> Verifying...</>
                                    : timeLeft === 0
                                        ? "Code Expired"
                                        : "Verify & Enter Pitwall →"}
                            </span>
                        </button>
                    </form>

                    {/* Resend */}
                    <div className="mt-5 text-center">
                        <button
                            onClick={handleResend}
                            disabled={resending || timeLeft > resendAvailableAt}
                            className="f-mono text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: (resending || timeLeft > resendAvailableAt) ? "#52525b" : "#a1a1aa" }}
                            onMouseEnter={e => { if (!(resending || timeLeft > resendAvailableAt)) (e.currentTarget as HTMLButtonElement).style.color = "#e4e4e7"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = (resending || timeLeft > resendAvailableAt) ? "#52525b" : "#a1a1aa"; }}
                        >
                            {resending
                                ? "Sending..."
                                : timeLeft > resendAvailableAt
                                    ? `Resend available in ${timeLeft - resendAvailableAt}s`
                                    : "Resend code"}
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-4 text-center" style={{ borderTop: `1px solid ${F1.hairline}` }}>
                        <a href="/login" className="f-mono text-zinc-600 hover:text-zinc-400 text-[11px] transition-colors">
                            ← Cancel and return to login
                        </a>
                    </div>
                </div>

                <div className="h-px w-full" style={{ background: F1.hairline }} />
                <div className="h-0.5 w-1/3 mx-auto" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
            </div>
        </motion.div>
    );
}

export default function OAuth2PendingPage() {
    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
            style={{ background: F1.bg }}
        >
            <PitwallBackground glow="top-center" streaks={4} />

            <Suspense fallback={
                <div className="relative z-10 text-center">
                    <div
                        className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                        style={{ borderColor: F1.red, borderTopColor: "transparent" }}
                    />
                    <p className="f-mono text-zinc-500 text-xs">Loading...</p>
                </div>
            }>
                <PendingHandler />
            </Suspense>
        </div>
    );
}
