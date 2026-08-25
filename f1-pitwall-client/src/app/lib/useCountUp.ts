"use client";

import { useEffect, useState } from "react";

/**
 * Animated count-up for stat reveals. Eases out over `duration` ms after `delay`.
 * Respects prefers-reduced-motion by snapping to target.
 */
export function useCountUp(target: number, duration = 900, delay = 0): number {
  const [value, setValue] = useState(0);
  const [prevTarget, setPrevTarget] = useState(target);

  // Render-phase adjustment (the React-endorsed alternative to a synchronous
  // setState in an effect): reset to 0 when the target drops, or snap straight
  // to the target when the user prefers reduced motion.
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  if (prevTarget !== target) {
    setPrevTarget(target);
    if (!target || prefersReducedMotion) setValue(target);
  }

  useEffect(() => {
    if (!target || prefersReducedMotion) return;
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
  }, [target, duration, delay, prefersReducedMotion]);
  return value;
}
