"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setTokens } from "../../lib/pitwall-auth";
import { motion } from "framer-motion";
import PitwallBackground from "../../components/PitwallBackground";
import { F1 } from "../../lib/f1-theme";

/* ── Animated Google "G" mark ────────────────────────────────────────────── */
function GoogleMark() {
    return (
        <svg width="20" height="20" viewBox="0 0 18 18" fill="none" className="opacity-80">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z" />
        </svg>
    );
}

/* ── Concentric spinner rings ────────────────────────────────────────────── */
function ConcentricSpinner() {
    return (
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            {/* outermost slow ring */}
            <svg
                className="absolute"
                width="80" height="80" viewBox="0 0 80 80"
                style={{ animation: "spin-slow 3s linear infinite" }}
            >
                <circle cx="40" cy="40" r="36" fill="none" stroke={`rgba(225,6,0,0.2)`} strokeWidth="1.5" strokeDasharray="10 8" />
            </svg>
            {/* main red spinner */}
            <svg
                className="absolute"
                width="64" height="64" viewBox="0 0 64 64"
                style={{ animation: "spin-slow 1.1s linear infinite" }}
            >
                <circle cx="32" cy="32" r="28" fill="none" stroke={F1.red} strokeWidth="2.5"
                    strokeLinecap="round" strokeDasharray="55 120" />
            </svg>
            {/* inner counter-spin */}
            <svg
                className="absolute"
                width="44" height="44" viewBox="0 0 44 44"
                style={{ animation: "spin-slow 0.65s linear infinite reverse" }}
            >
                <circle cx="22" cy="22" r="18" fill="none" stroke={`rgba(225,6,0,0.45)`} strokeWidth="1.5"
                    strokeLinecap="round" strokeDasharray="20 70" />
            </svg>
            {/* centre dot */}
            <div
                className="w-3 h-3 rounded-full"
                style={{ background: F1.red, boxShadow: `0 0 12px ${F1.red}` }}
            />
        </div>
    );
}

/* ── Dots loading animation ──────────────────────────────────────────────── */
function LoadingDots() {
    return (
        <span className="inline-flex gap-1 items-end ml-1">
            {[0, 1, 2].map(i => (
                <motion.span
                    key={i}
                    className="w-1 h-1 rounded-full"
                    style={{ background: "#71717a" }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
                />
            ))}
        </span>
    );
}

/* ── Callback handler ────────────────────────────────────────────────────── */
function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState("");

    useEffect(() => {
        const accessToken = searchParams.get("accessToken");
        const refreshToken = searchParams.get("refreshToken");
        const username = searchParams.get("username");
        const role = searchParams.get("role");
        const err = searchParams.get("error");

        if (err) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError("Google login failed. Please try again.");
            setTimeout(() => router.push("/login"), 3000);
            return;
        }

        if (!accessToken || !refreshToken) {
            setError("Invalid callback — missing tokens.");
            setTimeout(() => router.push("/login"), 3000);
            return;
        }

        // Store tokens
        setTokens(accessToken, refreshToken);

        // Store username/role for Navbar — phải lưu trước khi redirect
        if (typeof window !== "undefined") {
            sessionStorage.setItem("pitwall_username", username || "");
            sessionStorage.setItem("pitwall_role", role || "VIEWER");
        }

        // Delay nhỏ để sessionStorage kịp ghi trước khi redirect
        setTimeout(() => { window.location.href = "/"; }, 300);
    }, [searchParams, router]);

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="text-center z-10 relative"
            >
                <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-xl"
                    style={{ background: "rgba(225,6,0,0.10)", border: `1px solid rgba(225,6,0,0.28)` }}
                >
                    ⚠
                </div>
                <p className="f-mono text-red-400 text-sm mb-2">{error}</p>
                <p className="f-mono text-zinc-600 text-xs">Redirecting to login</p>
                <div className="flex justify-center mt-2 gap-1">
                    {[0,1,2].map(i => (
                        <motion.div
                            key={i}
                            className="w-1 h-1 rounded-full"
                            style={{ background: "#52525b" }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }}
                        />
                    ))}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 text-center"
        >
            {/* Card */}
            <div
                className="relative rounded-xl overflow-hidden shadow-2xl p-8 w-72 sm:w-80"
                style={{
                    background: F1.card,
                    border: `1px solid ${F1.hairline}`,
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                }}
            >
                {/* Top red hairline */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />

                {/* Glow halo */}
                <div
                    className="absolute -inset-4 rounded-2xl blur-2xl pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(225,6,0,0.07),transparent 70%)" }}
                />

                <ConcentricSpinner />

                {/* Wordmark */}
                <h2 className="f-cond font-black tracking-tight leading-none mb-1"
                    style={{ fontSize: "clamp(1.6rem,5vw,2rem)" }}>
                    <span style={{ color: F1.red }}>PIT</span>
                    <span className="text-white">WALL</span>
                </h2>

                {/* Status line */}
                <div className="flex items-center justify-center gap-2 mt-2">
                    <GoogleMark />
                    <p className="f-mono text-zinc-400 text-xs">
                        Authenticating with Google
                        <LoadingDots />
                    </p>
                </div>

                {/* Progress bar */}
                <div className="mt-5 h-px rounded-full overflow-hidden" style={{ background: F1.hairline }}>
                    <motion.div
                        className="h-full"
                        style={{ background: `linear-gradient(90deg,${F1.red},#ff5a3c)` }}
                        initial={{ width: "0%" }}
                        animate={{ width: "85%" }}
                        transition={{ duration: 2.5, ease: "easeInOut" }}
                    />
                </div>

                {/* Bottom accent */}
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5" style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }} />
            </div>
        </motion.div>
    );
}

export default function OAuth2CallbackPage() {
    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{ background: F1.bg }}
        >
            <PitwallBackground glow="top-center" streaks={3} />

            <Suspense fallback={
                <div className="relative z-10 text-center">
                    <div
                        className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                        style={{ borderColor: F1.red, borderTopColor: "transparent" }}
                    />
                    <p className="f-mono text-zinc-500 text-xs animate-pulse">Loading...</p>
                </div>
            }>
                <CallbackHandler />
            </Suspense>
        </div>
    );
}
