"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOauth2Otp, sendOauth2Otp } from "../../lib/pitwall-auth";

const OTP_EXPIRY_SECONDS = 300;

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

    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const seconds = String(timeLeft % 60).padStart(2, "0");

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

    return (
        <div className="w-full max-w-md">
            <style>{`
                @keyframes fadeUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes glow { 0%,100%{opacity:.3} 50%{opacity:.8} }
                @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                .fade-up { animation: fadeUp .5s ease-out both; }
                .glow-pulse { animation: glow 3s ease-in-out infinite; }
            `}</style>

            <div className="absolute inset-0">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)",
                    backgroundSize: "40px 40px",
                }} />
                <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-red-500/8 rounded-full blur-[100px] glow-pulse" />
            </div>

            <div className="relative">
                <div className="absolute inset-0 rounded-3xl bg-red-500/5 blur-xl" />
                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                    <div className="p-8">
                        {/* Icon */}
                        <div className="text-center mb-8 fade-up">
                            <div className="relative inline-block mb-4">
                                <div className="absolute inset-0 rounded-full border border-red-500/20" style={{ animation: "spin-slow 8s linear infinite" }} />
                                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                                    <span className="text-2xl">🔐</span>
                                </div>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-white">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">2FA</span> VERIFY
                            </h1>
                            <p className="text-zinc-500 text-xs tracking-[0.3em] uppercase mt-2 font-mono">Google Login Verification</p>
                        </div>

                        {/* Email display */}
                        <div className="mb-5 p-3 bg-zinc-800/50 border border-zinc-700/30 rounded-xl fade-up" style={{ animationDelay: "50ms" }}>
                            <p className="text-zinc-400 text-xs font-mono text-center">
                                Code sent to <span className="text-red-400">{email}</span>
                            </p>
                        </div>

                        {/* Timer */}
                        <div className="flex justify-center mb-5 fade-up" style={{ animationDelay: "80ms" }}>
                            <div className={`px-4 py-1.5 rounded-full border font-mono text-sm font-bold ${timeLeft > 60 ? "border-zinc-700 text-zinc-400" : "border-red-500/50 text-red-400"}`}>
                                {timeLeft > 0 ? `${minutes}:${seconds}` : "EXPIRED"}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center fade-up flex items-center gap-2 justify-center">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleVerify} className="space-y-5 fade-up" style={{ animationDelay: "120ms" }}>
                            <div>
                                <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Verification Code</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                                    className="w-full bg-zinc-950/80 border rounded-xl px-4 py-4 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono text-center text-3xl tracking-[0.6em]"
                                    style={{
                                        borderColor: focused ? "#ef4444" : "rgba(63,63,70,0.5)",
                                        boxShadow: focused ? "0 0 20px rgba(239,68,68,0.15)" : "none",
                                    }}
                                    placeholder="——————"
                                    required
                                    autoComplete="one-time-code"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>
                            <button type="submit" disabled={loading || timeLeft === 0}
                                className="w-full py-4 rounded-xl font-black tracking-widest text-sm text-white transition-all duration-300 disabled:opacity-50"
                                style={{ background: (loading || timeLeft === 0) ? "rgba(39,39,42,0.8)" : "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: (loading || timeLeft === 0) ? "none" : "0 0 30px rgba(239,68,68,0.3)" }}>
                                {loading
                                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />VERIFYING...</span>
                                    : "VERIFY & ENTER PITWALL →"}
                            </button>
                        </form>

                        <div className="mt-5 text-center fade-up" style={{ animationDelay: "180ms" }}>
                            <button
                                onClick={handleResend}
                                disabled={resending || timeLeft > 240}
                                className="text-zinc-500 hover:text-zinc-300 text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                {resending ? "Sending..." : timeLeft > 240 ? `Resend available in ${timeLeft - 240}s` : "Resend code"}
                            </button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-zinc-800/50 text-center fade-up">
                            <a href="/login" className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors">
                                ← Cancel and go back to login
                            </a>
                        </div>
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                </div>
            </div>
        </div>
    );
}

export default function OAuth2PendingPage() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden">
            <Suspense fallback={
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-500 font-mono text-sm">Loading...</p>
                </div>
            }>
                <PendingHandler />
            </Suspense>
        </div>
    );
}
