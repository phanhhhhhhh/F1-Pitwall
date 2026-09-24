"use client";

import { m } from "framer-motion";

export function ErrorBanner({ msg }: { msg: string }) {
    return (
        <m.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-lg f-mono text-xs text-red-400 text-center flex items-center gap-2 justify-center chamfer-sm"
            style={{ background: "rgba(225,6,0,0.08)", border: `1px solid rgba(225,6,0,0.28)` }}
        >
            <span className="text-base">⚠</span> {msg}
        </m.div>
    );
}
