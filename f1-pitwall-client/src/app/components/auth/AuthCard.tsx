"use client";

import { ReactNode } from "react";
import { F1 } from "../../lib/f1-theme";

interface AuthCardProps {
  children: ReactNode;
  className?: string;
  showTopAccent?: boolean;
  showBottomAccent?: boolean;
}

export function AuthCard({
  children,
  className = "",
  showTopAccent = true,
  showBottomAccent = true,
}: AuthCardProps) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden shadow-2xl group/card ${className}`}
      style={{
        background: F1.card,
        border: `1px solid ${F1.hairline}`,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* Animated border glow */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none border-glow"
        style={{
          border: "1px solid transparent",
          background: `linear-gradient(135deg, rgba(225,6,0,0.08), transparent 40%, transparent 60%, rgba(225,6,0,0.08)) border-box`,
          WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Holographic sweep on hover */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
        style={{
          background: "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
          animation: "holographic 3s linear infinite",
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-3 left-3 w-4 h-4 pointer-events-none" style={{ borderTop: `1px solid rgba(225,6,0,0.25)`, borderLeft: `1px solid rgba(225,6,0,0.25)` }} />
      <div className="absolute top-3 right-3 w-4 h-4 pointer-events-none" style={{ borderTop: `1px solid rgba(225,6,0,0.25)`, borderRight: `1px solid rgba(225,6,0,0.25)` }} />
      <div className="absolute bottom-3 left-3 w-4 h-4 pointer-events-none" style={{ borderBottom: `1px solid rgba(225,6,0,0.25)`, borderLeft: `1px solid rgba(225,6,0,0.25)` }} />
      <div className="absolute bottom-3 right-3 w-4 h-4 pointer-events-none" style={{ borderBottom: `1px solid rgba(225,6,0,0.25)`, borderRight: `1px solid rgba(225,6,0,0.25)` }} />

      {/* Top red accent line */}
      {showTopAccent && (
        <div
          className="h-px w-full"
          style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }}
        />
      )}

      <div className="p-7 sm:p-8 relative z-10">{children}</div>

      {/* Bottom hairline */}
      {showBottomAccent && (
        <>
          <div className="h-px w-full" style={{ background: F1.hairline }} />
          <div
            className="h-0.5 w-1/3 mx-auto"
            style={{ background: `linear-gradient(90deg,transparent,${F1.red},transparent)` }}
          />
        </>
      )}
    </div>
  );
}
