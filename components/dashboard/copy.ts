/**
 * Dashboard-owned copy catalogue (SPEC.md R9: "all user-facing strings that make a claim
 * about the user's body live in `lib/copy/`, not in components. A lint test runs over
 * the catalogue and fails on banned words... Strings inline in JSX bypass the lint and
 * are therefore forbidden for any such claim.").
 *
 * This agent owns only `app/(dashboard)/page.tsx` and `components/dashboard/**` — it
 * cannot create a file under `lib/copy/` (owned by agents F/C/D per SPEC.md §2) without
 * writing into territory it does not own. Every dashboard-specific string that makes a
 * claim about the user's body or their recorded data therefore lives in *this* file
 * instead, kept out of JSX for exactly the reason R9 gives, and is linted by this
 * module's own `copy.test.ts` against the identical SPEC.md §4.4 banned-word list agent
 * D's `lib/copy/lint.test.ts` runs — that file only globs `lib/copy/*.ts`, so it cannot
 * see this one; this module's own test is how the same bar is met here. (Noted in this
 * agent's final report as a suggestion: fold `components/dashboard/copy.ts` into agent
 * D's glob, or promote it to `lib/copy/dashboard.ts`, next time file ownership is
 * revisited.)
 *
 * Numbers are always supplied by the caller (the engine's own output), never invented
 * here — the same discipline `lib/copy/general.ts`'s `CONFIDENCE_REASONS` uses.
 */

// ============================================================================
// Header status card
// ============================================================================

export function periodExpectedHeadline(rangeText: string): string {
  return `Period expected between ${rangeText}`;
}

export function cycleDayHeadline(day: number): string {
  return `Day ${day} of your current cycle`;
}

export function lastPeriodStarted(dateText: string): string {
  return `Last period started ${dateText}`;
}

export function typicalCycleRange(lowDays: number, highDays: number): string {
  return `Your recorded cycles have run ${lowDays} to ${highDays} days long recently`;
}

export function completedCyclesUsed(n: number): string {
  return `This range is based on your last ${n} completed cycle${n === 1 ? "" : "s"}.`;
}

export const NO_PERIOD_LOGGED_YET =
  "You haven't recorded a period start yet, so there's nothing to predict from.";

// ============================================================================
// Current-status card
// ============================================================================

export function currentStatusBody(dayCountText: string, lastStartText: string): string {
  return `You're ${dayCountText} into your current cycle. ${lastStartText}.`;
}

export const CURRENT_STATUS_HEADLINE = "Where you are right now";

// ============================================================================
// Next-period card (secondary framing of the header, as its own primary card)
// ============================================================================

export const NEXT_PERIOD_HEADLINE_FALLBACK = "We can't estimate a range yet";

// ============================================================================
// Empty / early states (zero, one, two recorded periods)
// ============================================================================

export const EMPTY_TIER = {
  heading: "Let's start recording",
  body: "Nothing has been logged yet, so there's nothing this app can tell you about your cycle yet. Log your period when it starts, and this page will fill in from there.",
};

export const ONE_CYCLE_TIER = {
  heading: "One period recorded so far",
  body: "With a single period recorded, there isn't yet a completed cycle to measure a length from — that needs a second recorded period start. Keep logging, and a range will appear here once there's something to base it on.",
};

export const TWO_CYCLES_TIER = {
  heading: "Two periods recorded so far",
  body: "There's one completed cycle now, which is enough for an early, wide estimate below — but not yet enough to say how consistent your cycle is. That starts to fill in at three completed cycles, and becomes more informative from six.",
};

// ============================================================================
// Section headings and controls
// ============================================================================

export const SECTION_HEADINGS = {
  personalPattern: "Your pattern",
  more: "More about your data",
  periodDuration: "Period length",
  flowPattern: "Flow by day of period",
  cycleVariation: "Cycle variation",
  symptoms: "What you've logged",
  fertileWindow: "Estimated fertile window",
  performance: "How recent predictions compared",
  healthNotes: "Notes worth a look",
} as const;

export const VIEW_RECORDS_LABEL = "View the records behind this";
export const WHY_AM_I_SEEING_THIS_LABEL = "Why am I seeing this?";
export const DISMISS_LABEL = "Dismiss";
export const SHOW_MORE_LABEL = "Show more";
export const SHOW_LESS_LABEL = "Show less";
export const LOG_TODAY_LABEL = "Log today";

// ============================================================================
// Skip-prompt banner ("did you miss logging a period around {date}?" —
// 01-cycle-prediction.md §5.3, "the single highest-value affordance in the whole build")
// ============================================================================

export function missedPeriodPrompt(dateText: string): string {
  return `Did you miss logging a period around ${dateText}? If so, we can add it to your history.`;
}

export const SKIP_PROMPT_YES_LABEL = "Yes, add it";
export const SKIP_PROMPT_NO_LABEL = "No, that's not right";

// ============================================================================
// Cycle-variation secondary card, when there isn't yet enough data for it
// ============================================================================

export function cycleVariationNotYet(haveCycles: number, needCycles: number): string {
  return `Once you have ${needCycles} recorded cycles (you have ${haveCycles}), this will show how much your cycle length varies from one cycle to the next.`;
}

// ============================================================================
// Period-duration secondary card
// ============================================================================

export function periodDurationSummary(lowDays: number, highDays: number, n: number): string {
  const rangeText = lowDays === highDays ? `${lowDays} days` : `${lowDays} to ${highDays} days`;
  return `Your last ${n} recorded period${n === 1 ? " lasted" : "s lasted"} ${rangeText}.`;
}

// ============================================================================
// Symptom-frequency secondary card
// ============================================================================

export function symptomFrequencySummary(
  label: string,
  occurrences: number,
  knownDays: number,
): string {
  if (knownDays === 0) return `${label}: not enough logged days to say.`;
  return `${label}: logged on ${occurrences} of ${knownDays} days you recorded an answer for.`;
}

// ============================================================================
// Prediction-performance secondary card (never a single accuracy percentage —
// SPEC.md §8.2 / lib/engine/performance.ts's own module docstring)
// ============================================================================

export function lastPredictionError(daysLate: number): string {
  if (daysLate === 0) return "Your last prediction landed on the day your period actually started.";
  const direction = daysLate > 0 ? "later" : "earlier";
  return `Your last prediction was off by ${Math.abs(daysLate)} day${Math.abs(daysLate) === 1 ? "" : "s"} — your period started ${direction} than the range's center.`;
}

export function typicalRecentMiss(days: number): string {
  return `Over your recent resolved predictions, the typical miss has been about ${days} day${days === 1 ? "" : "s"}.`;
}

export function windowHitRateSummary(hits: number, n: number): string {
  return `The shown range has included the actual start date in ${hits} of your last ${n} resolved predictions.`;
}

export const NOT_ENOUGH_RESOLVED_PREDICTIONS =
  "There aren't enough resolved predictions yet to show how this has been going.";

// ============================================================================
// Fertility card confidence framing — the estimate itself and its disclaimer come
// straight from `FertilityEstimate` (lib/engine/fertility.ts), never rebuilt here; this
// is only the card's heading.
// ============================================================================

export const FERTILE_WINDOW_HEADLINE = "Estimated fertile window";
