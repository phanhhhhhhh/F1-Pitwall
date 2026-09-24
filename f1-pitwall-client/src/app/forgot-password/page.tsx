"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendForgotPasswordOtp, resetPassword } from "../lib/pitwall-auth";
import { m, AnimatePresence } from "framer-motion";
import PitwallBackground from "../components/PitwallBackground";
import {
  AuthCard, AuthLogo, AuthInput, PrimaryButton,
  OTPDigitInput, StrengthMeter, SectorSteps, ErrorBanner,
} from "../components/auth";
import { F1 } from "../lib/f1-theme";

type Step = "email" | "reset" | "done";

const STEPS = ["EMAIL", "VERIFY", "DONE"];
const SUBTITLES: Record<Step, string> = {
  email: "Enter your registered email",
  reset: "Check your inbox for the code",
  done: "Access code updated successfully",
};
const HEADINGS: Record<Step, [string, string]> = {
  email: ["RESET", " ACCESS"],
  reset: ["ENTER", " CODE"],
  done: ["ACCESS", " UPDATED"],
};
const ICONS: Record<Step, React.ReactNode> = {
  email: "🔐",
  reset: "🔑",
  done: "✓",
};

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

  const [red, white] = HEADINGS[step];

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
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: F1.bg }}
    >
      <PitwallBackground glow="top-center" streaks={4} intensity={0.85} />

      <m.div
        style={{ perspective: 1200 }}
        className="relative z-10 w-full max-w-md"
      >
        <m.div
          initial={{ rotateY: -8, translateY: 30, opacity: 0 }}
          animate={{ rotateY: 0, translateY: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 40%,rgba(225,6,0,0.07),transparent 70%)" }}
          />

          <AuthCard>
            {/* Dynamic header */}
            <div className="text-center mb-6">
              <AuthLogo
                icon={
                  <m.span
                    key={step}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    {ICONS[step]}
                  </m.span>
                }
                subtitle={SUBTITLES[step]}
                size="sm"
              />
              <h1
                className="f-cond font-black tracking-tight leading-none mt-2"
                style={{ fontSize: "clamp(1.9rem,5vw,2.4rem)" }}
              >
                <span style={{ color: F1.red }}>{red}</span>
                <span className="text-white">{white}</span>
              </h1>
            </div>

            <SectorSteps steps={STEPS} currentIndex={STEPS.indexOf(step === "done" ? "reset" : step)} />

            <AnimatePresence>
              {error && <ErrorBanner msg={error} />}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {/* Step 1: Email */}
              {step === "email" && (
                <m.form
                  key="step-email"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.22 }}
                  onSubmit={handleSendOtp}
                  className="space-y-4"
                >
                  <AuthInput
                    id="email" label="Email Address" type="email" value={email}
                    onChange={setEmail} placeholder="you@example.com"
                    autoComplete="email" required terminal
                    focused={focused} setFocused={setFocused}
                  />
                  <PrimaryButton isLoading={loading} disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Code →"}
                  </PrimaryButton>
                </m.form>
              )}

              {/* Step 2: OTP + new password */}
              {step === "reset" && (
                <m.form
                  key="step-reset"
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22 }}
                  onSubmit={handleReset}
                  className="space-y-4"
                >
                  {/* OTP */}
                  <div>
                    <label className="f-mono block text-zinc-500 text-[10px] uppercase tracking-[0.25em] mb-2">
                      Verification Code
                    </label>
                    <OTPDigitInput value={otp} onChange={setOtp} autoFocus />
                    <p className="f-mono text-zinc-600 text-[10px] mt-1.5">
                      Sent to {email} · expires in 5 min
                    </p>
                  </div>

                  {/* New password */}
                  <AuthInput
                    id="newpw" label="New Access Code" type="password" value={newPassword}
                    onChange={setNewPassword} placeholder="••••••••"
                    autoComplete="new-password" required terminal
                    focused={focused} setFocused={setFocused}
                    extra={<StrengthMeter password={newPassword} />}
                  />

                  {/* Confirm password */}
                  <AuthInput
                    id="confirmpw" label="Confirm Access Code" type="password" value={confirmPassword}
                    onChange={setConfirmPassword} placeholder="••••••••"
                    autoComplete="new-password" required terminal
                    focused={focused} setFocused={setFocused}
                    extra={
                      confirmPassword.length > 0 ? (
                        <p className={`f-mono text-[10px] mt-1 ${newPassword === confirmPassword ? "text-green-400" : "text-red-400"}`}>
                          {newPassword === confirmPassword ? "✓ MATCH" : "✗ MISMATCH"}
                        </p>
                      ) : undefined
                    }
                  />

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => { setStep("email"); setError(""); setOtp(""); }}
                      className="flex-1 py-3 rounded-lg f-mono text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-all duration-200"
                      style={{ border: `1px solid ${F1.hairline}`, background: "transparent" }}
                    >
                      ← Back
                    </button>
                    <div className="flex-[2]">
                      <PrimaryButton isLoading={loading} disabled={loading}>
                        {loading ? "Resetting..." : "Reset Access →"}
                      </PrimaryButton>
                    </div>
                  </div>
                </m.form>
              )}

              {/* Step 3: Done */}
              {step === "done" && (
                <m.div
                  key="step-done"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center space-y-5"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                    style={{
                      background: "rgba(0,230,118,0.10)",
                      border: "1px solid rgba(0,230,118,0.30)",
                      boxShadow: "0 0 24px rgba(0,230,118,0.15)",
                    }}
                  >
                    <m.span
                      className="text-2xl text-green-400"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      ✓
                    </m.span>
                  </div>
                  <div>
                    <p className="f-mono text-zinc-300 text-sm">Access code updated successfully.</p>
                    <p className="f-mono text-zinc-500 text-xs mt-1">You can now log in with your new password.</p>
                  </div>
                  <PrimaryButton onClick={() => router.push("/login")} type="button">
                    Back to Login →
                  </PrimaryButton>
                </m.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${F1.hairline}` }}>
              <p className="f-mono text-zinc-600 text-[11px]">
                Remember it?{" "}
                <a href="/login" className="text-red-500 hover:text-red-400 transition-colors">Back to login</a>
              </p>
            </div>
          </AuthCard>
        </m.div>
      </m.div>
    </div>
  );
}
