"use client";

import { motion } from "framer-motion";
import { F1 } from "../../lib/f1-theme";

interface SectorStepsProps {
  steps: string[];
  currentIndex: number;
}

export function SectorSteps({ steps, currentIndex }: SectorStepsProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-7">
      {steps.map((label, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;

        return (
          <div key={label} className="flex items-center">
            {/* Step pill */}
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className="w-7 h-7 rounded-full flex items-center justify-center f-mono text-[10px] font-black"
                animate={{
                  scale: active ? [1, 1.15, 1] : done ? [1, 1.1, 1] : 1,
                }}
                transition={active ? { repeat: Infinity, duration: 2, ease: "easeInOut" } : { duration: 0.3 }}
                style={{
                  background: done
                    ? "rgba(0,230,118,0.25)"
                    : active
                      ? F1.red
                      : "rgba(39,39,42,0.8)",
                  border: done || active
                    ? `1px solid ${done ? "rgba(0,230,118,0.5)" : "rgba(225,6,0,0.5)"}`
                    : `1px solid ${F1.hairline}`,
                  color: done || active ? "#fff" : "#52525b",
                  boxShadow: active
                    ? "0 0 12px rgba(225,6,0,0.35)"
                    : done
                      ? "0 0 12px rgba(0,230,118,0.25)"
                      : "none",
                }}
              >
                {done ? "✓" : i + 1}
              </motion.div>
              <span
                className="f-mono text-[9px] uppercase tracking-wider"
                style={{
                  color: active ? F1.red : done ? "rgba(0,230,118,0.7)" : "#52525b",
                }}
              >
                {label}
              </span>
            </div>

            {/* Connecting line */}
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-2 mb-4 relative overflow-hidden" style={{ width: "40px", background: F1.hairline }}>
                {done && (
                  <motion.div
                    className="absolute inset-0 h-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ background: "rgba(0,230,118,0.4)" }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
