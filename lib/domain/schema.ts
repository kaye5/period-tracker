/**
 * Zod schemas mirroring lib/domain/types.ts, for boundary validation — parsing data
 * coming from the API layer (app/api/**), a browser form, or straight out of the
 * database (SPEC.md R2/R7: dayLogs is the sole source of recorded truth and must never be
 * silently coerced or dropped, so every boundary crossing is validated explicitly).
 *
 * Every schema here is named identically to its type in types.ts with a `Schema` suffix.
 * Keep the two files in lockstep: a field added to one must be added to the other.
 */
import { z } from "zod";
import { isValid as isValidCivilDate, type CivilDate } from "@/lib/date/civil";
import { MAX_CYCLE, MIN_CYCLE } from "@/lib/engine/constants";

// ============================================================================
// ---------- self-reported number bounds ----------
// ============================================================================
//
// These live here, at the validation boundary, rather than in the onboarding form that
// first used them: they are domain rules, and a rule that only the form knows is a rule
// the API does not enforce. `components/onboarding/onboardingAnswers.ts` re-exports them,
// so every existing caller is unchanged.

/** MIN_CYCLE/MAX_CYCLE (`lib/engine/constants.ts`, cited to S5/S15) as the outer bounds
 * for what a user can report as their typical cycle length — anything outside is
 * discarded by the engine anyway, so rejecting it at entry gives an honest reason instead
 * of a silently-ignored answer later. */
export const CYCLE_LENGTH_BOUNDS = { min: MIN_CYCLE, max: MAX_CYCLE };

/** No research-cited bound exists for period *duration* specifically. [choice] — wide
 * enough to include prolonged bleeding (which the health-awareness rules react to, not
 * this form) while still catching obvious data-entry mistakes (e.g. "45"). The upper
 * bound is load-bearing beyond data hygiene: `components/calendar/dayIndicators.ts`
 * paints "period expected to continue" days from this number, so an unbounded value
 * marks most of the month as an expected period. */
export const PERIOD_DURATION_BOUNDS = { min: 1, max: 14 };

export function isValidCycleLengthDays(n: number): boolean {
  return (
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= CYCLE_LENGTH_BOUNDS.min &&
    n <= CYCLE_LENGTH_BOUNDS.max
  );
}

export function isValidPeriodDurationDays(n: number): boolean {
  return (
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= PERIOD_DURATION_BOUNDS.min &&
    n <= PERIOD_DURATION_BOUNDS.max
  );
}

// ============================================================================
// ---------- dates ----------
// ============================================================================

/** Validates a "YYYY-MM-DD" string that names a real Gregorian calendar date, per
 * lib/date/civil.ts's isValid — the single source of truth for what counts as valid. */
export const civilDateSchema = z
  .string()
  .refine(isValidCivilDate, { message: "must be a valid YYYY-MM-DD calendar date" })
  .transform((s) => s as CivilDate);

// ============================================================================
// ---------- recorded data ----------
// ============================================================================

export const bleedingKindSchema = z.enum(["none", "spotting", "menstrual"]);
export const flowLevelSchema = z.enum(["spotting", "light", "medium", "heavy", "very_heavy"]);
export const bleedingContextSchema = z.enum([
  "period",
  "intermenstrual",
  "postcoital",
  "unexpected",
]);
export const painSeveritySchema = z.enum(["none", "mild", "moderate", "severe"]);
export const clotSizeSchema = z.enum(["none", "small", "ge_2_5cm"]);
export const periodBoundarySchema = z.enum(["start", "end"]);

export const painSiteSchema = z.enum([
  "lower_abdomen",
  "back",
  "legs",
  "pelvis",
  "head",
  "other",
]);

export const interferenceSchema = z.enum([
  "work_or_school",
  "sleep",
  "exercise",
  "social",
  "household",
]);

export const symptomIdSchema = z.enum([
  "cramps",
  "breast_tenderness",
  "bloating",
  "headache",
  "fatigue",
  "cravings",
  "gi_change",
  "acne",
  "irritability",
  "low_mood",
  "anxiety",
  "emotional_sensitivity",
  "sleep_change",
  "exercise_change",
  "focus_change",
  "libido_change",
]);

export const moodIdSchema = z.enum([
  "calm",
  "happy",
  "energetic",
  "irritable",
  "sad",
  "anxious",
  "sensitive",
  "low",
]);

export const hormonalMethodKindSchema = z.enum([
  "combined_pill",
  "progestin_only_pill",
  "patch",
  "ring",
  "hormonal_iud",
  "implant",
  "injection",
]);

export const fastestProductChangeHoursSchema = z.union([
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
  z.literal(4),
  z.literal(8),
]);

export const fertilityObservationsSchema = z.object({
  cervicalMucus: z.enum(["dry", "sticky", "creamy", "watery", "egg_white"]).optional(),
  ovulationPain: z.boolean().optional(),
  bbtCelsius: z.number().optional(),
  opkResult: z.enum(["negative", "positive"]).optional(),
});

export const dayLogSchema = z.object({
  date: civilDateSchema,
  bleeding: bleedingKindSchema,
  flow: flowLevelSchema.optional(),
  bleedingContext: bleedingContextSchema.optional(),
  periodBoundary: periodBoundarySchema.optional(),
  clots: clotSizeSchema.optional(),
  productChanges: z.number().int().min(0).optional(),
  fastestProductChangeHours: fastestProductChangeHoursSchema.optional(),
  doubleProtection: z.boolean().optional(),
  nightChange: z.boolean().optional(),
  leakThrough: z.boolean().optional(),
  pain: z.object({
    severity: painSeveritySchema,
    sites: z.array(painSiteSchema).optional(),
    interferedWith: z.array(interferenceSchema).optional(),
    painkillerDidNotHelp: z.boolean().optional(),
  }),
  symptoms: z.array(symptomIdSchema),
  nothingToReport: z.boolean().optional(),
  mood: z.array(moodIdSchema).optional(),
  notes: z.string().optional(),
  fertility: fertilityObservationsSchema.optional(),
  loggedAt: civilDateSchema,
});

// ============================================================================
// ---------- profile ----------
// ============================================================================

export const lifeStageStateSchema = z.object({
  pregnant: z.boolean(),
  deliveryDate: civilDateSchema.optional(),
  breastfeeding: z.boolean(),
  hormonalMethod: z
    .object({ kind: hormonalMethodKindSchema, startedOn: civilDateSchema })
    .optional(),
  copperIudInsertedOn: civilDateSchema.optional(),
  stoppedHormonalOn: civilDateSchema.optional(),
  perimenopauseSelfDeclared: z.boolean(),
  menopauseSelfDeclared: z.boolean(),
  knownIrregular: z.boolean(),
  preferNotToSay: z.boolean(),
});

export const settingsSchema = z.object({
  fertilityEnabled: z.boolean(),
  tierCSymptomsEnabled: z.boolean(),
  healthAwarenessEnabled: z.boolean(),
  notifications: z.object({
    periodReminder: z.boolean(),
    fertileReminder: z.boolean(),
    symptomReminder: z.boolean(),
    medicationReminder: z.boolean(),
    loggingReminder: z.boolean(),
    healthAwareness: z.boolean(),
    privateWording: z.boolean(),
  }),
  locale: z.enum(["en-US", "en-GB"]),
});

export const profileSchema = z.object({
  birthYear: z.number().int().optional(),
  menarcheYear: z.number().int().optional(),
  // Bounded, not bare numbers: these are free-typed into a number input, whose `min`/
  // `max` attributes the browser does not enforce on a typed value, and both feed the
  // calendar and the engine directly.
  reportedTypicalCycleLength: z
    .number()
    .int()
    .min(CYCLE_LENGTH_BOUNDS.min)
    .max(CYCLE_LENGTH_BOUNDS.max)
    .optional(),
  reportedTypicalPeriodDays: z
    .number()
    .int()
    .min(PERIOD_DURATION_BOUNDS.min)
    .max(PERIOD_DURATION_BOUNDS.max)
    .optional(),
  reportedRegularity: z.enum(["consistent", "variable", "unknown"]).optional(),
  state: lifeStageStateSchema,
  settings: settingsSchema,
});

// ============================================================================
// ---------- derived (validated at the persistence boundary: predictions,
// ---------- decisions and calibration collections are all read back through these) ----------
// ============================================================================

export const cycleStatusSchema = z.enum([
  "ok",
  "gap_unknown",
  "skip_suspected",
  "excluded_by_user",
  "in_progress",
]);

export const bleedingEpisodeSchema = z.object({
  startDate: civilDateSchema,
  endDate: civilDateSchema.nullable(),
  menstrualDays: z.array(civilDateSchema),
  spottingDays: z.array(civilDateSchema),
  durationDays: z.number().int().nullable(),
  endInferred: z.boolean(),
});

export const cycleSchema = z.object({
  index: z.number().int(),
  startDate: civilDateSchema,
  nextStartDate: civilDateSchema.nullable(),
  lengthDays: z.number().int().nullable(),
  status: cycleStatusSchema,
  statusReason: z.string().optional(),
  impliedSplitCount: z.number().int().optional(),
  weight: z.number(),
  episode: bleedingEpisodeSchema,
});

export const predictionConfidenceSchema = z.enum([
  "not_enough_information",
  "early_estimate",
  "limited",
  "more_consistent",
]);

export const predictionResultSchema = z.object({
  kind: z.enum(["none", "population_estimate", "personal"]),
  center: civilDateSchema.nullable(),
  low: civilDateSchema.nullable(),
  high: civilDateSchema.nullable(),
  predictedLengthDays: z.number().nullable(),
  confidence: predictionConfidenceSchema,
  confidenceReason: z.string(),
  basis: z.object({
    usableCycles: z.number().int(),
    windowCycles: z.number().int(),
    effectiveN: z.number(),
    sigma: z.number(),
    halfWidthDays: z.number(),
    calibrationFactor: z.number(),
  }),
  suppressed: z
    .object({
      reason: z.enum(["pregnant", "postpartum", "insufficient_data", "hormonal_method"]),
    })
    .optional(),
});

export const fertilityEstimateSchema = z.object({
  ovulationLow: civilDateSchema,
  ovulationHigh: civilDateSchema,
  fertileLow: civilDateSchema,
  fertileHigh: civilDateSchema,
  confidenceNote: z.string(),
  disclaimer: z.string(),
});

export const insightSchema = z.object({
  id: z.string(),
  headline: z.string(),
  body: z.string(),
  detail: z.string(),
  supportingCycles: z.number().int(),
  supportingDates: z.array(civilDateSchema),
  replicatedLastCycle: z.boolean(),
  kind: z.enum(["cycle", "duration", "symptom", "flow", "performance"]),
});

export const healthMessageSchema = z.object({
  ruleId: z.string(),
  severity: z.enum(["informational", "discuss_with_clinician", "seek_urgent_care"]),
  message: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  sourceThreshold: z.string(),
  dismissible: z.boolean(),
});

export const statSummarySchema = z.object({
  center: z.number(),
  low: z.number(),
  high: z.number(),
  n: z.number().int(),
});

export const userDecisionsSchema = z.object({
  excludedCycles: z.record(
    z.string(),
    z.object({ reason: z.string(), decidedOn: civilDateSchema }),
  ),
  skipPrompts: z.record(
    z.string(),
    z.object({
      confirmed: z.boolean(),
      inferredStartDate: civilDateSchema.optional(),
      decidedOn: civilDateSchema,
    }),
  ),
});

export const calibrationStateSchema = z.object({
  cumulativeAdjustment: z.number(),
  recentCoverage: z.array(z.boolean()),
});

export const engineOutputSchema = z.object({
  episodes: z.array(bleedingEpisodeSchema),
  cycles: z.array(cycleSchema),
  prediction: predictionResultSchema,
  fertility: fertilityEstimateSchema.optional(),
  stats: z.object({
    completedCycleCount: z.number().int(),
    typicalCycleLength: statSummarySchema.nullable(),
    figoRange: statSummarySchema.nullable(),
    medianCycleLengthDifference: z.number().nullable(),
    regularityBand: z
      .enum(["very_consistent", "typical_variation", "high_variation"])
      .nullable(),
    periodDuration: statSummarySchema.nullable(),
    heavyFlowDayCount: z.number().int(),
  }),
  insights: z.array(insightSchema),
  healthMessages: z.array(healthMessageSchema),
  performance: z.object({
    lastSignedErrorDays: z.number().nullable(),
    rollingMedianAbsoluteErrorDays: z.number().nullable(),
    windowHitRate: statSummarySchema.nullable(),
  }),
});
