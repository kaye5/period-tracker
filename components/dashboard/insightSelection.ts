/**
 * Picks which `Insight` (from `lib/engine/insights.ts`, agent C) fills the dashboard's
 * one "personal pattern" primary-card slot, and which are relegated to the secondary
 * "symptoms" card behind the "more" affordance.
 *
 * `buildInsightsWithDiagnostics` returns Insight[] already in a deliberate order (§E.3):
 * this module does not re-rank by its own notion of importance — it trusts the engine's
 * order and only decides the split point between "the one headline card" and "the rest".
 */
import type { Insight } from "@/lib/domain/types";

export interface PersonalPatternSelection {
  /** The single insight shown on the primary "personal pattern" card, or null when the
   * engine returned no insights at all (should not happen in practice — the engine
   * always returns at least a not-enough-data/no-pattern card — but this module does
   * not assume an internal invariant of a file it does not own). */
  primary: Insight | null;
  /** Every other insight, in the engine's own order, for the secondary "symptoms"
   * section. */
  secondary: Insight[];
}

export function selectPersonalPatternInsight(insights: readonly Insight[]): PersonalPatternSelection {
  if (insights.length === 0) return { primary: null, secondary: [] };
  const [primary, ...secondary] = insights;
  return { primary, secondary };
}
