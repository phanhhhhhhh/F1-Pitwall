"use client";

import { useEffect, useState } from "react";

/**
 * Animated count-up for stat reveals. Eases out over `duration` ms after `delay`.
 * Respects prefers-reduced-motion by snapping to target.
 */
export function useCountUp(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) { setValue(0); return; }
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (start === null) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}
