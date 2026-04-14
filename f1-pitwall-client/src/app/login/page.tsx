"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../lib/pitwall-auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await login(username, password);
            router.push("/");
        } catch (error) {
            setError(error instanceof Error ? error.message : "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white tracking-wider">
                        🏎️ <span className="text-red-500">PIT</span>WALL
                    </h1>
                    <p className="text-gray-500 mt-2 text-sm tracking-widest uppercase">
                        Command Center Access
                    </p>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8
                        backdrop-blur-sm shadow-2xl shadow-red-500/5">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30
                            rounded text-red-400 text-sm text-center">
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                                Callsign
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-700 rounded px-4 py-3
                           text-white placeholder-gray-600
                           focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50
                           transition-all duration-200"
                                placeholder="admin"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-xs uppercase tracking-wider mb-2">
                                Access Code
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-950 border border-gray-700 rounded px-4 py-3
                           text-white placeholder-gray-600
                           focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50
                           transition-all duration-200"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700
                         text-white font-semibold rounded
                         transition-all duration-200
                         shadow-lg shadow-red-500/20 hover:shadow-red-500/40
                         disabled:shadow-none"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">⟳</span> Authenticating...
                                </span>
                            ) : (
                                "ENTER PITWALL →"
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-gray-800 text-center">
                        <p className="text-gray-600 text-xs">
                            Need an account?{" "}
                            <a href="/register" className="text-red-500 hover:text-red-400 transition-colors">
                                Sign up
                            </a>
                        </p>
                    </div>
                </div>

                <div className="mt-4 text-center text-gray-700 text-xs">
                    <p>Test: admin / pitwall2024</p>
                </div>
            </div>
        </div>
    );
}