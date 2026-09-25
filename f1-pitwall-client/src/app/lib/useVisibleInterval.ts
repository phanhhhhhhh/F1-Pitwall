"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` on mount and then every `delayMs`, but only while the tab is visible. A
 * hidden tab stops polling, and becoming visible again runs `callback` at once before resuming
 * the interval, so the data is fresh the moment the user looks at it. This keeps a forgotten
 * tab from keeping the backend awake (and billing instance hours) around the clock.
 *
 * `callback` may change between renders; the latest one is always the one that runs.
 */
export function useVisibleInterval(callback: () => void, delayMs: number): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (id !== undefined) return;
      callbackRef.current();
      id = setInterval(() => callbackRef.current(), delayMs);
    };
    const stop = () => {
      clearInterval(id);
      id = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [delayMs]);
}
