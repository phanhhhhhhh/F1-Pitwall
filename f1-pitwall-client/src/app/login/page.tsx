"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, sendLoginOtp, verifyLoginOtp } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PitwallBackground from "../components/PitwallBackground";
import { F1 } from "../lib/f1-theme";

type LoginMode = "password" | "otp";
type OtpStep = "email" | "code";

/* ── shared micro-components ─────────────────────────────────────────────── */

function RedLine() {
    return (
        <div
            className="h-px w-full"
            style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }}
        />
    );
}

function InputField({
    id, label, type, value, onChange, placeholder, autoComplete, required, inputMode, maxLength, autoFocus,
    extra, focusedId, setFocused,
}: {
    id: string; label: string; type: string; value: string;
    onChange: (v: string) => void; placeholder: string; autoComplete?: string;
    required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    maxLength?: number; autoFocus?: boolean; extra?: React.ReactNode;
    focusedId: string | null; setFocused: (v: string | null) => void;
}) {
    const active = focusedId === id;
    return (
        <div>
            <label className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-1.5">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onFocus={() => setFocused(id)}
                    onBlur={() => setFocused(null)}
                    placeholder={placeholder}
                    required={required}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    autoFocus={autoFocus}
                    className="w-full f-mono bg-zinc-950/80 border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg px-4 py-3 text-sm"
                    style={{
                        borderColor: active ? F1.red : F1.hairline,
                        boxShadow: active ? `0 0 18px rgba(225,6,0,0.18)` : "none",
                        background: "rgba(10,10,12,0.82)",
                    }}
                />
                {active && (
                    <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: F1.red }}
                    />
                )}
            </div>
            {extra}
        </div>
    );
}

function PrimaryButton({ children, disabled, isLoading }: {
    children: React.ReactNode; disabled?: boolean; isLoading?: boolean;
}) {
    return (
        <button
            type="submit"
            disabled={disabled}
            className="relative w-full py-3.5 rounded-lg f-mono font-bold text-xs tracking-[0.2em] uppercase overflow-hidden transition-all duration-300 disabled:opacity-50 text-white chamfer-sm"
            style={{
                background: (disabled || isLoading)
                    ? "rgba(39,39,42,0.8)"
                    : `linear-gradient(135deg,${F1.red},#dc2626)`,
                boxShadow: (disabled || isLoading)
                    ? "none"
                    : `0 0 28px rgba(225,6,0,0.32)`,
            }}
        >
            {!isLoading && (
                <span
                    className="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    style={{ width: "60%" }}
                />
            )}
            <span className="relative flex items-center justify-center gap-2">{children}</span>
        </button>
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

/* ── Logo lockup ─────────────────────────────────────────────────────────── */
function PitwallLogo({ sub }: { sub: string }) {
    return (
        <div className="text-center mb-8">
            {/* Spinning ring mark */}
            <div className="relative inline-flex items-center justify-center mb-5">
                {/* outer ring */}
                <svg
                    className="absolute"
                    width="72" height="72" viewBox="0 0 72 72"
                    style={{ animation: "spin-slow 9s linear infinite" }}
                >
                    <circle cx="36" cy="36" r="33" fill="none" stroke={F1.red} strokeWidth="1" strokeDasharray="8 6" opacity="0.4" />
                </svg>
                {/* inner glow ring */}
                <svg
                    className="absolute"
                    width="56" height="56" viewBox="0 0 56 56"
                    style={{ animation: "spin-slow 5s linear infinite reverse" }}
                >
                    <circle cx="28" cy="28" r="24" fill="none" stroke={F1.red} strokeWidth="0.8" strokeDasharray="4 10" opacity="0.25" />
                </svg>
                {/* centre badge */}
                <div
                    className="relative w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                    style={{
                        background: "rgba(225,6,0,0.10)",
                        border: `1px solid rgba(225,6,0,0.22)`,
                        boxShadow: "0 0 24px rgba(225,6,0,0.18)",
                    }}
                >
                    🏎️
                </div>
            </div>

            {/* Wordmark */}
            <h1 className="f-cond font-black tracking-tight leading-none"
                style={{ fontSize: "clamp(2.2rem,6vw,2.8rem)" }}>
                <span style={{ color: F1.red }}>PIT</span>
                <span className="text-white">WALL</span>
            </h1>
            <div
                className="mt-1 mx-auto h-px w-16"
                style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }}
            />
            <p className="f-mono text-zinc-500 text-[10px] tracking-[0.4em] uppercase mt-2">{sub}</p>
        </div>
    );
}

/* ── Google button ───────────────────────────────────────────────────────── */
function GoogleButton() {
    return (
        <a
            href={`${API}/oauth2/authorize/google`}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-lg border transition-all duration-200 f-mono text-xs font-bold uppercase tracking-wider text-white group"
            style={{
                border: `1px solid ${F1.hairline}`,
                background: "rgba(255,255,255,0.03)",
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.15)";
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = F1.hairline;
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.03)";
            }}
        >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z" />
            </svg>
            Continue with Google
        </a>
    );
}

/* ── Divider ─────────────────────────────────────────────────────────────── */
function OrDivider() {
    return (
        <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: F1.hairline }} />
            <span className="f-mono text-zinc-600 text-[10px] tracking-widest uppercase">or</span>
            <div className="flex-1 h-px" style={{ background: F1.hairline }} />
        </div>
    );
}

/* ── Main form ───────────────────────────────────────────────────────────── */
function LoginForm() {
    const [mode, setMode] = useState<LoginMode>("password");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [otpEmail, setOtpEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [otpStep, setOtpStep] = useState<OtpStep>("email");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [focused, setFocused] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const err = searchParams.get("error");
        if (err === "oauth_failed") setError("Google login failed. Please try again.");
        if (err === "otp_failed") setError("Failed to send 2FA code. Please try again.");
        if (err === "no_email") setError("Google account has no email.");
    }, [searchParams]);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!username.trim()) { setError("Callsign is required"); return; }
        if (!password) { setError("Access code is required"); return; }
        setIsLoading(true);
        try {
            await login(username, password);
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Authentication failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!otpEmail.trim()) { setError("Email is required"); return; }
        setIsLoading(true);
        try {
            await sendLoginOtp(otpEmail.trim());
            setOtpStep("code");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (otpCode.length !== 6) { setError("Enter the 6-digit code"); return; }
        setIsLoading(true);
        try {
            await verifyLoginOtp(otpEmail.trim(), otpCode.trim());
            router.push("/");
        } catch (err) {
            setError(err instanceof Error ? err.message : "OTP verification failed");
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (m: LoginMode) => { setMode(m); setError(""); setOtpStep("email"); setOtpCode(""); };

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
            style={{ background: F1.bg }}
        >
            <PitwallBackground glow="top-center" streaks={5} />

            {/* Floating F1 decorations */}
            <span className="float absolute top-16 right-16 text-5xl opacity-[0.04] select-none pointer-events-none hidden lg:block">🏎️</span>
            <span className="float absolute bottom-20 left-12 text-3xl opacity-[0.04] select-none pointer-events-none hidden lg:block" style={{ animationDelay: "2s" }}>🏁</span>

            <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-full max-w-md"
            >
                {/* Glow halo */}
                <div
                    className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(225,6,0,0.08),transparent 70%)" }}
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
                        <PitwallLogo sub="Command Center Access" />

                        {/* Error */}
                        <AnimatePresence>
                            {error && <ErrorBanner msg={error} />}
                        </AnimatePresence>

                        {/* Google */}
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <GoogleButton />
                        </motion.div>

                        <OrDivider />

                        {/* Mode tabs */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className="flex gap-1 mb-5 p-1 rounded-lg"
                            style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${F1.hairline}` }}
                        >
                            {(["password", "otp"] as LoginMode[]).map(m => (
                                <button
                                    key={m}
                                    onClick={() => switchMode(m)}
                                    type="button"
                                    className="relative flex-1 py-2 rounded-md f-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-200"
                                    style={{
                                        color: mode === m ? F1.red : "#71717a",
                                        background: mode === m ? "rgba(225,6,0,0.10)" : "transparent",
                                        border: mode === m ? `1px solid rgba(225,6,0,0.25)` : "1px solid transparent",
                                    }}
                                >
                                    {m === "password" ? "Password" : "OTP Login"}
                                </button>
                            ))}
                        </motion.div>

                        {/* Password form */}
                        <AnimatePresence mode="wait">
                            {mode === "password" && (
                                <motion.form
                                    key="pw-form"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.22 }}
                                    onSubmit={handlePasswordLogin}
                                    className="space-y-4"
                                >
                                    <InputField
                                        id="user" label="Callsign" type="text" value={username}
                                        onChange={setUsername} placeholder="admin"
                                        autoComplete="username" required
                                        focusedId={focused} setFocused={setFocused}
                                    />
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="f-mono text-zinc-500 text-[10px] uppercase tracking-[0.25em]">Access Code</label>
                                            <a href="/forgot-password" className="f-mono text-zinc-600 hover:text-red-500 text-[10px] transition-colors">
                                                Forgot password?
                                            </a>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="password" value={password} onChange={e => setPassword(e.target.value)}
                                                onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)}
                                                placeholder="••••••••" required autoComplete="current-password"
                                                className="w-full f-mono bg-zinc-950/80 border text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 rounded-lg px-4 py-3 text-sm"
                                                style={{
                                                    borderColor: focused === "pass" ? F1.red : F1.hairline,
                                                    boxShadow: focused === "pass" ? `0 0 18px rgba(225,6,0,0.18)` : "none",
                                                    background: "rgba(10,10,12,0.82)",
                                                }}
                                            />
                                            {focused === "pass" && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: F1.red }} />
                                            )}
                                        </div>
                                    </div>
                                    <PrimaryButton isLoading={isLoading} disabled={isLoading}>
                                        {isLoading ? <><Spinner /> Authenticating...</> : <>Enter Pitwall →</>}
                                    </PrimaryButton>
                                </motion.form>
                            )}

                            {/* OTP login form */}
                            {mode === "otp" && (
                                <motion.div
                                    key="otp-form"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.22 }}
                                    className="space-y-4"
                                >
                                    <AnimatePresence mode="wait">
                                        {otpStep === "email" ? (
                                            <motion.form
                                                key="otp-email"
                                                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                                                transition={{ duration: 0.2 }}
                                                onSubmit={handleSendOtp}
                                                className="space-y-4"
                                            >
                                                <InputField
                                                    id="otp-email" label="Email Address" type="email" value={otpEmail}
                                                    onChange={setOtpEmail} placeholder="you@example.com"
                                                    autoComplete="email" required
                                                    focusedId={focused} setFocused={setFocused}
                                                />
                                                <PrimaryButton isLoading={isLoading} disabled={isLoading}>
                                                    {isLoading ? <><Spinner /> Sending...</> : <>Send OTP →</>}
                                                </PrimaryButton>
                                            </motion.form>
                                        ) : (
                                            <motion.form
                                                key="otp-code"
                                                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                                                transition={{ duration: 0.2 }}
                                                onSubmit={handleVerifyOtp}
                                                className="space-y-4"
                                            >
                                                <div>
                                                    <label className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-1.5">Verification Code</label>
                                                    <input
                                                        type="text" value={otpCode}
                                                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                        onFocus={() => setFocused("otp-code")} onBlur={() => setFocused(null)}
                                                        className="w-full f-mono border focus:outline-none transition-all duration-300 rounded-lg px-4 py-3.5 text-white text-center text-2xl tracking-[0.6em]"
                                                        style={{
                                                            borderColor: focused === "otp-code" ? F1.red : F1.hairline,
                                                            boxShadow: focused === "otp-code" ? `0 0 18px rgba(225,6,0,0.18)` : "none",
                                                            background: "rgba(10,10,12,0.82)",
                                                        }}
                                                        placeholder="——————" required autoComplete="one-time-code"
                                                        inputMode="numeric" maxLength={6} autoFocus
                                                    />
                                                    <p className="f-mono text-zinc-600 text-[10px] mt-1.5">Sent to {otpEmail} · expires in 5 min</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setOtpStep("email"); setOtpCode(""); setError(""); }}
                                                        className="flex-1 py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-zinc-400 transition-all duration-200"
                                                        style={{ border: `1px solid ${F1.hairline}`, background: "transparent" }}
                                                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"}
                                                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = F1.hairline}
                                                    >
                                                        ← Back
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={isLoading}
                                                        className="flex-[2] py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 disabled:opacity-50 chamfer-sm"
                                                        style={{
                                                            background: isLoading ? "rgba(39,39,42,0.8)" : `linear-gradient(135deg,${F1.red},#dc2626)`,
                                                            boxShadow: isLoading ? "none" : `0 0 24px rgba(225,6,0,0.28)`,
                                                        }}
                                                    >
                                                        {isLoading ? <span className="flex items-center justify-center gap-2"><Spinner /> Verifying...</span> : "Enter Pitwall →"}
                                                    </button>
                                                </div>
                                            </motion.form>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Footer */}
                        <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${F1.hairline}` }}>
                            <p className="f-mono text-zinc-600 text-[11px]">
                                Need an account?{" "}
                                <a href="/register" className="text-red-500 hover:text-red-400 transition-colors font-bold">Sign up</a>
                            </p>
                        </div>
                    </div>

                    {/* Bottom hairline */}
                    <div className="h-px w-full" style={{ background: F1.hairline }} />

                    {/* Red accent bottom edge */}
                    <div className="h-0.5 w-1/3 mx-auto" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
                </div>

                {/* Test credentials */}
                <div className="mt-3 text-center">
                    <p className="f-mono text-zinc-700 text-[10px]">Test: admin / pitwall2024</p>
                </div>
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: F1.bg }}>
                <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: F1.red, borderTopColor: "transparent" }} />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
