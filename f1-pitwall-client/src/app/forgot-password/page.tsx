"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendForgotPasswordOtp, resetPassword } from "../lib/pitwall-auth";

type Step = "email" | "reset" | "done";

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

    const strength = (p: string) => {
        if (!p) return 0;
        let s = 0;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    };
    const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
    const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
    const pw = strength(newPassword);

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
        borderColor: focused === field ? "#ef4444" : "rgba(63,63,70,0.5)",
        boxShadow: focused === field ? "0 0 20px rgba(239,68,68,0.15)" : "none",
    });

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden">
            <style>{`
                @keyframes fadeUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes glow { 0%,100%{opacity:.3} 50%{opacity:.8} }
                .fade-up { animation: fadeUp .5s ease-out both; }
                .glow-pulse { animation: glow 3s ease-in-out infinite; }
            `}</style>
            <div className="absolute inset-0">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)",
                    backgroundSize: "40px 40px",
                }} />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/8 rounded-full blur-[120px] glow-pulse" />
            </div>

            <div className="relative w-full max-w-md">
                <div className="absolute inset-0 rounded-3xl bg-red-500/5 blur-xl" />
                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                    <div className="p-8">
                        {/* Header */}
                        <div className="text-center mb-8 fade-up">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">🔑</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-white">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">RESET</span> ACCESS
                            </h1>
                            <p className="text-zinc-500 text-xs tracking-[0.3em] uppercase mt-2 font-mono">
                                {step === "email" && "Enter your registered email"}
                                {step === "reset" && "Check your inbox for the code"}
                                {step === "done" && "Access code updated"}
                            </p>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-2 mb-6 fade-up" style={{ animationDelay: "50ms" }}>
                            {(["email", "reset", "done"] as Step[]).map((s, i) => (
                                <div key={s} className="flex items-center gap-2 flex-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === s ? "bg-red-500 text-white" : (["email","reset","done"].indexOf(step) > i ? "bg-red-500/30 text-red-400" : "bg-zinc-800 text-zinc-600")}`}>
                                        {["email","reset","done"].indexOf(step) > i ? "✓" : i + 1}
                                    </div>
                                    {i < 2 && <div className={`flex-1 h-px ${["email","reset","done"].indexOf(step) > i ? "bg-red-500/50" : "bg-zinc-800"}`} />}
                                </div>
                            ))}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center fade-up flex items-center gap-2 justify-center">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        {/* Step 1: Email */}
                        {step === "email" && (
                            <form onSubmit={handleSendOtp} className="space-y-5 fade-up" style={{ animationDelay: "100ms" }}>
                                <div>
                                    <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Email Address</label>
                                    <input
                                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                                        onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                                        className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono"
                                        style={inputStyle("email")}
                                        placeholder="you@example.com" required autoComplete="email" />
                                </div>
                                <button type="submit" disabled={loading}
                                    className="w-full py-4 rounded-xl font-black tracking-widest text-sm text-white transition-all duration-300 disabled:opacity-50"
                                    style={{ background: loading ? "rgba(39,39,42,0.8)" : "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: loading ? "none" : "0 0 30px rgba(239,68,68,0.3)" }}>
                                    {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />SENDING...</span> : "SEND RESET CODE →"}
                                </button>
                            </form>
                        )}

                        {/* Step 2: OTP + new password */}
                        {step === "reset" && (
                            <form onSubmit={handleReset} className="space-y-5 fade-up" style={{ animationDelay: "100ms" }}>
                                <div>
                                    <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Verification Code</label>
                                    <input
                                        type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        onFocus={() => setFocused("otp")} onBlur={() => setFocused(null)}
                                        className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono text-center text-2xl tracking-[0.5em]"
                                        style={inputStyle("otp")}
                                        placeholder="——————" required autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
                                    <p className="text-zinc-600 text-xs font-mono mt-1.5">Sent to {email} · expires in 5 min</p>
                                </div>
                                <div>
                                    <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">New Access Code</label>
                                    <input
                                        type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                        onFocus={() => setFocused("newpw")} onBlur={() => setFocused(null)}
                                        className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono"
                                        style={inputStyle("newpw")}
                                        placeholder="••••••••" required autoComplete="new-password" />
                                    {newPassword && (
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <div className="flex gap-1 flex-1">
                                                {[1,2,3,4].map(i => (
                                                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                                                        style={{ background: i <= pw ? strengthColor[pw] : "rgba(63,63,70,0.5)" }} />
                                                ))}
                                            </div>
                                            <span className="text-xs font-mono" style={{ color: strengthColor[pw] }}>{strengthLabel[pw]}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Confirm Access Code</label>
                                    <input
                                        type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                        onFocus={() => setFocused("confirmpw")} onBlur={() => setFocused(null)}
                                        className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono"
                                        style={{ ...inputStyle("confirmpw"), borderColor: confirmPassword && confirmPassword !== newPassword ? "#ef4444" : focused === "confirmpw" ? "#ef4444" : "rgba(63,63,70,0.5)" }}
                                        placeholder="••••••••" required autoComplete="new-password" />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => { setStep("email"); setError(""); setOtp(""); }}
                                        className="flex-1 py-3.5 rounded-xl font-bold text-sm text-zinc-400 border border-zinc-700/50 hover:border-zinc-500 transition-all">
                                        ← BACK
                                    </button>
                                    <button type="submit" disabled={loading}
                                        className="flex-[2] py-3.5 rounded-xl font-black tracking-widest text-sm text-white transition-all duration-300 disabled:opacity-50"
                                        style={{ background: loading ? "rgba(39,39,42,0.8)" : "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: loading ? "none" : "0 0 30px rgba(239,68,68,0.3)" }}>
                                        {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />RESETTING...</span> : "RESET ACCESS →"}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Step 3: Done */}
                        {step === "done" && (
                            <div className="text-center space-y-5 fade-up">
                                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                                    <span className="text-3xl">✓</span>
                                </div>
                                <p className="text-zinc-300 font-mono text-sm">Your access code has been updated.<br />You can now log in with your new password.</p>
                                <button onClick={() => router.push("/login")}
                                    className="w-full py-4 rounded-xl font-black tracking-widest text-sm text-white transition-all duration-300"
                                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 0 30px rgba(239,68,68,0.3)" }}>
                                    BACK TO LOGIN →
                                </button>
                            </div>
                        )}

                        <div className="mt-6 pt-5 border-t border-zinc-800/50 text-center fade-up">
                            <p className="text-zinc-600 text-xs font-mono">
                                Remember it?{" "}
                                <a href="/login" className="text-red-500 hover:text-red-400 transition-colors">Back to login</a>
                            </p>
                        </div>
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                </div>
            </div>
        </div>
    );
}
