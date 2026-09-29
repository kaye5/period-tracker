/**
 * lib/engine/index.ts — the engine barrel and its single orchestration entry point
 * (SPEC.md §4.1).
 *
 * Ownership: agent I-a. Every other file under `lib/engine/` belongs to another agent and
 * is only ever *called* from here, never modified.
 *
 * Two invariants this file exists to protect:
 *
 *  1. **One computation, one payload.** Every screen reads a single `EngineOutput`
 *     (SPEC.md §4.1). No screen recomputes anything locally, so "editing a historical
 *     period recalculates later cycles" (PRD §17) is satisfied structurally: any write to
 *     `dayLogs` or `profile` re-runs `computeEverything` from scratch.
 *  2. **Purity.** SPEC.md R3: no I/O, no `Date.now()`, no randomness, no environment
 *     access. `today` is a parameter. Everything here is a pure function of its input, so
 *     the whole pipeline is deterministic and testable.
 *
 * Note on `fertility`: when `profile.settings.fertilityEnabled` is false the key is
 * **absent** from the returned object, not present-and-undefined. Downstream UI cannot
 * accidentally render a fertility card from a field that does not exist (SPEC.md §0:
 * "When off: no fertility UI, no fertility cards, ... no fertility columns in exports").
 */

import type { CivilDate } from "@/lib/date/civil";
import { compare } from "@/lib/date/civil";
import type {
  BleedingEpisode,
  CalibrationState,
  Cycle,
  DayLog,
  EngineOutput,
  FertilityEstimate,
  HealthMessage,
  Insight,
  PredictionResult,
  Profile,
  SymptomId,
  UserDecisions,
} from "@/lib/domain/types";

import {
  MU0_DEFAULT,
  SIGMA0,
  SIGMA_FLOOR,
  SYMPTOM_PANEL,
  SYMPTOM_PANEL_TIER_C,
  WINDOW,
  sigma0Scale,
} from "@/lib/engine/constants";
import {
  applyUserSkipDecision,
  buildCycles,
  buildEpisodes,
  buildSkipPrompt,
  type SkipDetectionParams,
  type SkipPrompt,
} from "@/lib/engine/cycles";
import {
  conjugatePredictive,
  lifeStageContext,
  mu0ForAge,
  predictNextPeriod,
  usableCycleLengths,
} from "@/lib/engine/prediction";
import {
  estimateFertility,
  type FertilityEstimateWithBasis,
} from "@/lib/engine/fertility";
import {
  computePerformance,
  recomputeCalibration,
  resolvePredictions,
  type IssuedPrediction,
  type PerformanceSummary,
  type ResolvedPrediction,
} from "@/lib/engine/performance";
import {
  buildInsightsWithDiagnostics,
  type InsightDiagnostics,
} from "@/lib/engine/insights";
import {
  EMPTY_HEALTH_AWARENESS_STATE,
  computeHealthMessages,
  type HealthAwarenessState,
  type UrgentSystemicSymptom,
} from "@/lib/engine/health";
import {
  computeCycleStatistics,
  type CycleStatistics,
} from "@/lib/engine/stats";

// ============================================================================
// Barrel re-exports
// ============================================================================
//
// `medianCycleLengthDifference` is the one name exported by two engine modules with two
// different signatures (agent B's takes raw lengths, agent E's takes cycles), so agent E's
// is re-exported under a disambiguated name rather than letting a star export silently
// drop both.

export * from "@/lib/engine/constants";
export * from "@/lib/engine/cycles";
export * from "@/lib/engine/prediction";
export * from "@/lib/engine/fertility";
export * from "@/lib/engine/performance";
export * from "@/lib/engine/insights";
export * from "@/lib/engine/health";
export {
  REGULARITY_VERY_CONSISTENT_MAX_DAYS,
  REGULARITY_TYPICAL_VARIATION_MAX_DAYS,
  MIN_USABLE_CYCLES_FOR_FIGO_RANGE,
  MIN_USABLE_CYCLES_FOR_REGULARITY_BAND,
  regularityBandFromMedianCld,
  usableCyclesForStats,
  buildVariabilityHeadline,
  predictedVsActualSeries,
  computeCycleStatistics,
  medianCycleLengthDifference as medianCycleLengthDifferenceOfCycles,
} from "@/lib/engine/stats";
export type {
  RegularityBand,
  FlowPatternDay,
  SymptomFrequency,
  CycleDayWindowLabel,
  SymptomCycleDayPoint,
  MissingDataIndicator,
  ResolvedPredictionLike,
  PredictedVsActualPoint,
  StatsInput,
  CycleStatistics,
} from "@/lib/engine/stats";

// ============================================================================
// Input / output contracts
// ============================================================================

/**
 * SPEC.md §4.1 fixes the five required fields. The optional ones carry *persisted state
 * that cannot be derived from `dayLogs`* — the predictions the app actually displayed in
 * the past, the systemic-symptom checkboxes URG-01 reads, and the health-message
 * snooze/rate-limit bookkeeping. Omitting them is always safe: the pipeline degrades to
 * "no resolved predictions yet" and "nothing dismissed yet" rather than failing.
 */
export interface ComputeEverythingInput {
  dayLogs: DayLog[];
  profile: Profile;
  today: CivilDate;
  decisions: UserDecisions;
  calibration: CalibrationState;
  /** Predictions as they were shown to the user, from the `predictions` collection.
   * Coverage is judged against the *stored* window, never a recomputed one. */
  issuedPredictions?: readonly IssuedPrediction[];
  /** URG-01's explicitly ticked systemic symptoms, keyed by the day they were ticked.
   * Never inferred from flow data. */
  urgentSymptomsByDate?: Partial<Record<CivilDate, UrgentSystemicSymptom[]>>;
  /** Health-message dismissals and the per-cycle display counter (guards G8/G9). */
  healthState?: HealthAwarenessState;
  /** Overrides the symptom panel the insight engine tests. Defaults to the §E.2 panel,
   * extended with the Tier C symptoms when `settings.tierCSymptomsEnabled` is true. */
  symptomPanel?: readonly SymptomId[];
}

/** The location/scale pair the skip detector scores gaps against (§5.3's L̂ and σ̂). */
export interface LocationScaleEstimate {
  /** L̂ — typical cycle length, days. */
  lHat: number;
  /** σ̂ — within-person cycle-length scale, days. */
  sigmaHat: number;
  /** `prior` when no usable cycle existed to estimate from, so the cited population
   * prior was used unchanged; `observed` when the user's own cycles drove it. */
  source: "prior" | "observed";
  /** How many usable cycles the estimate was drawn from (0 when `source` is `prior`). */
  usableCycles: number;
}

/** A pending "did you miss logging a period around {date}?" question. */
export interface SkipPromptItem {
  /** The `skip_suspected` cycle this question is about. */
  cycleStartDate: CivilDate;
  prompt: SkipPrompt;
}

/**
 * Everything one recomputation produces. Extends `EngineOutput` (SPEC.md §3) — the shape
 * every screen is guaranteed — with the richer per-domain payloads the history, chart and
 * report screens need, plus the bookkeeping the data layer persists.
 */
export interface EngineResult extends EngineOutput {
  episodes: BleedingEpisode[];
  cycles: Cycle[];
  prediction: PredictionResult;
  fertility?: FertilityEstimateWithBasis;
  stats: CycleStatistics;
  insights: Insight[];
  healthMessages: HealthMessage[];
  performance: PerformanceSummary;

  /** Unanswered skip prompts, in cycle order. The research calls this the single
   * highest-value affordance in the build, so it rides in the main payload. */
  skipPrompts: SkipPromptItem[];
  /** Why the insight engine said what it said. Never user-facing copy. */
  insightDiagnostics: InsightDiagnostics;
  /** Both passes of the location/scale estimate — see `computeEverything`'s comment on
   * why there are two. */
  estimate: { firstPass: LocationScaleEstimate; final: LocationScaleEstimate };
  /** Issued predictions paired with what actually happened. */
  resolvedPredictions: ResolvedPrediction[];
  /** What the calibration state *should* be after this recomputation. The data layer
   * persists it; `computeEverything` itself never mutates anything (R3). */
  recomputedCalibration: CalibrationState;
}

// ============================================================================
// Internal helpers
// ============================================================================

/** The first menstrual bleed day of an episode — the definition of a period start
 * (R6). Mirrors `buildCycles`'s own rule so period-start dates are consistent across the
 * pipeline. Returns null for an episode with no menstrual day. */
function firstMenstrualDay(episode: BleedingEpisode): CivilDate | null {
  if (episode.menstrualDays.length === 0) return null;
  return episode.menstrualDays.reduce((minimum, day) =>
    compare(day, minimum) < 0 ? day : minimum,
  );
}

/** Every recorded period start, chronological. Derived from episodes rather than from
 * cycles so that inferred (user-confirmed skip) starts never masquerade as recorded ones
 * when prediction performance is scored (R2). */
function recordedPeriodStarts(episodes: readonly BleedingEpisode[]): CivilDate[] {
  return episodes
    .map(firstMenstrualDay)
    .filter((d): d is CivilDate => d !== null)
    .sort(compare);
}

/**
 * L̂ / σ̂ from a cycle set, using exactly the estimator the prediction module uses (the
 * §4.2 conjugate posterior, with the same age-based `mu0` and the same life-stage-scaled
 * `sigma0`), so the skip detector is scoring gaps against the same notion of "typical"
 * the prediction interval is built on.
 *
 * With no usable cycle to learn from, the cited population prior is returned unchanged
 * and marked `source: 'prior'` — the detector's own documented fallback, made explicit
 * here rather than left implicit in `buildCycles`'s default arguments.
 */
function estimateLocationScale(
  cycles: readonly Cycle[],
  profile: Profile,
  today: CivilDate,
): LocationScaleEstimate {
  const usable = usableCycleLengths(cycles);
  const context = lifeStageContext(profile, today, usable);
  const mu0 = mu0ForAge(context.age);
  const sigma0 = SIGMA0 * sigma0Scale(context.age, {
    gynAgeYears: context.gynAgeYears,
    cyclesSinceStoppingHc: context.cyclesSinceStoppingHc,
    postpartumCycles: context.postpartumCycles,
  });

  if (usable.length === 0) {
    return {
      // The user's reported typical length is used only until a real cycle exists
      // (Profile.reportedTypicalCycleLength: "onboarding, used only until N>=1").
      lHat: profile.reportedTypicalCycleLength ?? mu0,
      sigmaHat: Math.max(sigma0, SIGMA_FLOOR),
      source: "prior",
      usableCycles: 0,
    };
  }

  const window = usable.slice(0, WINDOW);
  const distribution = conjugatePredictive(
    window.map((c) => c.lengthDays as number),
    {
      mu0,
      sigma0,
      weights: window.map((c) =>
        Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 1,
      ),
    },
  );

  return {
    lHat: distribution.muPost,
    sigmaHat: distribution.sigma,
    source: "observed",
    usableCycles: usable.length,
  };
}

/** [choice] The history screen has to show *why* a cycle is excluded (R7: "an excluded
 * cycle stays visible in history, marked, with the reason"). The reason is the user's own
 * words, echoed back — this string states a fact about a user action, makes no claim about
 * the user's body, and so does not belong in `lib/copy/` under R9. */
function excludedStatusReason(reason: string): string {
  const trimmed = reason.trim();
  return trimmed.length === 0
    ? "You excluded this cycle from your statistics."
    : `You excluded this cycle from your statistics. Reason you gave: ${trimmed}`;
}

/**
 * Step 4 of the pipeline: the user's standing answers, applied before any statistic is
 * computed from the cycle set.
 *
 * Confirmed skips first (they change how many cycles there *are*), exclusions second (they
 * change how a cycle is *labelled*), so that an exclusion always lands on the final cycle
 * list — including on a cycle produced by a confirmed split. Nothing is deleted: an
 * excluded cycle keeps its dates, its episode and its place in history and only changes
 * status (R7).
 */
function applyUserDecisions(cycles: Cycle[], decisions: UserDecisions): Cycle[] {
  let result = cycles;

  const skipCandidates = cycles.filter((c) => c.status === "skip_suspected");
  for (const candidate of skipCandidates) {
    const decision = decisions.skipPrompts?.[candidate.startDate];
    if (decision === undefined || !decision.confirmed) continue;
    result = applyUserSkipDecision(result, {
      cycleStartDate: candidate.startDate,
      confirmed: true,
      inferredStartDate: decision.inferredStartDate,
    });
  }

  return result.map((cycle) => {
    const exclusion = decisions.excludedCycles?.[cycle.startDate];
    if (exclusion === undefined) return cycle;
    return {
      ...cycle,
      status: "excluded_by_user" as const,
      statusReason: excludedStatusReason(exclusion.reason),
    };
  });
}

/** Skip prompts the user has not answered yet. A `confirmed: false` decision is an
 * answer — the question does not resurface. */
function pendingSkipPrompts(cycles: readonly Cycle[], decisions: UserDecisions): SkipPromptItem[] {
  const items: SkipPromptItem[] = [];
  for (const cycle of cycles) {
    if (cycle.status !== "skip_suspected") continue;
    if (decisions.skipPrompts?.[cycle.startDate] !== undefined) continue;
    const prompt = buildSkipPrompt(cycle);
    if (prompt === null) continue;
    items.push({ cycleStartDate: cycle.startDate, prompt });
  }
  return items;
}

// ============================================================================
// The entry point
// ============================================================================

/**
 * SPEC.md §4.1. Pure: same input, same output, always.
 *
 * Order of operations, and it matters:
 *
 *  1. Bleeding episodes from day logs (the only step that touches recorded data).
 *  2. Cycles from episodes.
 *  3. **Two passes over the cycle set.** The skip detector (§5.3) scores a gap G against
 *     `z_k = (G − k·L̂) / (√k · max(σ̂, 2.5))`, so it needs L̂ and σ̂ — which are themselves
 *     estimated from the cycle set the detector is about to correct. Agent A deliberately
 *     made `detectSkips`/`buildCycles` take those as *parameters* rather than importing
 *     the estimator, which keeps `cycles.ts` free of a module cycle with `prediction.ts`
 *     and leaves the resolution of the circularity here, where both modules are already
 *     in scope. It is resolved by fixed-point iteration truncated at two passes:
 *
 *       pass 1 — build cycles against the cited population prior (`MU0_DEFAULT`, `SIGMA0`),
 *                then estimate L̂₁/σ̂₁ from the result;
 *       pass 2 — rebuild cycles with L̂₁/σ̂₁ so skip detection runs against the user's own
 *                scale, then re-estimate L̂₂/σ̂₂ from the corrected set.
 *
 *     Two passes, not more: further iterations are not run because each additional pass
 *     lets the detector's own output feed back into the threshold that produced it, and a
 *     detector that keeps re-reading its own conclusions can walk a merely-long gap into a
 *     confident split. One correction from the prior, then stop. The final estimate is
 *     reported (`estimate.final`) but is deliberately *not* used to re-run detection a
 *     third time.
 *  4. User decisions — confirmed skips and excluded cycles — applied before any statistic.
 *  5. Prediction; then fertility **only** when `settings.fertilityEnabled`.
 *  6. Statistics, insights, health messages, performance.
 *  7. Health messages respect `settings.healthAwarenessEnabled`; the never-suppressed
 *     urgent rules (URG-01, URG-02, PMB-01) fire regardless. That gate lives inside
 *     `computeHealthMessages`, which is the only place that knows which rules are exempt.
 */
export function computeEverything(input: ComputeEverythingInput): EngineResult {
  const { dayLogs, profile, today, decisions, calibration } = input;

  // --- 1. Episodes ----------------------------------------------------------
  const episodes = buildEpisodes(dayLogs, today);

  // --- 2 & 3. Cycles, two-pass (see the doc comment above) ------------------
  const priorParams: SkipDetectionParams = { lHat: MU0_DEFAULT, sigmaHat: SIGMA0 };
  const firstPassCycles = buildCycles(episodes, profile, today, priorParams);
  const firstPass = estimateLocationScale(firstPassCycles, profile, today);

  const secondPassCycles = buildCycles(episodes, profile, today, {
    lHat: firstPass.lHat,
    sigmaHat: firstPass.sigmaHat,
  });
  const finalEstimate = estimateLocationScale(secondPassCycles, profile, today);

  // --- 4. User decisions ----------------------------------------------------
  const cycles = applyUserDecisions(secondPassCycles, decisions);
  const skipPrompts = pendingSkipPrompts(cycles, decisions);

  // --- 5. Prediction, then fertility (only when enabled) --------------------
  const prediction = predictNextPeriod({ cycles, profile, today, calibration });

  const fertility = profile.settings.fertilityEnabled
    ? estimateFertility({ prediction, fertilityEnabled: true })
    : null;

  // --- 6. Statistics, insights, health, performance -------------------------
  const stats = computeCycleStatistics({ cycles, episodes, dayLogs });

  const panel =
    input.symptomPanel ??
    (profile.settings.tierCSymptomsEnabled
      ? ([...SYMPTOM_PANEL, ...SYMPTOM_PANEL_TIER_C] as readonly SymptomId[])
      : (SYMPTOM_PANEL as readonly SymptomId[]));
  const { insights, diagnostics } = buildInsightsWithDiagnostics({
    cycles,
    dayLogs,
    panel,
  });

  // --- 7. Health messages ---------------------------------------------------
  const healthMessages = computeHealthMessages({
    dayLogs,
    profile,
    cycles,
    episodes,
    today,
    urgentSymptomsByDate: input.urgentSymptomsByDate ?? {},
    state: input.healthState ?? EMPTY_HEALTH_AWARENESS_STATE,
  });

  const resolvedPredictions = resolvePredictions(
    input.issuedPredictions ?? [],
    recordedPeriodStarts(episodes),
  );
  const performance = computePerformance(resolvedPredictions);
  const recomputedCalibration = recomputeCalibration(resolvedPredictions);

  return {
    episodes,
    cycles,
    prediction,
    // Conditional spread, not `fertility: undefined`: when the feature is off the key is
    // absent, so `'fertility' in output` is false and no UI can render an empty card.
    ...(fertility === null ? {} : { fertility }),
    stats,
    insights,
    healthMessages,
    performance,
    skipPrompts,
    insightDiagnostics: diagnostics,
    estimate: { firstPass, final: finalEstimate },
    resolvedPredictions,
    recomputedCalibration,
  };
}

/** Narrowing helper for callers that only need the SPEC.md §3 guarantee. Purely a type
 * assertion — `EngineResult` already *is* an `EngineOutput`. */
export function asEngineOutput(result: EngineResult): EngineOutput {
  return result;
}

export type { FertilityEstimate, EngineOutput };
