"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setTokens } from "../../lib/pitwall-auth";

export default function OAuth2CallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState("");

    useEffect(() => {
        const accessToken = searchParams.get("accessToken");
        const refreshToken = searchParams.get("refreshToken");
        const username = searchParams.get("username");
        const role = searchParams.get("role");
        const expiresIn = searchParams.get("expiresIn");
        const err = searchParams.get("error");

        if (err) {
            setError("Google login failed. Please try again.");
            setTimeout(() => router.push("/login"), 3000);
            return;
        }

        if (!accessToken || !refreshToken) {
            setError("Invalid callback — missing tokens.");
            setTimeout(() => router.push("/login"), 3000);
            return;
        }


        setTokens(accessToken, refreshToken);


        if (typeof window !== "undefined") {
            sessionStorage.setItem("pitwall_username", username || "");
            sessionStorage.setItem("pitwall_role", role || "VIEWER");
        }


        router.replace("/");
    }, [searchParams, router]);

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                .fade-in { animation: fadeIn .5s ease-out both; }
            `}</style>

            {error ? (
                <div className="text-center fade-in">
                    <p className="text-red-400 font-mono text-sm mb-2">⚠️ {error}</p>
                    <p className="text-zinc-600 text-xs font-mono">Redirecting to login...</p>
                </div>
            ) : (
                <div className="text-center fade-in">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
                        <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent" style={{ animation: "spin .8s linear infinite" }} />
                        <div className="absolute inset-2 border border-red-500/40 rounded-full border-b-transparent" style={{ animation: "spin .6s linear infinite reverse" }} />
                    </div>
                    <h2 className="text-white font-black text-xl mb-2">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PIT</span>WALL
                    </h2>
                    <p className="text-zinc-400 font-mono text-sm animate-pulse">Authenticating with Google...</p>
                </div>
            )}
        </div>
    );
}