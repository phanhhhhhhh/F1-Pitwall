"use client";

import { ReactNode } from "react";
import { Spinner } from "./Spinner";
import { F1 } from "../../lib/f1-theme";

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "danger" | "success";
  fullWidth?: boolean;
  className?: string;
}

const VARIANT_STYLES = {
  primary: {
    bg: `linear-gradient(135deg,${F1.red},#dc2626)`,
    shadow: `0 0 28px rgba(225,6,0,0.32)`,
    hoverShadow: `0 0 36px rgba(225,6,0,0.45)`,
  },
  danger: {
    bg: "linear-gradient(135deg,#dc2626,#991b1b)",
    shadow: "0 0 28px rgba(220,38,38,0.32)",
    hoverShadow: "0 0 36px rgba(220,38,38,0.45)",
  },
  success: {
    bg: `linear-gradient(135deg,${F1.green},#059669)`,
    shadow: `0 0 28px rgba(0,230,118,0.28)`,
    hoverShadow: `0 0 36px rgba(0,230,118,0.40)`,
  },
} as const;

export function PrimaryButton({
  children, onClick, type = "submit", disabled, isLoading,
  variant = "primary", fullWidth = true, className = "",
}: PrimaryButtonProps) {
  const v = VARIANT_STYLES[variant];
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`relative overflow-hidden transition-all duration-200 disabled:opacity-50 text-white f-mono font-bold text-xs tracking-[0.2em] uppercase chamfer-sm ${fullWidth ? "w-full py-3.5" : "px-6 py-3"} ${className}`}
      style={{
        background: isDisabled ? "rgba(39,39,42,0.8)" : v.bg,
        boxShadow: isDisabled ? "none" : v.shadow,
        borderRadius: "0.5rem",
        transform: "scale(1)",
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = v.hoverShadow;
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = isDisabled ? "none" : v.shadow;
      }}
      onMouseDown={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
        }
      }}
      onMouseUp={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
        }
      }}
    >
      {/* Shimmer overlay */}
      {!isDisabled && (
        <span
          className="shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          style={{ width: "60%" }}
        />
      )}

      <span className="relative flex items-center justify-center gap-2">
        {isLoading && <Spinner />}
        {children}
      </span>
    </button>
  );
}
