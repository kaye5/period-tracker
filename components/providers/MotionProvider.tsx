"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** App-wide Motion defaults: every motion/react animation honours the OS reduce-motion
 * setting (transforms and layout animations are skipped; opacity still fades). */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
