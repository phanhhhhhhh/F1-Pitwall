// src/app/components/ExportButton.tsx
"use client";

import { useState } from "react";

interface ExportButtonProps {
  label: string;
  icon?: string;
  onClick: () => Promise<void>;
  variant?: "csv" | "pdf" | "default";
  size?: "sm" | "md";
}

export default function ExportButton({
  label,
  icon,
  onClick,
  variant = "default",
  size = "sm",
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const baseClass = size === "sm"
    ? "px-3 py-1.5 text-xs"
    : "px-4 py-2 text-sm";

  const colorClass = done
    ? "border-green-500 text-green-400 bg-green-500/10"
    : variant === "csv"
    ? "border-emerald-700 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/10"
    : variant === "pdf"
    ? "border-blue-700 text-blue-400 hover:border-blue-500 hover:bg-blue-500/10"
    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${baseClass} ${colorClass} border rounded-lg font-mono transition-all flex items-center gap-1.5 disabled:opacity-50`}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
      ) : done ? (
        "✓"
      ) : (
        icon || (variant === "csv" ? "⬇" : variant === "pdf" ? "📄" : "⬇")
      )}
      {loading ? "..." : done ? "DONE" : label}
    </button>
  );
}
