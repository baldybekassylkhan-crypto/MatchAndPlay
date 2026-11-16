"use client";

import { MotionConfig } from "motion/react";

/** Если в системе включено «Уменьшить движение», анимации motion отключаются. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
