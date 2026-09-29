/**
 * Pure state/logic for the onboarding wizard (components/onboarding/OnboardingWizard.tsx).
 * Kept free of React and I/O so it can be unit tested directly (SPEC.md R10) — the
 * wizard component itself is a thin renderer over this module plus two `fetch` calls on
 * submit (PUT /api/profile, POST /api/day-logs).
 *
 * Two things this module must never do (SPEC.md's U1 brief, restated because it is the
 * easiest rule in this file to violate by accident):
 *   1. Never default a cycle length to 28, or a period duration to any guessed number.
 *      "I don't know" is a real, first-class answer that leaves the corresponding
 *      `Profile` field `undefined` — never a fallback value.
 *   2. Never assume the user's reproductive goal. `lib/domain/types.ts`'s `LifeStageState`
 *      (fixed by SPEC.md §3, owned by agent F) has no "trying to conceive" /
 *      "trying to avoid pregnancy" field, and this module does not invent one — see this
 *      agent's final report for why that PRD-listed question is deliberately not asked.
 */
import type {
  CivilDate,
  DayLog,
  HormonalMethodKind,
  Profile,
} from "@/lib/domain/types";

// ============================================================================
// Working draft state
// ============================================================================

export type Regularity = "consistent" | "variable" | "unknown";
export type Locale = "en-US" | "en-GB";

export interface OnboardingAnswers {
  // ---- initial prediction inputs ----
  /** null = "I'll add this later" (skipped), not "unknown zero". */
  lastPeriodStart: CivilDate | null;
  cycleLengthKnown: boolean;
  /** Only meaningful when cycleLengthKnown is true. */
  cycleLengthDays: number | null;
  periodDurationKnown: boolean;
  periodDurationDays: number | null;
  /** Default 'unknown' — never defaults to 'consistent' (SPEC.md R5's spirit applies to
   * regularity as much as to a bare day count). */
  regularity: Regularity;

  // ---- optional demographic context (Profile top-level, both skippable) ----
  birthYear: number | null;
  menarcheYear: number | null;

  // ---- special states (LifeStageState) ----
  /** A single opt-out for the whole special-states section. When true, every field
   * below is ignored by buildProfilePatch regardless of its current value — see that
   * function's comment. */
  specialStatesPreferNotToSay: boolean;
  pregnant: boolean;
  postpartum: boolean;
  deliveryDate: CivilDate | null;
  breastfeeding: boolean;
  usingHormonalMethod: boolean;
  hormonalMethodKind: HormonalMethodKind | null;
  hormonalMethodStartedOn: CivilDate | null;
  usingCopperIud: boolean;
  copperIudInsertedOn: CivilDate | null;
  recentlyStoppedHormonal: boolean;
  stoppedHormonalOn: CivilDate | null;
  perimenopause: boolean;
  menopause: boolean;
  knownIrregular: boolean;

  // ---- fertility opt-in (Settings.fertilityEnabled) ----
  /** DEFAULT false. A genuine opt-in — see FERTILITY_DISCLAIMER in lib/copy/general.ts,
   * always rendered adjacent to this question in the wizard. */
  fertilityEnabled: boolean;

  // ---- locale (Settings.locale; gates URG-02 wording per 03-additional-data-and-
  // safety.md). Fixed to en-US: the region picker was removed (personal/internal use),
  // so this is no longer user-selectable, only carried through the data model. ----
  locale: Locale;
}

/** The only defaults this wizard ever assumes: everything off, everything unknown,
 * nothing guessed. `locale` is fixed at en-US (the region picker was removed); the
 * parameter is kept so callers/tests can still construct other locales if ever needed. */
export function initialAnswers(defaultLocale: Locale = "en-US"): OnboardingAnswers {
  return {
    lastPeriodStart: null,
    cycleLengthKnown: false,
    cycleLengthDays: null,
    periodDurationKnown: false,
    periodDurationDays: null,
    regularity: "unknown",
    birthYear: null,
    menarcheYear: null,
    specialStatesPreferNotToSay: false,
    pregnant: false,
    postpartum: false,
    deliveryDate: null,
    breastfeeding: false,
    usingHormonalMethod: false,
    hormonalMethodKind: null,
    hormonalMethodStartedOn: null,
    usingCopperIud: false,
    copperIudInsertedOn: null,
    recentlyStoppedHormonal: false,
    stoppedHormonalOn: null,
    perimenopause: false,
    menopause: false,
    knownIrregular: false,
    fertilityEnabled: false,
    locale: defaultLocale,
  };
}

/**
 * Prefills a revisit to /onboarding from whatever profile already exists, so re-running
 * onboarding does not throw away prior answers (SPEC.md R7's "never silently discard
 * user data" spirit — this isn't recorded dayLogs data, but the principle still applies
 * to a form the user already filled in once).
 *
 * `lastPeriodStart` is deliberately NOT reconstructed here: SPEC.md R2 makes `dayLogs`
 * the sole source of that truth, and `Profile` has no field for it. A revisit leaves
 * this question blank rather than guessing from derived data.
 */
export function answersFromProfile(profile: Profile): OnboardingAnswers {
  const base = initialAnswers(profile.settings.locale);
  const s = profile.state;
  return {
    ...base,
    cycleLengthKnown: profile.reportedTypicalCycleLength !== undefined,
    cycleLengthDays: profile.reportedTypicalCycleLength ?? null,
    periodDurationKnown: profile.reportedTypicalPeriodDays !== undefined,
    periodDurationDays: profile.reportedTypicalPeriodDays ?? null,
    regularity: profile.reportedRegularity ?? "unknown",
    birthYear: profile.birthYear ?? null,
    menarcheYear: profile.menarcheYear ?? null,
    specialStatesPreferNotToSay: s.preferNotToSay,
    pregnant: s.pregnant,
    postpartum: s.deliveryDate !== undefined,
    deliveryDate: s.deliveryDate ?? null,
    breastfeeding: s.breastfeeding,
    usingHormonalMethod: s.hormonalMethod !== undefined,
    hormonalMethodKind: s.hormonalMethod?.kind ?? null,
    hormonalMethodStartedOn: s.hormonalMethod?.startedOn ?? null,
    usingCopperIud: s.copperIudInsertedOn !== undefined,
    copperIudInsertedOn: s.copperIudInsertedOn ?? null,
    recentlyStoppedHormonal: s.stoppedHormonalOn !== undefined,
    stoppedHormonalOn: s.stoppedHormonalOn ?? null,
    perimenopause: s.perimenopauseSelfDeclared,
    menopause: s.menopauseSelfDeclared,
    knownIrregular: s.knownIrregular,
    fertilityEnabled: profile.settings.fertilityEnabled,
    locale: profile.settings.locale,
  };
}

// ============================================================================
// Validation bounds
// ============================================================================

/** The self-reported number bounds and their validators now live at the validation
 * boundary (`lib/domain/schema.ts`), where the API enforces them too — a bound only the
 * form knows is a bound the API does not apply. Re-exported here so every existing
 * caller keeps its import path and there is still exactly one definition. */
export {
  CYCLE_LENGTH_BOUNDS,
  PERIOD_DURATION_BOUNDS,
  isValidCycleLengthDays,
  isValidPeriodDurationDays,
} from "@/lib/domain/schema";

// ============================================================================
// Profile assembly
// ============================================================================

/**
 * Merges the wizard's answers into `base` (either DEFAULT_PROFILE or the profile the
 * wizard was prefilled from) to produce the `Profile` to PUT to /api/profile.
 *
 * `specialStatesPreferNotToSay` is enforced here, not just in the UI: whenever it is
 * true, every other special-state field is written as its conservative default
 * regardless of what the working draft happens to hold (e.g. a value entered before the
 * user backtracked and chose "prefer not to say"). This is defence in depth for R7 —
 * "prefer not to say" must never leak a half-answered state into storage.
 */
export function buildProfilePatch(answers: OnboardingAnswers, base: Profile): Profile {
  const preferNotToSay = answers.specialStatesPreferNotToSay;

  return {
    ...base,
    birthYear: answers.birthYear ?? undefined,
    menarcheYear: answers.menarcheYear ?? undefined,
    reportedTypicalCycleLength:
      answers.cycleLengthKnown && answers.cycleLengthDays !== null
        ? answers.cycleLengthDays
        : undefined,
    reportedTypicalPeriodDays:
      answers.periodDurationKnown && answers.periodDurationDays !== null
        ? answers.periodDurationDays
        : undefined,
    reportedRegularity: answers.regularity,
    state: {
      pregnant: !preferNotToSay && answers.pregnant,
      deliveryDate:
        !preferNotToSay && answers.postpartum && answers.deliveryDate !== null
          ? answers.deliveryDate
          : undefined,
      breastfeeding: !preferNotToSay && answers.breastfeeding,
      hormonalMethod:
        !preferNotToSay &&
        answers.usingHormonalMethod &&
        answers.hormonalMethodKind !== null &&
        answers.hormonalMethodStartedOn !== null
          ? { kind: answers.hormonalMethodKind, startedOn: answers.hormonalMethodStartedOn }
          : undefined,
      copperIudInsertedOn:
        !preferNotToSay && answers.usingCopperIud && answers.copperIudInsertedOn !== null
          ? answers.copperIudInsertedOn
          : undefined,
      stoppedHormonalOn:
        !preferNotToSay && answers.recentlyStoppedHormonal && answers.stoppedHormonalOn !== null
          ? answers.stoppedHormonalOn
          : undefined,
      perimenopauseSelfDeclared: !preferNotToSay && answers.perimenopause,
      menopauseSelfDeclared: !preferNotToSay && answers.menopause,
      knownIrregular: !preferNotToSay && answers.knownIrregular,
      preferNotToSay,
    },
    settings: {
      ...base.settings,
      fertilityEnabled: answers.fertilityEnabled,
      locale: answers.locale,
    },
  };
}

/**
 * Builds the DayLog for "first day of your most recent period", or `null` if the user
 * skipped that question. This is the one onboarding answer that does NOT live on
 * `Profile` — SPEC.md R2 makes `dayLogs` the sole source of recorded truth, so the
 * wizard POSTs this separately to /api/day-logs rather than folding it into the profile
 * PUT. Minimal-but-valid: `pain.severity: 'none'` and `symptoms: []` are not claims that
 * nothing happened that day, only the schema's required shape for a day log that only
 * asserts a period start.
 */
export function buildInitialDayLog(answers: OnboardingAnswers, today: CivilDate): DayLog | null {
  if (answers.lastPeriodStart === null) return null;
  return {
    date: answers.lastPeriodStart,
    bleeding: "menstrual",
    periodBoundary: "start",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: today,
  };
}
