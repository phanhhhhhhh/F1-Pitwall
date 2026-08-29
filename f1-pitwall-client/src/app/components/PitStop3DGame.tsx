"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { playWheelGun, playCarJack, playUiClick } from "../lib/f1-sound";
import { fetchPitStopBenchmark } from "../lib/f1-data";
import type { PitStopBenchmark } from "../types/f1";

type PitStep = "IDLE" | "GUN_OFF" | "TYRE_OFF" | "TYRE_ON" | "GUN_ON" | "DROPPED" | "FINISHED";

interface PitStop3DGameProps {
  season: number;
}

const BEST_TIME_KEY = "pitwall_pitstop_best_ms";

/**
 * The stored best is read through {@link useSyncExternalStore} rather than in an effect: the server
 * snapshot is `null`, so the first client render matches the server HTML and the stored value
 * arrives on the very next render without a hydration mismatch. Storage access throws in a private
 * window or with site data blocked, which must not take the widget down.
 */
const subscribeToNothing = () => () => {};
const readStoredBest = () => {
  try {
    return window.localStorage.getItem(BEST_TIME_KEY);
  } catch {
    return null;
  }
};
const serverStoredBest = () => null;

/** How the player's stop is graded, worst grade last. Thresholds come from the season's real stops. */
interface Grade {
  label: string;
  detail: string;
  className: string;
}

export default function PitStop3DGame({ season }: PitStop3DGameProps) {
  const [step, setStep] = useState<PitStep>("IDLE");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sessionBestMs, setSessionBestMs] = useState<number | null>(null);
  const [gunProgress, setGunProgress] = useState(0);
  const [benchmark, setBenchmark] = useState<PitStopBenchmark | null>(null);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startEpochRef = useRef(0);

  const storedBest = useSyncExternalStore(subscribeToNothing, readStoredBest, serverStoredBest);

  const bestMs = useMemo(() => {
    const parsed = storedBest === null ? NaN : Number(storedBest);
    const fromStorage = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (fromStorage === null) return sessionBestMs;
    if (sessionBestMs === null) return fromStorage;
    return Math.min(fromStorage, sessionBestMs);
  }, [storedBest, sessionBestMs]);

  useEffect(() => {
    let cancelled = false;
    fetchPitStopBenchmark(season)
      .then((data) => {
        if (!cancelled) setBenchmark(data);
      })
      .catch(() => {
        // The challenge is still playable without benchmarks; it just cannot grade against the
        // real field, which the UI says explicitly rather than inventing thresholds.
      });
    return () => {
      cancelled = true;
    };
  }, [season]);

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

  /** Both wheel-gun stages are the same hold-to-fill interaction, only the next step differs. */
  const startHold = useCallback((from: PitStep, to: PitStep) => {
    playWheelGun();
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);

    holdIntervalRef.current = setInterval(() => {
      setGunProgress((prev) => {
        if (prev >= 100) {
          if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
          setStep((current) => (current === from ? to : current));
          return 0;
        }
        return prev + 25;
      });
    }, 80);
  }, []);

  const stopHold = useCallback(() => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setGunProgress((prev) => (prev < 100 ? 0 : prev));
  }, []);

  const dropCar = () => {
    if (step !== "DROPPED") return;
    playCarJack();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const finalTime = Math.round(performance.now() - startEpochRef.current);
    setElapsedMs(finalTime);
    setStep("FINISHED");

    if (bestMs == null || finalTime < bestMs) {
      // Session state carries the new best even when storage is unavailable.
      setSessionBestMs(finalTime);
      try {
        window.localStorage.setItem(BEST_TIME_KEY, String(finalTime));
      } catch {
        // best time stays for this session only
      }
    }
  };

  const seconds = elapsedMs / 1000;
  const formatted = seconds.toFixed(3);

  const grade = useMemo<Grade | null>(() => {
    if (step !== "FINISHED") return null;
    if (!benchmark?.fastestSec || !benchmark.medianSec || !benchmark.topQuartileSec) {
      return {
        label: `${formatted} SECONDS`,
        detail: `No ${season} pit stop data to compare against yet.`,
        className: "text-zinc-400",
      };
    }
    if (seconds < benchmark.fastestSec) {
      return {
        label: "FASTER THAN THE SEASON'S BEST",
        detail: `Season best is ${benchmark.fastestSec.toFixed(3)}s by ${benchmark.fastest[0]?.teamName ?? "the field"}.`,
        className: "text-amber-400",
      };
    }
    if (seconds <= benchmark.topQuartileSec) {
      return {
        label: "TOP QUARTILE CREW",
        detail: `Quicker than 75% of ${benchmark.greenFlagStops} green-flag stops this season.`,
        className: "text-emerald-400",
      };
    }
    if (seconds <= benchmark.medianSec) {
      return {
        label: "ABOVE THE FIELD MEDIAN",
        detail: `Field median is ${benchmark.medianSec.toFixed(3)}s.`,
        className: "text-cyan-400",
      };
    }
    const lost = seconds - benchmark.medianSec;
    return {
      label: "SLOW STOP",
      detail: `${lost.toFixed(2)}s off the ${benchmark.medianSec.toFixed(3)}s field median — that is track position.`,
      className: "text-red-400",
    };
  }, [step, seconds, formatted, benchmark, season]);

  /** Where the player's best would sit among the season's fastest stops. */
  const rankAmongFastest = useMemo(() => {
    if (bestMs == null || !benchmark?.fastest.length) return null;
    const best = bestMs / 1000;
    const ahead = benchmark.fastest.filter((s) => s.durationSec < best).length;
    return ahead < benchmark.fastest.length ? ahead + 1 : null;
  }, [bestMs, benchmark]);

  return (
    <div className="w-full bg-gradient-to-b from-[#161720] to-[#0d0e14] border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden relative font-sans">
      <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 live-pulse" />
          <h3 className="text-base font-black f-cond tracking-wide text-white uppercase truncate">
            PIT CREW CHALLENGE
          </h3>
        </div>
        {bestMs != null && (
          <span className="text-xs font-bold f-mono text-emerald-400 shrink-0">
            BEST {(bestMs / 1000).toFixed(3)}s
            {rankAmongFastest && <span className="text-zinc-500"> · P{rankAmongFastest} vs season</span>}
          </span>
        )}
      </div>

      <div className="flex flex-col items-center justify-center py-4 bg-black/60 rounded-2xl border border-zinc-800 mb-4">
        <span className="text-[10px] font-bold text-zinc-500 f-mono tracking-widest uppercase mb-1">
          {benchmark?.medianSec
            ? `${season} FIELD MEDIAN ${benchmark.medianSec.toFixed(3)}s`
            : "PIT LANE STOPWATCH"}
        </span>
        <div className="text-5xl sm:text-6xl font-black f-orbitron tracking-tight text-white tabular-nums">
          {formatted} <span className="text-xl text-zinc-500 font-normal">SEC</span>
        </div>
      </div>

      <div className="min-h-[160px] flex flex-col items-center justify-center bg-black/40 p-4 rounded-2xl border border-zinc-800/80">
        {step === "IDLE" && (
          <div className="text-center">
            <div className="text-sm font-bold text-zinc-300 f-cond uppercase mb-3">
              CHANGE A TYRE AGAINST THE {season} FIELD
            </div>
            <button
              onClick={startChallenge}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 font-black f-orbitron text-xs rounded-xl text-white shadow-[0_0_15px_rgba(225,6,0,0.5)] transition-all uppercase tracking-wider"
            >
              BOX, BOX, BOX!
            </button>
          </div>
        )}

        {step === "GUN_OFF" && (
          <HoldStage
            label="1. HOLD WHEEL GUN (LOOSEN NUT)"
            action="⚙️ HOLD TO SPIN NUT OFF"
            progress={gunProgress}
            tone="amber"
            onStart={() => startHold("GUN_OFF", "TYRE_OFF")}
            onStop={stopHold}
          />
        )}

        {step === "TYRE_OFF" && (
          <TapStage
            label="2. PULL OFF WORN TYRE"
            action="🔴 PULL OFF TYRE"
            labelClass="text-red-400"
            buttonClass="bg-red-600 hover:bg-red-500 text-white"
            onClick={() => {
              playUiClick();
              setStep("TYRE_ON");
            }}
          />
        )}

        {step === "TYRE_ON" && (
          <TapStage
            label="3. SLAM ON FRESH TYRE"
            action="⚪ SLAM ON TYRE"
            labelClass="text-emerald-400"
            buttonClass="bg-zinc-100 hover:bg-white text-black"
            onClick={() => {
              playUiClick();
              setStep("GUN_ON");
              setGunProgress(0);
            }}
          />
        )}

        {step === "GUN_ON" && (
          <HoldStage
            label="4. HOLD WHEEL GUN (TIGHTEN NUT)"
            action="🔩 HOLD TO TIGHTEN NUT"
            progress={gunProgress}
            tone="cyan"
            onStart={() => startHold("GUN_ON", "DROPPED")}
            onStop={stopHold}
          />
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
              🟢 DROP JACK &amp; GO!
            </button>
          </div>
        )}

        {step === "FINISHED" && grade && (
          <div className="text-center">
            <div className="text-2xl font-black f-orbitron text-white">{formatted} SECONDS</div>
            <div className={`text-xs font-bold f-cond tracking-wide mt-1 uppercase ${grade.className}`}>
              {grade.label}
            </div>
            <p className="f-mono text-[10px] text-zinc-500 mt-1 max-w-xs mx-auto">{grade.detail}</p>
            <button
              onClick={startChallenge}
              className="mt-3 px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold f-orbitron rounded-xl border border-zinc-600 transition-all uppercase"
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* The real stops you are racing against */}
      {benchmark && benchmark.fastest.length > 0 && (
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <p className="f-mono text-[9px] text-zinc-500 uppercase tracking-widest mb-2">
            FASTEST STOPS · {season} · {benchmark.totalStops} recorded
          </p>
          <div className="space-y-1">
            {benchmark.fastest.slice(0, 5).map((stop, idx) => (
              <div key={stop.id} className="flex items-center gap-2 text-[11px] f-mono">
                <span className="text-zinc-600 w-4 tabular-nums">{idx + 1}</span>
                <span
                  className="w-1.5 h-4 rounded-sm shrink-0"
                  style={{ background: stop.teamColor }}
                />
                <span className="text-zinc-300 truncate flex-1" title={`${stop.driverName} · ${stop.raceName}`}>
                  {stop.teamName}
                  <span className="text-zinc-600"> · {stop.driverName.split(" ").pop()}</span>
                </span>
                {stop.underSafetyCar && (
                  <span className="text-[8px] text-amber-500/70 shrink-0" title="Taken under safety car">
                    SC
                  </span>
                )}
                <span className="text-white font-bold tabular-nums shrink-0">
                  {stop.durationSec.toFixed(3)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HoldStage({
  label,
  action,
  progress,
  tone,
  onStart,
  onStop,
}: {
  label: string;
  action: string;
  progress: number;
  tone: "amber" | "cyan";
  onStart: () => void;
  onStop: () => void;
}) {
  const button =
    tone === "amber"
      ? "bg-amber-500 hover:bg-amber-400 text-black"
      : "bg-cyan-400 hover:bg-cyan-300 text-black";
  const bar = tone === "amber" ? "bg-amber-400" : "bg-cyan-400";
  const text = tone === "amber" ? "text-amber-400" : "text-cyan-400";

  return (
    <div className="flex flex-col items-center w-full max-w-xs">
      <span className={`text-xs font-bold f-orbitron mb-2 uppercase ${text}`}>{label}</span>
      <button
        onPointerDown={onStart}
        onPointerUp={onStop}
        onPointerLeave={onStop}
        className={`w-full py-4 active:scale-95 font-black f-orbitron text-sm rounded-2xl shadow-lg transition-all uppercase select-none touch-none ${button}`}
      >
        {action}
      </button>
      <div className="w-full h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
        <div className={`h-full transition-all duration-75 ${bar}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function TapStage({
  label,
  action,
  labelClass,
  buttonClass,
  onClick,
}: {
  label: string;
  action: string;
  labelClass: string;
  buttonClass: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-xs font-bold f-orbitron mb-2 uppercase ${labelClass}`}>{label}</span>
      <button
        onClick={onClick}
        className={`px-8 py-3.5 active:scale-95 font-black f-orbitron text-sm rounded-2xl shadow-lg transition-all uppercase ${buttonClass}`}
      >
        {action}
      </button>
    </div>
  );
}
