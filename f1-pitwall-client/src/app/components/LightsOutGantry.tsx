"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { playGantryLight, playLightsOut, playUiClick } from "../lib/f1-sound";

export default function LightsOutGantry() {
  const [stage, setStage] = useState<"IDLE" | "LIGHTING" | "WAITING" | "GO" | "FINISHED">("IDLE");
  const [activeLights, setActiveLights] = useState<number>(0);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [falseStart, setFalseStart] = useState<boolean>(false);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timerRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const startSequence = () => {
    playUiClick();
    timerRef.current.forEach((t) => clearTimeout(t));
    timerRef.current = [];

    setStage("LIGHTING");
    setActiveLights(0);
    setReactionTime(null);
    setFalseStart(false);

    // Sequence 5 lights (1 per second)
    for (let i = 1; i <= 5; i++) {
      const t = setTimeout(() => {
        setActiveLights(i);
        playGantryLight();
      }, i * 1000);
      timerRef.current.push(t);
    }

    // Random lights out hold (1.0s to 3.0s after 5th light)
    const randomHold = 1000 + Math.random() * 2000;
    const goTimeout = setTimeout(() => {
      setStage("GO");
      setActiveLights(0);
      startTimeRef.current = performance.now();
      playLightsOut();
    }, 5000 + randomHold);

    timerRef.current.push(goTimeout);
  };

  const handleUserClick = () => {
    if (stage === "LIGHTING" || stage === "WAITING") {
      // Jumped the start!
      timerRef.current.forEach((t) => clearTimeout(t));
      setFalseStart(true);
      setStage("FINISHED");
    } else if (stage === "GO") {
      const diff = Math.round(performance.now() - startTimeRef.current);
      setReactionTime(diff);
      setStage("FINISHED");
      if (!bestTime || diff < bestTime) {
        setBestTime(diff);
      }
    }
  };

  return (
    <div
      onClick={handleUserClick}
      className="relative w-full max-w-xl mx-auto bg-gradient-to-b from-[#16171d] to-[#0d0e12] border border-zinc-700/60 rounded-3xl p-6 shadow-2xl text-center cursor-pointer select-none overflow-hidden"
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 live-pulse" />
          <span className="text-xs font-black f-orbitron tracking-widest text-zinc-300 uppercase">
            FIA STARTING GANTRY
          </span>
        </div>
        {bestTime && (
          <span className="text-xs font-bold f-mono text-emerald-400">
            BEST: {bestTime}ms
          </span>
        )}
      </div>

      {/* ── 5 Gantry Light Pillars ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 sm:gap-5 py-4 bg-black/70 rounded-2xl border border-zinc-800/80 mb-5 shadow-inner">
        {Array.from({ length: 5 }).map((_, i) => {
          const isLit = activeLights > i;

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-2 p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-md"
            >
              {/* Upper Blank / Secondary Red */}
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-100 ${
                  isLit
                    ? "bg-red-600 led-red"
                    : "bg-zinc-800/80 border border-zinc-700/40"
                }`}
              />
              {/* Lower Main Red */}
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full transition-all duration-100 ${
                  isLit
                    ? "bg-red-600 led-red"
                    : "bg-zinc-800/80 border border-zinc-700/40"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* ── Status & Feedback ──────────────────────────────────────────────── */}
      <div className="min-h-[70px] flex flex-col items-center justify-center">
        {stage === "IDLE" && (
          <div>
            <div className="text-sm font-bold text-zinc-300 f-cond tracking-wide uppercase mb-2">
              TEST YOUR F1 REACTION TIME
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                startSequence();
              }}
              className="px-5 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black f-orbitron text-xs rounded-xl shadow-[0_0_15px_rgba(225,6,0,0.4)] transition-all uppercase tracking-wider"
            >
              START SEQUENCE
            </button>
          </div>
        )}

        {stage === "LIGHTING" && (
          <div className="text-sm font-bold text-amber-400 f-orbitron tracking-widest animate-pulse">
            WAIT FOR LIGHTS OUT...
          </div>
        )}

        {stage === "GO" && (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1.1 }}
            className="text-2xl font-black f-orbitron text-emerald-400 glow-text-green tracking-widest uppercase"
          >
            LIGHTS OUT! CLICK NOW!
          </motion.div>
        )}

        {stage === "FINISHED" && (
          <div>
            {falseStart ? (
              <div className="text-base font-black f-orbitron text-red-500 glow-text-red">
                JUMP START! 5-SECOND PENALTY ⚠️
              </div>
            ) : (
              reactionTime && (
                <div>
                  <div className="text-2xl font-black f-orbitron text-white">
                    {reactionTime} <span className="text-sm text-zinc-400 font-normal">MS</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-400 f-cond tracking-wide mt-0.5 uppercase">
                    {reactionTime < 220
                      ? "⚡ PRO DRIVER TIER — Faster than Max Verstappen!"
                      : reactionTime < 290
                      ? "🏁 GREAT REACTION — Grand Prix Ready"
                      : "🐢 SLOW START — Lost 3 positions into Turn 1"}
                  </div>
                </div>
              )
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                startSequence();
              }}
              className="mt-3 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold f-orbitron rounded-lg border border-zinc-600 transition-all uppercase"
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
