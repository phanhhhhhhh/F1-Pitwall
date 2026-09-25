"use client";

import { LazyMotion } from "framer-motion";
import type { ReactNode } from "react";

// Animation features load after first paint, so pages ship only the tiny `m` core up front.
// domMax (not domAnimation) because layoutId shared-element transitions are used on
// login, profile and telemetry.
const loadFeatures = () => import("../lib/motion-features").then((mod) => mod.default);

export default function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
