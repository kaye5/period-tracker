/**
 * Domain type contracts. Transcribed verbatim from SPEC.md §3 — these signatures are
 * fixed; every other agent codes against them. Types the spec names but does not spell
 * out (PainSite, Interference, SymptomId, MoodId, HormonalMethodKind,
 * FertilityObservations, UserDecisions, CalibrationState, EngineOutput, and the
 * statistic wrapper) are added below, grouped separately and clearly marked.
 */

// ============================================================================
// ---------- dates ----------
// ============================================================================

export type { CivilDate } from "@/lib/date/civil";
import type { CivilDate } from "@/lib/date/civil";

// ============================================================================
// ---------- recorded data ----------
// ============================================================================

export type BleedingKind = "none" | "spotting" | "menstrual";
export type FlowLevel = "spotting" | "light" | "medium" | "heavy" | "very_heavy";
export type BleedingContext = "period" | "intermenstrual" | "postcoital" | "unexpected";
export type PainSeverity = "none" | "mild" | "moderate" | "severe";
export type ClotSize = "none" | "small" | "ge_2_5cm"; // "quarter or larger" = ge_2_5cm

/**
 * Where pain is located. Not itemised in SPEC.md §3; kept intentionally small and
 * anatomically neutral (no diagnostic categories) per SPEC.md §4.4's banned-word lint.
 */
export type PainSite =
  | "lower_abdomen"
  | "back"
  | "legs"
  | "pelvis"
  | "head"
  | "other";

/** What the pain interfered with — used for WaLIDD-style functional-impact framing
 * (02-symptom-insights.md §6) without asserting a severity verdict. */
export type Interference = "work_or_school" | "sleep" | "exercise" | "social" | "household";

/**
 * The default symptom panel plus the opt-in Tier C set, per 02-symptom-insights.md
 * §E.2. Tier A (default on): cramps, breast_tenderness, bloating, headache, fatigue,
 * cravings, gi_change, acne. Tier B (direction discovered, never assumed): irritability,
 * low_mood, anxiety, emotional_sensitivity. Tier C (opt-in, settings.tierCSymptomsEnabled):
 * sleep_change, exercise_change, focus_change, libido_change.
 */
export type SymptomId =
  | "cramps"
  | "breast_tenderness"
  | "bloating"
  | "headache"
  | "fatigue"
  | "cravings"
  | "gi_change"
  | "acne"
  | "irritability"
  | "low_mood"
  | "anxiety"
  | "emotional_sensitivity"
  | "sleep_change"
  | "exercise_change"
  | "focus_change"
  | "libido_change";

/** Free-text-free mood labels; kept short and non-diagnostic. */
export type MoodId =
  | "calm"
  | "happy"
  | "energetic"
  | "irritable"
  | "sad"
  | "anxious"
  | "sensitive"
  | "low";

/** The kind of hormonal method in use, for LifeStageState.hormonalMethod.kind. */
export type HormonalMethodKind =
  | "combined_pill"
  | "progestin_only_pill"
  | "patch"
  | "ring"
  | "hormonal_iud"
  | "implant"
  | "injection";

/**
 * Fertility-related observations, only ever present on a DayLog when
 * settings.fertilityEnabled is true. Calendar-only in this build (no BBT/LH device
 * integration), per SPEC.md §0.
 */
export interface FertilityObservations {
  cervicalMucus?: "dry" | "sticky" | "creamy" | "watery" | "egg_white";
  ovulationPain?: boolean;
  bbtCelsius?: number;
  opkResult?: "negative" | "positive";
}

export interface DayLog {
  date: CivilDate; // primary key
  bleeding: BleedingKind;
  flow?: FlowLevel;
  bleedingContext?: BleedingContext;
  periodBoundary?: "start" | "end"; // explicit user assertion, not inferred
  clots?: ClotSize;
  productChanges?: number; // count in the day
  fastestProductChangeHours?: 0.5 | 1 | 2 | 4 | 8; // shortest interval between changes
  doubleProtection?: boolean;
  nightChange?: boolean;
  leakThrough?: boolean;
  pain: {
    severity: PainSeverity;
    sites?: PainSite[];
    interferedWith?: Interference[];
    painkillerDidNotHelp?: boolean;
  };
  symptoms: SymptomId[]; // presence-only; absence is *unknown* unless nothingToReport
  nothingToReport?: boolean; // one-tap: converts unknown -> true negative
  mood?: MoodId[];
  notes?: string;
  fertility?: FertilityObservations; // only present when settings.fertilityEnabled
  loggedAt: CivilDate; // the day the entry was made (back-entry detection, S17)
}

// ============================================================================
// ---------- profile ----------
// ============================================================================

export interface Profile {
  birthYear?: number;
  menarcheYear?: number; // -> gynecologic age
  reportedTypicalCycleLength?: number; // onboarding, used only until N>=1
  reportedTypicalPeriodDays?: number;
  reportedRegularity?: "consistent" | "variable" | "unknown";
  state: LifeStageState;
  settings: Settings;
}

export interface LifeStageState {
  pregnant: boolean;
  deliveryDate?: CivilDate; // -> daysSinceDelivery
  breastfeeding: boolean;
  hormonalMethod?: { kind: HormonalMethodKind; startedOn: CivilDate };
  copperIudInsertedOn?: CivilDate;
  stoppedHormonalOn?: CivilDate;
  perimenopauseSelfDeclared: boolean;
  menopauseSelfDeclared: boolean;
  knownIrregular: boolean;
  preferNotToSay: boolean;
}

export interface Settings {
  fertilityEnabled: boolean; // DEFAULT false
  tierCSymptomsEnabled: boolean; // DEFAULT false (sleep/exercise/focus/libido)
  healthAwarenessEnabled: boolean; // DEFAULT true
  notifications: {
    periodReminder: boolean;
    fertileReminder: boolean;
    symptomReminder: boolean;
    medicationReminder: boolean;
    loggingReminder: boolean;
    healthAwareness: boolean;
    privateWording: boolean /* DEFAULT true */;
  };
  locale: "en-US" | "en-GB"; // gates URG-02 wording
}

// ============================================================================
// ---------- derived ----------
// ============================================================================

export type CycleStatus =
  | "ok"
  | "gap_unknown"
  | "skip_suspected"
  | "excluded_by_user"
  | "in_progress";

export interface BleedingEpisode {
  startDate: CivilDate;
  endDate: CivilDate | null; // null = ongoing or never ended
  menstrualDays: CivilDate[];
  spottingDays: CivilDate[];
  durationDays: number | null;
  endInferred: boolean; // true when no explicit 'end' boundary was logged
}

export interface Cycle {
  index: number; // 0 = most recent completed
  startDate: CivilDate;
  nextStartDate: CivilDate | null; // null for in-progress
  lengthDays: number | null;
  status: CycleStatus;
  statusReason?: string; // human-readable, shown in history
  impliedSplitCount?: number; // k* when skip_suspected
  weight: number; // 1.0 normally, 0.5 for user-confirmed inferred splits
  episode: BleedingEpisode;
}

export interface PredictionResult {
  kind: "none" | "population_estimate" | "personal";
  center: CivilDate | null;
  low: CivilDate | null;
  high: CivilDate | null;
  predictedLengthDays: number | null;
  confidence: "not_enough_information" | "early_estimate" | "limited" | "more_consistent";
  confidenceReason: string; // from lib/copy, always populated
  basis: {
    usableCycles: number;
    windowCycles: number;
    effectiveN: number;
    sigma: number;
    halfWidthDays: number;
    calibrationFactor: number;
  };
  suppressed?: { reason: "pregnant" | "postpartum" | "insufficient_data" | "hormonal_method" };
}

export interface FertilityEstimate {
  // only computed when settings.fertilityEnabled
  ovulationLow: CivilDate;
  ovulationHigh: CivilDate;
  fertileLow: CivilDate;
  fertileHigh: CivilDate;
  confidenceNote: string;
  disclaimer: string; // rendered adjacent, never behind a link
}

export interface Insight {
  id: string;
  headline: string;
  body: string;
  detail: string; // the supporting counts
  supportingCycles: number;
  supportingDates: CivilDate[]; // "view the records behind this"
  replicatedLastCycle: boolean;
  kind: "cycle" | "duration" | "symptom" | "flow" | "performance";
}

export interface HealthMessage {
  ruleId: string; // 'CYC-01', 'URG-01', ...
  severity: "informational" | "discuss_with_clinician" | "seek_urgent_care";
  message: string;
  sourceName: string;
  sourceUrl: string;
  sourceThreshold: string; // "Why am I seeing this?"
  dismissible: boolean; // false for URG-01, PMB-01
}

// ============================================================================
// ---------- types named but not spelled out by SPEC.md §3 (added by F) ----------
// ============================================================================

/**
 * The generic "never emit an average without its variation" wrapper (SPEC.md §5, agent
 * E's brief: "every summary statistic returns { center, low, high, n }, never a bare
 * number"). Reused wherever the engine needs to report a statistic with its spread
 * instead of a bare number — prediction dates use CivilDate-flavoured fields directly
 * on PredictionResult instead of this generic, since low/high there are dates, not a
 * numeric range around a numeric center.
 */
export interface StatSummary {
  center: number;
  low: number;
  high: number;
  n: number;
}

/**
 * Standing user decisions that must survive recomputation without being re-derived from
 * scratch each time (SPEC.md R7: anomalies produce prompts, never mutations — a
 * decision record is how a user's *answer* to such a prompt is remembered). Keyed by
 * the date of the gap/cycle the decision concerns.
 */
export interface UserDecisions {
  /** Cycles the user has explicitly excluded from statistics/predictions, with why. */
  excludedCycles: Record<CivilDate /* cycle startDate */, { reason: string; decidedOn: CivilDate }>;
  /**
   * Answers to "did you miss logging a period around {date}?" prompts (§5.3 of
   * 01-cycle-prediction.md — "the single highest-value affordance in the whole build").
   * Keyed by the gap's start date. `confirmed: true` inserts an inferred period start
   * at the offered date; `confirmed: false` records that the user was asked and said no,
   * so the prompt does not keep resurfacing.
   */
  skipPrompts: Record<
    CivilDate /* gap startDate */,
    { confirmed: boolean; inferredStartDate?: CivilDate; decidedOn: CivilDate }
  >;
}

/**
 * On-device, per-user self-calibration state for the prediction interval width
 * (01-cycle-prediction.md §4.4). Persisted and fed back into the next prediction; never
 * derived from population data.
 */
export interface CalibrationState {
  /** Cumulative multiplier applied to the raw half-width, clamped to [0.7, 2.0]. */
  cumulativeAdjustment: number;
  /** The coverage outcome (window contained the actual start date, y/n) of each of the
   * last K resolved predictions, most recent last — used to detect two-consecutive-
   * evaluation drift in either direction per §4.4's rule. */
  recentCoverage: boolean[];
}

/**
 * The single computed-everything payload every screen reads from (SPEC.md §4.1). Built
 * by the integration agent's lib/engine/index.ts from the pure per-domain engines; F
 * only defines the shape here so downstream agents can code against it immediately.
 */
export interface EngineOutput {
  episodes: BleedingEpisode[];
  cycles: Cycle[];
  prediction: PredictionResult;
  fertility?: FertilityEstimate; // only present when settings.fertilityEnabled
  stats: {
    completedCycleCount: number;
    typicalCycleLength: StatSummary | null;
    figoRange: StatSummary | null; // post-skip-correction, N>=6 only
    medianCycleLengthDifference: number | null;
    regularityBand: "very_consistent" | "typical_variation" | "high_variation" | null;
    periodDuration: StatSummary | null;
    heavyFlowDayCount: number;
  };
  insights: Insight[];
  healthMessages: HealthMessage[];
  performance: {
    lastSignedErrorDays: number | null;
    rollingMedianAbsoluteErrorDays: number | null;
    windowHitRate: StatSummary | null; // center = observed rate, n = resolved predictions
  };
}
