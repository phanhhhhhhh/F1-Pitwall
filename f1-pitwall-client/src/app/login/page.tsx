"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "../lib/pitwall-auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [focused, setFocused] = useState<"user" | "pass" | null>(null);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setTimeout(() => setMounted(true), 50);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            await login(username, password);
            router.push("/");
        } catch (error) {
            setError(error instanceof Error ? error.message : "Authentication failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden">
            <style>{`
                @keyframes fadeUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes glow {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.8; }
                }
                @keyframes scan {
                    0% { transform: translateY(-100vh); }
                    100% { transform: translateY(100vh); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .fade-up { animation: fadeUp 0.6s ease-out both; }
                .glow-pulse { animation: glow 3s ease-in-out infinite; }
                .float { animation: float 6s ease-in-out infinite; }
            `}</style>

            {/* Layered background */}
            <div className="absolute inset-0">
                {/* Grid */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: "linear-gradient(#ef4444 1px, transparent 1px), linear-gradient(90deg, #ef4444 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }} />
                {/* Ambient orbs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/8 rounded-full blur-[120px] glow-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-red-900/10 rounded-full blur-[80px] glow-pulse" style={{ animationDelay: "1.5s" }} />
                {/* Diagonal lines */}
                <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="absolute h-px bg-gradient-to-r from-transparent via-red-500 to-transparent w-full"
                            style={{ top: `${10 + i * 16}%`, transform: `rotate(-15deg) scaleX(2)` }} />
                    ))}
                </div>
                {/* Scan line */}
                <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
                    style={{ animation: "scan 8s linear infinite" }} />
            </div>

            {/* Floating F1 car icon */}
            <div className="absolute top-16 right-16 text-6xl opacity-5 float select-none hidden lg:block">🏎️</div>
            <div className="absolute bottom-24 left-16 text-4xl opacity-5 float select-none hidden lg:block" style={{ animationDelay: "2s" }}>🏁</div>

            {/* Main card */}
            <div className={`relative w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>

                {/* Card glow */}
                <div className="absolute inset-0 rounded-3xl bg-red-500/5 blur-xl" />

                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Top accent */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent" />

                    <div className="p-8">
                        {/* Logo */}
                        <div className="text-center mb-10 fade-up">
                            <div className="relative inline-block mb-4">
                                {/* Rotating ring */}
                                <div className="absolute inset-0 rounded-full border border-red-500/20"
                                    style={{ animation: "spin-slow 8s linear infinite" }} />
                                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                                    <span className="text-2xl">🏎️</span>
                                </div>
                            </div>
                            <h1 className="text-4xl font-black tracking-tighter text-white">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PIT</span>WALL
                            </h1>
                            <p className="text-zinc-500 text-xs tracking-[0.4em] uppercase mt-2 font-mono">
                                Command Center Access
                            </p>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center fade-up flex items-center gap-2 justify-center">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Username */}
                            <div className="fade-up" style={{ animationDelay: "100ms" }}>
                                <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">
                                    Callsign
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        onFocus={() => setFocused("user")}
                                        onBlur={() => setFocused(null)}
                                        className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono"
                                        style={{
                                            borderColor: focused === "user" ? "#ef4444" : "rgba(63,63,70,0.5)",
                                            boxShadow: focused === "user" ? "0 0 20px rgba(239,68,68,0.15)" : "none",
                                        }}
                                        placeholder="admin"
                                        required
                                        autoComplete="username"
                                    />
                                    {focused === "user" && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    )}
                                </div>
                            </div>

                            {/* Password */}
                            <div className="fade-up" style={{ animationDelay: "150ms" }}>
                                <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-2 font-mono">
                                    Access Code
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onFocus={() => setFocused("pass")}
                                        onBlur={() => setFocused(null)}
                                        className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3.5 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono"
                                        style={{
                                            borderColor: focused === "pass" ? "#ef4444" : "rgba(63,63,70,0.5)",
                                            boxShadow: focused === "pass" ? "0 0 20px rgba(239,68,68,0.15)" : "none",
                                        }}
                                        placeholder="••••••••"
                                        required
                                        autoComplete="current-password"
                                    />
                                    {focused === "pass" && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    )}
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="fade-up" style={{ animationDelay: "200ms" }}>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="relative w-full py-4 rounded-xl font-black tracking-widest text-sm overflow-hidden transition-all duration-300 disabled:opacity-50"
                                    style={{
                                        background: isLoading
                                            ? "rgba(39,39,42,0.8)"
                                            : "linear-gradient(135deg, #ef4444, #dc2626)",
                                        boxShadow: isLoading ? "none" : "0 0 30px rgba(239,68,68,0.3)",
                                    }}
                                >
                                    {/* Shimmer */}
                                    {!isLoading && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                                    )}
                                    <span className="relative flex items-center justify-center gap-2 text-white">
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                AUTHENTICATING...
                                            </>
                                        ) : (
                                            <>ENTER PITWALL →</>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="mt-6 pt-5 border-t border-zinc-800/50 text-center fade-up" style={{ animationDelay: "250ms" }}>
                            <p className="text-zinc-600 text-xs font-mono">
                                Need an account?{" "}
                                <a href="/register" className="text-red-500 hover:text-red-400 transition-colors">
                                    Sign up
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Bottom accent */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                </div>

                {/* Test creds */}
                <div className="mt-4 text-center">
                    <p className="text-zinc-700 text-xs font-mono">Test: admin / pitwall2024</p>
                </div>
            </div>
        </div>
    );
}