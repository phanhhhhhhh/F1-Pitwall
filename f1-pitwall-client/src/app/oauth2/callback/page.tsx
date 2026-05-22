"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setTokens } from "../../lib/pitwall-auth";

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
        setTimeout(() => router.replace("/"), 200);
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="text-center">
                <p className="text-red-400 font-mono text-sm mb-2">⚠️ {error}</p>
                <p className="text-zinc-600 text-xs font-mono">Redirecting to login...</p>
            </div>
        );
    }

    return (
        <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 border-2 border-red-500/20 rounded-full" />
                <div className="absolute inset-0 border-2 border-red-500 rounded-full border-t-transparent animate-spin" />
                <div className="absolute inset-2 border border-red-500/40 rounded-full border-b-transparent animate-spin"
                    style={{ animationDirection: "reverse", animationDuration: "0.6s" }} />
            </div>
            <h2 className="text-white font-black text-xl mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PIT</span>WALL
            </h2>
            <p className="text-zinc-400 font-mono text-sm animate-pulse">Authenticating with Google...</p>
        </div>
    );
}

export default function OAuth2CallbackPage() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <Suspense fallback={
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-500 font-mono text-sm animate-pulse">Loading...</p>
                </div>
            }>
                <CallbackHandler />
            </Suspense>
        </div>
    );
}