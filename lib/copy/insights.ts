/**
 * Insight copy catalogue (SPEC.md R9 — every user-facing string that makes a claim about
 * the user's body lives in lib/copy/, never inline in JSX, so the banned-word lint in
 * lib/copy/lint.test.ts can check it).
 *
 * The sentence bodies below are transcribed from docs/research/02-symptom-insights.md
 * §E.4 "Display strings (exact)". They are deliberately *not* paraphrased into something
 * friendlier: the wording is what keeps the cards descriptive rather than diagnostic
 * (§8.2 templates L1–L12, §8.4 structural rules).
 *
 * Three structural rules from §8.4 are encoded here rather than left to the caller:
 *   1. Every card states its denominator — `BASED_ON_CYCLES` is folded into every
 *      claim body, and the non-claim cards carry a cycle count of their own.
 *   2. Disconfirmation gets the same weight as confirmation — `DID_NOT_REPLICATE` and
 *      `NO_PATTERN` are first-class strings, not footnotes.
 *   3. Nothing is phrased as a prediction. Every string is past or present tense; there
 *      is no sentence here about how the user is going to feel.
 *
 * Lint note for agent D (SPEC.md §4.4): `INSIGHT_DISCLAIMER` is the one string in this
 * module that contains a banned substring ("diagnos"). It is disclaimer text — the exact
 * "not a diagnosis, and not a cause" sentence mandated by §E.4 — and is factored out into
 * its own export precisely so the allowlist can name it rather than exempting a whole
 * template. Nothing else in this file needs an exception.
 */
import type { SymptomId } from "@/lib/domain/types";
import { MIN_QUALIFYING_CYCLES_TO_CLAIM, W_PREMENSTRUAL } from "@/lib/engine/constants";

// ============================================================================
// Symptom labels
// ============================================================================

/**
 * Display labels for every symptom the app can log, in the lower-case, mid-sentence form
 * the §E.4 templates use for `{symptom}`. Use `capitalizedSymptomLabel` for the
 * sentence-initial `{Symptom}` slot.
 *
 * Deliberately plain nouns: no severity adjectives, no clinical groupings, nothing that
 * would let a label smuggle in a claim the statistics do not support (§8.3).
 */
export const SYMPTOM_LABELS: Record<SymptomId, string> = {
  cramps: "cramps",
  breast_tenderness: "breast tenderness",
  bloating: "bloating",
  headache: "headaches",
  fatigue: "fatigue",
  cravings: "food cravings",
  gi_change: "digestive changes",
  acne: "skin changes",
  irritability: "irritability",
  low_mood: "low mood",
  anxiety: "anxiety",
  emotional_sensitivity: "emotional sensitivity",
  sleep_change: "sleep changes",
  exercise_change: "exercise changes",
  focus_change: "focus changes",
  libido_change: "libido changes",
};

export function symptomLabel(id: SymptomId): string {
  return SYMPTOM_LABELS[id];
}

/** The same label with its first character upper-cased, for the `{Symptom}` slot. */
export function capitalizedSymptomLabel(id: SymptomId): string {
  const label = SYMPTOM_LABELS[id];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ============================================================================
// Shared fragments
// ============================================================================

/** §E.4, final line of both PRIMARY_* templates. Disclaimer text — see the lint note in
 * the module header. */
export const INSIGHT_DISCLAIMER =
  "This is a summary of what you recorded — not a diagnosis, and not a cause.";

/** §E.4, penultimate line of both PRIMARY_* templates, and §8.4 rule 1: no card exists
 * without its denominator. */
export function basedOnCycles(qualifyingCycles: number): string {
  return `Based on ${qualifyingCycles} cycles with enough days logged.`;
}

/** §E.4 LOGGING_CAVEAT / §8.2 template L12. Names the missingness dependency. */
export const LOGGING_CAVEAT = "How often you log affects what we can see here.";

/** §E.4 DID_NOT_REPLICATE / §8.2 template L6. Shown in the same card as the claim it
 * disconfirms, never hidden (§3.4 item 5). */
export const DID_NOT_REPLICATE = "This didn't hold in your most recent cycle.";

/** Number of days in the primary (premenstrual) window, used by the prose below. Read
 * from the constant so the sentence and the arithmetic cannot drift apart. */
const PREMENSTRUAL_WINDOW_DAYS = Math.abs(W_PREMENSTRUAL[1] - W_PREMENSTRUAL[2]) + 1;

// ============================================================================
// Primary cards — a pattern was found (§E.4 PRIMARY_PREMENSTRUAL / PRIMARY_POSTMENSTRUAL)
// ============================================================================

export interface PrimaryCardCounts {
  symptom: SymptomId;
  /** Cycles leaning in the reported direction. */
  k: number;
  /** Non-tie cycles in the sign test. */
  n: number;
  /** Cycles leaning the other way. */
  kOther: number;
  /** Qualifying cycles — the stated denominator. */
  nq: number;
}

export function primaryPremenstrualHeadline(symptom: SymptomId): string {
  return `${capitalizedSymptomLabel(symptom)} showed up more often before your period.`;
}

export function primaryPremenstrualBody({ symptom, k, n, kOther, nq }: PrimaryCardCounts): string {
  return (
    `You logged ${symptomLabel(symptom)} in the ${PREMENSTRUAL_WINDOW_DAYS} days before your ` +
    `period started in ${k} of your last ${n} complete cycles, and in ${kOther} of ${n} in ` +
    `the week after your period ended.\n\n` +
    `${basedOnCycles(nq)}\n${INSIGHT_DISCLAIMER}`
  );
}

export function primaryPostmenstrualHeadline(symptom: SymptomId): string {
  return `${capitalizedSymptomLabel(symptom)} showed up more often after your period than before it.`;
}

export function primaryPostmenstrualBody({ symptom, k, n, kOther, nq }: PrimaryCardCounts): string {
  return (
    `You logged ${symptomLabel(symptom)} in ${k} of your last ${n} complete cycles in the ` +
    `week after your period ended, and in ${kOther} of ${n} in the week before it started.\n\n` +
    `${basedOnCycles(nq)}\n${INSIGHT_DISCLAIMER}`
  );
}

// ============================================================================
// Detail expander (§E.4 DETAIL_EXPANDER / §8.2 template L2)
// ============================================================================

export interface DetailCounts {
  symptom: SymptomId;
  /** Days with the symptom in the premenstrual window, over days counted there. */
  a: number;
  A: number;
  /** Days with the symptom in the reference window, over days counted there. */
  b: number;
  B: number;
}

export function detailExpander({ symptom, a, A, b, B }: DetailCounts): string {
  return (
    `Days you logged ${symptomLabel(symptom)}:\n` +
    `  Week before period:      ${a} of ${A} days\n` +
    `  Week after period ended: ${b} of ${B} days`
  );
}

// ============================================================================
// Non-claim cards — all three are first-class, shippable cards
// ============================================================================

/** Headline for the not-enough-data card. Present tense, no promise about the future. */
export const NOT_ENOUGH_DATA_HEADLINE = "Not enough cycles yet";

/** §E.4 NOT_ENOUGH_DATA / §8.2 template L5. `n` is the number of cycles the user has
 * that count toward the floor. */
export function notEnoughData(n: number): string {
  return (
    `Not enough yet. We need at least ${MIN_QUALIFYING_CYCLES_TO_CLAIM} complete cycles ` +
    `with most days logged before we can tell a repeating pattern from coincidence. ` +
    `You have ${n}.`
  );
}

/** Headline for a descriptive-only card. States what was counted, claims nothing. */
export function descriptiveOnlyHeadline(symptom: SymptomId): string {
  return `${capitalizedSymptomLabel(symptom)} in the week before your period`;
}

/** §E.4 DESCRIPTIVE_ONLY. Counts, explicitly labelled as too few to be a pattern (§2.4,
 * the 3–4 qualifying-cycle tier). */
export function descriptiveOnly(symptom: SymptomId, k: number, n: number): string {
  return (
    `You logged ${symptomLabel(symptom)} in the week before your period in ${k} of your ` +
    `last ${n} cycles. That's too few cycles to tell whether this repeats.`
  );
}

/** Headline for the no-pattern card. */
export const NO_PATTERN_HEADLINE = "We didn't find a repeating pattern";

/**
 * §E.4 NO_PATTERN / §8.2 template L7. `m` is the number of things actually tested.
 * `qualifyingCycles` is appended per §8.4 rule 1 — an app that only ever surfaces
 * positives *is* the multiple-comparisons problem made visible, so this card ships with
 * the same denominator every other card carries.
 */
export function noPattern(m: number, qualifyingCycles: number): string {
  return (
    `We looked at ${m} things you track and didn't find a repeating pattern tied to your ` +
    `cycle. That's a normal result.\n\n${basedOnCycles(qualifyingCycles)}`
  );
}
