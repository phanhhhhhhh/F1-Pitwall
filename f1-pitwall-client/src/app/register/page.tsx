"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { register } from "../lib/pitwall-auth";
import { BASE_URL as API } from "../lib/api-client";

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

    useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!username.trim() || username.trim().length < 3) { setError("Callsign must be at least 3 characters"); return; }
        if (!email.trim() || !email.includes("@") || !email.includes(".")) { setError("Please enter a valid email address"); return; }
        if (password !== confirm) { setError("Passwords do not match"); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

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

    const fields = [
        { key: "username", label: "Callsign", type: "text", value: username, set: setUsername, placeholder: "e.g. hamilton44", autoComplete: "username" },
        { key: "email", label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@pitwall.f1", autoComplete: "email" },
        { key: "password", label: "Access Code", type: "password", value: password, set: setPassword, placeholder: "min 6 characters", autoComplete: "new-password" },
        { key: "confirm", label: "Confirm Code", type: "password", value: confirm, set: setConfirm, placeholder: "••••••••", autoComplete: "new-password" },
    ];

    const strength = password.length === 0 ? 0
        : password.length < 6 ? 1
            : password.length < 10 ? 2
                : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;

    const strengthColors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
    const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
            <style>{`
                @keyframes fadeUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
                @keyframes glow { 0%,100%{opacity:.3} 50%{opacity:.8} }
                @keyframes scan { 0%{transform:translateY(-100vh)} 100%{transform:translateY(100vh)} }
                @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                .fade-up { animation: fadeUp .5s ease-out both; }
                .glow-pulse { animation: glow 3s ease-in-out infinite; }
            `}</style>

            { }
            <div className="absolute inset-0">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: "linear-gradient(#ef4444 1px,transparent 1px),linear-gradient(90deg,#ef4444 1px,transparent 1px)",
                    backgroundSize: "40px 40px",
                }} />
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-red-500/8 rounded-full blur-[120px] glow-pulse" />
                <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-orange-900/10 rounded-full blur-[80px] glow-pulse" style={{ animationDelay: "1.5s" }} />
                <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent"
                    style={{ animation: "scan 8s linear infinite" }} />
            </div>

            { }
            <div className={`relative w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                <div className="absolute inset-0 rounded-3xl bg-red-500/5 blur-xl" />

                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-red-500 to-transparent" />

                    <div className="p-8">
                        { }
                        <div className="text-center mb-8 fade-up">
                            <div className="relative inline-block mb-4">
                                <div className="absolute inset-0 rounded-full border border-red-500/20"
                                    style={{ animation: "spin-slow 8s linear infinite" }} />
                                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                                    <span className="text-xl">🏎️</span>
                                </div>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-white">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PIT</span>WALL
                            </h1>
                            <p className="text-zinc-500 text-xs tracking-[0.4em] uppercase mt-1.5 font-mono">
                                Create Account
                            </p>
                        </div>

                        { }
                        {error && (
                            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center flex items-center gap-2 justify-center fade-up">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        { }
                        <a href={`${API}/oauth2/authorize/google`}
                            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-800 hover:border-zinc-600 transition-all duration-200 text-sm font-bold text-white fade-up">
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
                                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
                                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
                                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z" />
                            </svg>
                            Continue with Google
                        </a>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-zinc-800" />
                            <span className="text-zinc-600 text-xs font-mono">OR</span>
                            <div className="flex-1 h-px bg-zinc-800" />
                        </div>

                        { }
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {fields.map((f, i) => (
                                <div key={f.key} className="fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                                    <label className="block text-zinc-500 text-xs uppercase tracking-[0.2em] mb-1.5 font-mono">
                                        {f.label}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={f.type}
                                            value={f.value}
                                            onChange={e => f.set(e.target.value)}
                                            onFocus={() => setFocused(f.key)}
                                            onBlur={() => setFocused(null)}
                                            autoComplete={f.autoComplete}
                                            placeholder={f.placeholder}
                                            required
                                            className="w-full bg-zinc-950/80 border rounded-xl px-4 py-3 text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 font-mono text-sm"
                                            style={{
                                                borderColor: focused === f.key ? "#ef4444" : "rgba(63,63,70,0.5)",
                                                boxShadow: focused === f.key ? "0 0 20px rgba(239,68,68,0.12)" : "none",
                                            }}
                                        />
                                        {focused === f.key && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        )}
                                    </div>

                                    { }
                                    {f.key === "password" && password.length > 0 && (
                                        <div className="mt-2">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4].map(l => (
                                                    <div key={l} className="flex-1 h-1 rounded-full transition-all duration-300"
                                                        style={{ backgroundColor: l <= strength ? strengthColors[strength] : "#27272a" }} />
                                                ))}
                                            </div>
                                            <p className="text-xs mt-1 font-mono" style={{ color: strengthColors[strength] }}>
                                                {strengthLabels[strength]}
                                            </p>
                                        </div>
                                    )}

                                    { }
                                    {f.key === "confirm" && confirm.length > 0 && (
                                        <p className={`text-xs mt-1 font-mono ${password === confirm ? "text-green-400" : "text-red-400"}`}>
                                            {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                                        </p>
                                    )}
                                </div>
                            ))}

                            { }
                            <div className="bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3 fade-up" style={{ animationDelay: "240ms" }}>
                                <p className="text-xs text-zinc-500 font-mono">
                                    🔒 New accounts are granted <span className="text-zinc-300 font-bold">VIEWER</span> role by default.
                                    Contact an admin to upgrade.
                                </p>
                            </div>

                            { }
                            <div className="fade-up" style={{ animationDelay: "280ms" }}>
                                <button type="submit" disabled={isLoading}
                                    className="relative w-full py-4 rounded-xl font-black tracking-widest text-sm overflow-hidden transition-all duration-300 disabled:opacity-50 text-white"
                                    style={{
                                        background: isLoading ? "rgba(39,39,42,0.8)" : "linear-gradient(135deg,#ef4444,#dc2626)",
                                        boxShadow: isLoading ? "none" : "0 0 30px rgba(239,68,68,0.3)",
                                    }}>
                                    {!isLoading && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                                    )}
                                    <span className="relative flex items-center justify-center gap-2">
                                        {isLoading ? (
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />CREATING ACCOUNT...</>
                                        ) : "CREATE ACCOUNT →"}
                                    </span>
                                </button>
                            </div>
                        </form>

                        { }
                        <div className="mt-6 pt-5 border-t border-zinc-800/50 text-center fade-up" style={{ animationDelay: "320ms" }}>
                            <p className="text-zinc-600 text-xs font-mono">
                                Already have an account?{" "}
                                <a href="/login" className="text-red-500 hover:text-red-400 transition-colors font-bold">
                                    Sign in
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                </div>
            </div>
        </div>
    );
}