"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { register } from "../lib/pitwall-auth";
import { motion, AnimatePresence } from "framer-motion";
import PitwallBackground from "../components/PitwallBackground";
import {
  AuthCard, AuthLogo, AuthInput, PrimaryButton,
  GoogleButton, StrengthMeter, ErrorBanner,
} from "../components/auth";
import { F1 } from "../lib/f1-theme";

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
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
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
    key: string; label: string; type: "text" | "email" | "password";
    value: string; set: (v: string) => void; placeholder: string; autoComplete: string;
  }> = [
    { key: "username", label: "Callsign",     type: "text",     value: username,  set: setUsername,  placeholder: "e.g. hamilton44",   autoComplete: "username"     },
    { key: "email",    label: "Email",        type: "email",    value: email,     set: setEmail,     placeholder: "you@pitwall.f1",    autoComplete: "email"        },
    { key: "password", label: "Access Code",  type: "password", value: password,  set: setPassword,  placeholder: "min 8 characters",  autoComplete: "new-password" },
    { key: "confirm",  label: "Confirm Code", type: "password", value: confirm,   set: setConfirm,   placeholder: "••••••••",          autoComplete: "new-password" },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: F1.bg }}
    >
      <PitwallBackground glow="top-center" streaks={5} intensity={0.85} />

      <motion.div
        style={{ perspective: 1200 }}
        className={`relative z-10 w-full max-w-md transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        <motion.div
          initial={{ rotateY: -8, translateY: 30, opacity: 0 }}
          animate={{ rotateY: 0, translateY: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Glow halo */}
          <div
            className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(225,6,0,0.07),transparent 70%)" }}
          />

          <AuthCard>
            <AuthLogo subtitle="Create Account" />

            <AnimatePresence>
              {error && <ErrorBanner msg={error} />}
            </AnimatePresence>

            {/* Google */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GoogleButton />
            </motion.div>

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
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                >
                  <AuthInput
                    id={f.key} label={f.label} type={f.type} value={f.value}
                    onChange={f.set} placeholder={f.placeholder}
                    autoComplete={f.autoComplete} required terminal
                    focused={focused} setFocused={setFocused}
                    extra={
                      f.key === "password" ? <StrengthMeter password={password} /> :
                      f.key === "confirm" && confirm.length > 0 ? (
                        <p className={`f-mono text-[10px] mt-1 ${password === confirm ? "text-green-400" : "text-red-400"}`}>
                          {password === confirm ? "✓ MATCH" : "✗ MISMATCH"}
                        </p>
                      ) : undefined
                    }
                  />
                </motion.div>
              ))}

              {/* Role notice — FIA badge style */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                className="rounded-lg px-4 py-3 flex items-center gap-3"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${F1.hairline}` }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#eab308", boxShadow: "0 0 6px rgba(234,179,8,0.4)" }} />
                <div>
                  <p className="f-mono text-[10px] text-zinc-500">
                    Default role: <span className="text-zinc-300 font-bold">VIEWER</span>
                  </p>
                  <p className="f-mono text-[9px] text-zinc-600">Contact admin to upgrade</p>
                </div>
              </motion.div>

              {/* Submit */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <PrimaryButton isLoading={isLoading} disabled={isLoading}>
                  {isLoading ? "Creating Account..." : "Create Account →"}
                </PrimaryButton>
              </motion.div>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-5 text-center" style={{ borderTop: `1px solid ${F1.hairline}` }}>
              <p className="f-mono text-zinc-600 text-[11px]">
                Already have an account?{" "}
                <a href="/login" className="text-red-500 hover:text-red-400 transition-colors font-bold">Sign in</a>
              </p>
            </div>
          </AuthCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
