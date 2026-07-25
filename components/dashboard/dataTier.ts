/**
 * Selects which dashboard layout to show, keyed off how many periods the user has ever
 * recorded (`cycles.length` — `lib/engine/cycles.ts`'s `buildCycles` returns one entry
 * per recorded period start, most-recent-first, the most recent one carrying
 * `status: 'in_progress'` until a next start is logged).
 *
 * This is deliberately keyed off the *count of period starts logged*, not off
 * `stats.completedCycleCount` (which is one lower whenever the most recent period is
 * still in progress — true for almost every real user on almost every day). "A user
 * with zero cycles, one cycle, and two cycles" (this agent's brief) reads most naturally
 * as "has logged 0/1/2 periods so far", and using the completed-only count would put a
 * user who just logged their very first period back in the "zero cycles" bucket, which
 * is the wrong empty state to show them. [choice]
 *
 * Every tier above 'two' gets the fully-populated dashboard — not because three cycles
 * unlocks anything special in the engine (the confidence vocabulary's own thresholds,
 * SPEC.md §4.3, are read from `PredictionResult.confidence`/`confidenceReason` directly,
 * never re-derived here) but because this module's only job is deciding when a
 * dedicated "here's what we can't tell you yet" screen is more honest than the ordinary
 * card layout with mostly-null fields in it.
 */
import type { Cycle } from "@/lib/domain/types";

export type DashboardDataTier = "empty" | "one" | "two" | "established";

export function selectDataTier(cycles: readonly Cycle[]): DashboardDataTier {
  if (cycles.length === 0) return "empty";
  if (cycles.length === 1) return "one";
  if (cycles.length === 2) return "two";
  return "established";
}
