"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, sendLoginOtp, verifyLoginOtp } from "../lib/pitwall-auth";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PitwallBackground from "../components/PitwallBackground";
import {
  AuthCard, AuthLogo, AuthInput, PrimaryButton,
  GoogleButton, OTPDigitInput, ErrorBanner,
} from "../components/auth";
import { F1 } from "../lib/f1-theme";

type LoginMode = "password" | "otp";
type OtpStep = "email" | "code";

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

/* ── Mode tab ────────────────────────────────────────────────────────────── */
function ModeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-1 py-2 rounded-md f-mono text-[10px] font-bold tracking-[0.2em] uppercase transition-all duration-200"
      style={{
        color: active ? F1.red : "#71717a",
        background: active ? "rgba(225,6,0,0.10)" : "transparent",
        border: active ? "1px solid rgba(225,6,0,0.25)" : "1px solid transparent",
      }}
    >
      {active && (
        <motion.div
          layoutId="modeIndicator"
          className="absolute inset-0 rounded-md"
          style={{ background: "rgba(225,6,0,0.06)", border: "1px solid rgba(225,6,0,0.20)" }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
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
    if (err === "email_unverified") setError("Google has not verified this email address.");
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

  const handleVerifyOtp = async () => {
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
      <PitwallBackground glow="top-center" streaks={6} intensity={0.85} />

      {/* Floating decorations */}
      <span className="float absolute top-16 right-16 text-5xl opacity-[0.04] select-none pointer-events-none hidden lg:block">🏎️</span>
      <span className="float absolute bottom-20 left-12 text-3xl opacity-[0.04] select-none pointer-events-none hidden lg:block" style={{ animationDelay: "2s" }}>🏁</span>

      {/* Decorative orbit rings */}
      <svg className="absolute left-8 top-1/4 w-32 h-32 opacity-[0.03] pointer-events-none hidden xl:block" viewBox="0 0 128 128" style={{ animation: "spin-slow 12s linear infinite" }}>
        <circle cx="64" cy="64" r="60" fill="none" stroke={F1.red} strokeWidth="0.5" strokeDasharray="4 8" />
      </svg>
      <svg className="absolute right-10 bottom-1/3 w-40 h-40 opacity-[0.03] pointer-events-none hidden xl:block" viewBox="0 0 160 160" style={{ animation: "spin-slow 15s linear infinite reverse" }}>
        <circle cx="80" cy="80" r="76" fill="none" stroke={F1.red} strokeWidth="0.5" strokeDasharray="6 10" />
      </svg>

      <motion.div
        style={{ perspective: 1200 }}
        className="relative z-10 w-full max-w-md"
      >
        <motion.div
          initial={{ rotateY: -8, translateY: 30, opacity: 0 }}
          animate={{ rotateY: 0, translateY: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Glow halo */}
          <div
            className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(225,6,0,0.08),transparent 70%)" }}
          />

          <AuthCard>
            <AuthLogo subtitle="Command Center Access" />

            {/* Error */}
            <AnimatePresence>
              {error && <ErrorBanner msg={error} />}
            </AnimatePresence>

            {/* Google */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GoogleButton />
            </motion.div>

            <OrDivider />

            {/* Mode tabs — sector-themed */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="flex gap-1 mb-5 p-1 rounded-lg"
              style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${F1.hairline}` }}
            >
              <ModeTab active={mode === "password"} onClick={() => switchMode("password")} label="S1 PASSWORD" />
              <ModeTab active={mode === "otp"} onClick={() => switchMode("otp")} label="S2 OTP" />
            </motion.div>

            {/* Forms */}
            <AnimatePresence mode="wait">
              {mode === "password" && (
                <motion.form
                  key="pw-form"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  onSubmit={handlePasswordLogin}
                  className="space-y-4"
                >
                  <AuthInput
                    id="user" label="Callsign" type="text" value={username}
                    onChange={setUsername} placeholder="admin"
                    autoComplete="username" required terminal
                    focused={focused} setFocused={setFocused}
                  />
                  <div>
                    <AuthInput
                      id="pass" label="Access Code" type="password" value={password}
                      onChange={setPassword} placeholder="••••••••"
                      autoComplete="current-password" required terminal
                      focused={focused} setFocused={setFocused}
                    />
                    <div className="flex justify-end mt-1">
                      <a href="/forgot-password" className="f-mono text-zinc-600 hover:text-red-400 text-[10px] transition-colors">
                        Forgot password?
                      </a>
                    </div>
                  </div>
                  <PrimaryButton isLoading={isLoading} disabled={isLoading}>
                    {isLoading ? "Authenticating..." : "Enter Pitwall →"}
                  </PrimaryButton>
                </motion.form>
              )}

              {/* OTP login */}
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
                        <AuthInput
                          id="otp-email" label="Email Address" type="email" value={otpEmail}
                          onChange={setOtpEmail} placeholder="you@example.com"
                          autoComplete="email" required terminal
                          focused={focused} setFocused={setFocused}
                        />
                        <PrimaryButton isLoading={isLoading} disabled={isLoading}>
                          {isLoading ? "Sending..." : "Send OTP →"}
                        </PrimaryButton>
                      </motion.form>
                    ) : (
                      <motion.div
                        key="otp-code"
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                      >
                        <div>
                          <p className="f-mono text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-3 text-center">
                            Enter Verification Code
                          </p>
                          <OTPDigitInput
                            value={otpCode}
                            onChange={setOtpCode}
                            onComplete={handleVerifyOtp}
                            autoFocus
                          />
                          <p className="f-mono text-zinc-600 text-[10px] mt-2 text-center">
                            If {otpEmail} is registered, a code was sent · expires in 5 min
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => { setOtpStep("email"); setOtpCode(""); setError(""); }}
                            className="flex-1 py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-all duration-200"
                            style={{ border: `1px solid ${F1.hairline}`, background: "transparent" }}
                          >
                            ← Back
                          </button>
                          <div className="flex-[2]">
                            <PrimaryButton
                              isLoading={isLoading}
                              disabled={otpCode.length !== 6}
                              onClick={handleVerifyOtp}
                              type="button"
                            >
                              {isLoading ? "Verifying..." : "Verify →"}
                            </PrimaryButton>
                          </div>
                        </div>
                      </motion.div>
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
          </AuthCard>
        </motion.div>
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
