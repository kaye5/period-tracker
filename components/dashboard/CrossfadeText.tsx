"use client";

import { AnimatePresence, motion } from "motion/react";

/** Crossfades when `text` changes (e.g. the cycle day resetting after "Period started
 * today"), so the change is noticed rather than silently swapped. Under reduced motion
 * MotionConfig drops the y-offset; the short opacity fade remains. */
export function CrossfadeText({ text, className }: { text: string; className?: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={text}
        className={className}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}
