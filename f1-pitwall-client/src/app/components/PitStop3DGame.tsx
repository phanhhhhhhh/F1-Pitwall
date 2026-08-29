"use client";

import { useEffect, useState, useRef } from "react";
import { playWheelGun, playCarJack, playUiClick } from "../lib/f1-sound";

type PitStep = "IDLE" | "GUN_OFF" | "TYRE_OFF" | "TYRE_ON" | "GUN_ON" | "DROPPED" | "FINISHED";

export default function PitStop3DGame() {
  const [step, setStep] = useState<PitStep>("IDLE");
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [gunProgress, setGunProgress] = useState<number>(0);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startEpochRef = useRef<number>(0);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const startChallenge = () => {
    playUiClick();
    setStep("GUN_OFF");
    setGunProgress(0);
    setElapsedMs(0);
    startEpochRef.current = performance.now();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - startEpochRef.current));
    }, 20);
  };

  // Handle Step 1: Loosen Wheel Nut (Hold)
  const startGunOff = () => {
    if (step !== "GUN_OFF") return;
    playWheelGun();
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      setGunProgress((prev) => {
        if (prev >= 100) {
          if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
          setStep("TYRE_OFF");
          setGunProgress(0);
          return 100;
        }
        return prev + 25;
      });
    }, 80);
  };

  const stopGunOff = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (step === "GUN_OFF" && gunProgress < 100) {
      setGunProgress(0);
    }
  };

  // Step 2: Remove Old Tyre
  const removeTyre = () => {
    if (step !== "TYRE_OFF") return;
    playUiClick();
    setStep("TYRE_ON");
  };

  // Step 3: Mount New Tyre
  const mountTyre = () => {
    if (step !== "TYRE_ON") return;
    playUiClick();
    setStep("GUN_ON");
    setGunProgress(0);
  };

  // Step 4: Tighten Wheel Nut (Hold)
  const startGunOn = () => {
    if (step !== "GUN_ON") return;
    playWheelGun();
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      setGunProgress((prev) => {
        if (prev >= 100) {
          if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
          setStep("DROPPED");
          setGunProgress(0);
          return 100;
        }
        return prev + 25;
      });
    }, 80);
  };

  const stopGunOn = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (step === "GUN_ON" && gunProgress < 100) {
      setGunProgress(0);
    }
  };

  // Step 5: Drop Car off Pneumatic Jacks
  const dropCar = () => {
    if (step !== "DROPPED") return;
    playCarJack();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const finalTime = Math.round(performance.now() - startEpochRef.current);
    setElapsedMs(finalTime);
    setStep("FINISHED");

    if (!bestTime || finalTime < bestTime) {
      setBestTime(finalTime);
    }
  };

  const formattedTime = (elapsedMs / 1000).toFixed(3);

  return (
    <div className="w-full bg-gradient-to-b from-[#161720] to-[#0d0e14] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative font-sans">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 live-pulse" />
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase">
            DHL PIT STOP CREW CHALLENGE (DHL 1.82S RECORD)
          </h3>
        </div>
        {bestTime && (
          <span className="text-xs font-bold f-mono text-emerald-400">
            BEST: {(bestTime / 1000).toFixed(3)}s
          </span>
        )}
      </div>

      {/* Stopwatch Display */}
      <div className="flex flex-col items-center justify-center py-4 bg-black/60 rounded-2xl border border-zinc-800 mb-5">
        <span className="text-[10px] font-bold text-zinc-500 f-mono tracking-widest uppercase mb-1">
          PIT LANE STOPWATCH (GOAL: &lt; 2.0s)
        </span>
        <div className="text-5xl sm:text-6xl font-black f-orbitron tracking-tight text-white tabular-nums">
          {formattedTime} <span className="text-xl text-zinc-500 font-normal">SEC</span>
        </div>
      </div>

      {/* Step Action Arena */}
      <div className="min-h-[160px] flex flex-col items-center justify-center bg-black/40 p-4 rounded-2xl border border-zinc-800/80">
        {step === "IDLE" && (
          <div className="text-center">
            <div className="text-sm font-bold text-zinc-300 f-cond uppercase mb-3">
              TEST YOUR REFLEXES AS AN F1 TYRE CHANGER
            </div>
            <button
              onClick={startChallenge}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 font-black f-orbitron text-xs rounded-xl text-white shadow-[0_0_15px_rgba(225,6,0,0.5)] transition-all uppercase tracking-wider"
            >
              BOX, BOX, BOX! START STOP
            </button>
          </div>
        )}

        {step === "GUN_OFF" && (
          <div className="flex flex-col items-center w-full max-w-xs">
            <span className="text-xs font-bold text-amber-400 f-orbitron mb-2 uppercase">
              1. HOLD WHEEL GUN (LOOSEN NUT)
            </span>
            <button
              onMouseDown={startGunOff}
              onMouseUp={stopGunOff}
              onTouchStart={startGunOff}
              onTouchEnd={stopGunOff}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 font-black f-orbitron text-sm rounded-2xl text-black shadow-lg transition-all uppercase select-none"
            >
              ⚙️ HOLD TO SPIN NUT OFF
            </button>
            <div className="w-full h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{ width: `${gunProgress}%` }}
              />
            </div>
          </div>
        )}

        {step === "TYRE_OFF" && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-red-400 f-orbitron mb-2 uppercase">
              2. PULL OFF WORN TYRE
            </span>
            <button
              onClick={removeTyre}
              className="px-8 py-3.5 bg-red-600 hover:bg-red-500 active:scale-95 font-black f-orbitron text-sm rounded-2xl text-white shadow-lg transition-all uppercase"
            >
              🔴 PULL OFF TYRE
            </button>
          </div>
        )}

        {step === "TYRE_ON" && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-emerald-400 f-orbitron mb-2 uppercase">
              3. SLAM ON FRESH HARD TYRE
            </span>
            <button
              onClick={mountTyre}
              className="px-8 py-3.5 bg-zinc-100 hover:bg-white text-black active:scale-95 font-black f-orbitron text-sm rounded-2xl shadow-lg transition-all uppercase"
            >
              ⚪ SLAM ON TYRE
            </button>
          </div>
        )}

        {step === "GUN_ON" && (
          <div className="flex flex-col items-center w-full max-w-xs">
            <span className="text-xs font-bold text-cyan-400 f-orbitron mb-2 uppercase">
              4. HOLD WHEEL GUN (TIGHTEN 500NM NUT)
            </span>
            <button
              onMouseDown={startGunOn}
              onMouseUp={stopGunOn}
              onTouchStart={startGunOn}
              onTouchEnd={stopGunOn}
              className="w-full py-4 bg-cyan-400 hover:bg-cyan-300 active:scale-95 font-black f-orbitron text-sm rounded-2xl text-black shadow-lg transition-all uppercase select-none"
            >
              🔩 HOLD TO TIGHTEN NUT
            </button>
            <div className="w-full h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-75"
                style={{ width: `${gunProgress}%` }}
              />
            </div>
          </div>
        )}

        {step === "DROPPED" && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-emerald-400 f-orbitron mb-2 uppercase animate-pulse">
              5. CAR CLEAR! DROP JACK!
            </span>
            <button
              onClick={dropCar}
              className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 font-black f-orbitron text-base rounded-2xl text-black shadow-[0_0_20px_#00E676] transition-all uppercase animate-bounce"
            >
              🟢 DROP JACK & GO!
            </button>
          </div>
        )}

        {step === "FINISHED" && (
          <div className="text-center">
            <div className="text-2xl font-black f-orbitron text-white">
              {formattedTime} SECONDS
            </div>
            <div className="text-xs font-bold f-cond tracking-wide mt-1 uppercase text-emerald-400">
              {Number(formattedTime) < 2.0
                ? "🏆 WORLD RECORD TIER — Faster than Red Bull Racing!"
                : Number(formattedTime) < 2.8
                ? "⚡ ELITE PIT CREW — Ready for Monaco GP"
                : "⚠️ SLOW STOP — Lost 2 positions in pit exit"}
            </div>
            <button
              onClick={startChallenge}
              className="mt-3 px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold f-orbitron rounded-xl border border-zinc-600 transition-all uppercase"
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
