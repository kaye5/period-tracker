/**
 * Cycle derivation — agent A's engine module.
 *
 * Specification: docs/research/01-cycle-prediction.md §5 (skip/anomaly detection) and
 * the STEP 1-2 pipeline in "RECOMMENDED ALGORITHM FOR THIS APP"; SPEC.md R6 (spotting
 * never opens a cycle) and R7 (never silently discard or split user data — annotate).
 *
 * Pure, I/O-free, no Date.now() (SPEC.md R3). "Today" is always an explicit CivilDate
 * parameter.
 *
 * Pipeline this file implements:
 *   dayLogs --buildEpisodes--> BleedingEpisode[] --buildCycles--> Cycle[]
 * with the skip detector (detectSkips) as a separately-exported, independently testable
 * piece that buildCycles calls internally. buildSkipPrompt and applyUserSkipDecision
 * implement the "did you miss logging a period?" affordance
 * (01-cycle-prediction.md §5.3 item 3, described there as "the highest-value UI
 * affordance in this whole document").
 */

import { addDays, compare, diffDays, rangeInclusive, type CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle, CycleStatus, DayLog, Profile } from "@/lib/domain/types";
import {
  MAX_CYCLE,
  MAX_IMPLIED,
  MIN_CYCLE,
  MIN_IMPLIED,
  MU0_DEFAULT,
  NO_SPLIT_BELOW,
  SIGMA0,
  Z1_MIN,
  ZK_MAX,
} from "@/lib/engine/constants";

// ============================================================================
// buildEpisodes — dayLogs -> BleedingEpisode[]
// ============================================================================

/**
 * Working (mutable) episode while we're still walking days for it; converted to the
 * immutable `BleedingEpisode` shape when it closes (or at the end of the walk, if it's
 * still open).
 */
interface WorkingEpisode {
  startDate: CivilDate;
  menstrualDays: CivilDate[];
  spottingDays: CivilDate[];
}

function finalizeEpisode(
  ep: WorkingEpisode,
  endDate: CivilDate,
  endInferred: boolean,
): BleedingEpisode {
  return {
    startDate: ep.startDate,
    endDate,
    menstrualDays: ep.menstrualDays,
    spottingDays: ep.spottingDays,
    durationDays: diffDays(ep.startDate, endDate) + 1,
    endInferred,
  };
}

function ongoingEpisode(ep: WorkingEpisode): BleedingEpisode {
  return {
    startDate: ep.startDate,
    endDate: null,
    menstrualDays: ep.menstrualDays,
    spottingDays: ep.spottingDays,
    durationDays: null,
    endInferred: true,
  };
}

/**
 * Build bleeding episodes from recorded day logs (SPEC.md R2: dayLogs is the sole
 * source of user-recorded truth; this function only derives from it, never mutates it).
 *
 * Design choices made here that the spec/research leave open [choice], documented so
 * downstream agents and reviewers know the intent:
 *
 * 1. **Only a 'menstrual' bleeding day can open an episode** (R6). A day logged as
 *    'spotting' never starts one; a run of spotting-only days with no menstrual day
 *    nearby produces no episode at all (it simply doesn't appear in the output — it
 *    remains visible in `dayLogs` for other engines, e.g. the insight engine, to use
 *    directly). This makes "spotting never opens a cycle" true by construction: every
 *    episode this function returns has at least one entry in `menstrualDays`.
 * 2. **A calendar date with no `DayLog` entry at all is never evidence that bleeding
 *    stopped.** Only an *explicitly logged* `bleeding: 'none'` day counts toward the
 *    2-day closing streak (choice 3 below); a date with no log at all is transparent —
 *    it neither advances nor resets the streak. Earlier versions of this function
 *    treated an unlogged gap the same as an explicit "none", which let a later,
 *    unrelated log (anything dated after an open period — even a same-day symptom note
 *    with no bleeding) retroactively fabricate a close across the unlogged days in
 *    between, closing a period the user never said had ended. Absence of a log records
 *    nothing; it must not be read as "confirmed not bleeding." We also never let a date
 *    at or after `today` (the second parameter) contribute to that streak, even when it
 *    *is* explicitly logged `'none'` — today isn't over yet, so a "none" logged so far
 *    today is not evidence the day will stay that way. (An explicit
 *    `periodBoundary: 'end'`, by contrast, is the user directly asserting the period is
 *    over — that's real information, not an absence, so it closes immediately
 *    regardless of date; see choice 3.) We never synthesize days *after* the last
 *    logged day, so the most recent episode is left open (`endDate: null`) rather than
 *    guessing that the user stopped bleeding — matching the type's "null = ongoing or
 *    never ended" contract.
 * 3. **Closing rule** (R6, spec brief item 1): an episode does not close on a single
 *    non-bleeding ('none') day. It takes 2+ *consecutive* 'none' days to close it
 *    (`endInferred: true`, `endDate` = the last actual bleeding day), UNLESS the user
 *    logged an explicit `periodBoundary: 'end'` on some day, which closes the episode
 *    immediately as of that day (`endInferred: false`) regardless of the streak.
 *    Spotting days do not count toward the closing streak (they're still "activity"),
 *    so a run of spotting can keep an episode open indefinitely without a `menstrual`
 *    day recorded again — that's intentional: it's what "spotting attaches to a nearby
 *    episode" means for spotting that trails an episode's menstrual bleeding.
 * 4. **Leading (pre-period) spotting** — spotting logged before any menstrual day —
 *    is held in a small pending buffer and attached to the *next* episode's
 *    `spottingDays` (and folded into its `startDate`) only if it connects to that
 *    episode's first menstrual day without an intervening run of 2+ 'none' days. If
 *    2+ 'none' days occur while spotting is pending and no episode has opened, the
 *    pending spotting is discarded — it's "not nearby" anything and so, per R6,
 *    doesn't open (or attach to) anything either.
 * 5. **Explicit `periodBoundary: 'start'` while an episode is already open** is
 *    treated as the user asserting a new period began *today*, even if the automatic
 *    2-day-gap rule alone wouldn't have closed the previous episode yet (e.g. two
 *    periods logged very close together). The still-open episode is closed as of its
 *    last bleeding day (`endInferred: true`, since no explicit 'end' was given) and a
 *    fresh episode opens on this day. SPEC.md/the research doc only spell out the
 *    'end' override explicitly; this mirrors it symmetrically for 'start' rather than
 *    silently merging two periods the user explicitly told us were separate (R7).
 */
export function buildEpisodes(dayLogs: DayLog[], today: CivilDate): BleedingEpisode[] {
  if (dayLogs.length === 0) return [];

  const byDate = new Map<CivilDate, DayLog>();
  for (const log of dayLogs) byDate.set(log.date, log);
  const allLoggedDates = [...byDate.keys()].sort((a, b) => compare(a, b));

  const relevantDates = allLoggedDates.filter((d) => {
    const log = byDate.get(d)!;
    return log.bleeding !== "none" || log.periodBoundary !== undefined;
  });
  if (relevantDates.length === 0) return [];

  const firstDate = relevantDates[0];
  const lastDate = allLoggedDates[allLoggedDates.length - 1];
  const walkDates = rangeInclusive(firstDate, lastDate);

  const episodes: BleedingEpisode[] = [];
  let current: WorkingEpisode | null = null;
  let noneStreak = 0;
  let pendingSpotting: CivilDate[] = [];
  let pendingNoneStreak = 0;

  for (const date of walkDates) {
    const dayLog = byDate.get(date);
    const bleeding = dayLog?.bleeding ?? "none";
    const boundary = dayLog?.periodBoundary;

    // A non-bleeding day counts as evidence bleeding stopped only if it is strictly
    // before `today` — today isn't over yet, so a 'none' logged for today (or a
    // back-dated future one) must not close the period the user is still having. An
    // unlogged past day DOES count: the app's own drag-select writes bleeding days
    // only, so requiring an explicit 'none' merged every period a user ever logged
    // into one never-ending episode. Positive evidence (menstrual/spotting) and an
    // explicit `periodBoundary: 'end'` are real assertions, never subject to this guard.
    const isConfirmedNonBleeding = bleeding === "none" && compare(date, today) < 0;

    // Explicit new-period assertion while a previous episode is still open (choice 5
    // above): close the old one first, then fall through to open a fresh one below.
    if (current !== null && boundary === "start" && bleeding === "menstrual") {
      const lastBleedingDay = addDays(date, -(noneStreak + 1));
      episodes.push(finalizeEpisode(current, lastBleedingDay, true));
      current = null;
      noneStreak = 0;
    }

    if (current !== null) {
      if (bleeding === "menstrual") {
        current.menstrualDays.push(date);
        noneStreak = 0;
      } else if (bleeding === "spotting") {
        current.spottingDays.push(date);
        noneStreak = 0;
      } else if (isConfirmedNonBleeding) {
        noneStreak++;
      }

      if (boundary === "end") {
        episodes.push(finalizeEpisode(current, date, false));
        current = null;
        noneStreak = 0;
      } else if (noneStreak >= 2) {
        const endDate = addDays(date, -noneStreak);
        episodes.push(finalizeEpisode(current, endDate, true));
        current = null;
        noneStreak = 0;
      }
    } else {
      if (bleeding === "menstrual") {
        current = {
          startDate: pendingSpotting.length > 0 ? pendingSpotting[0] : date,
          menstrualDays: [date],
          spottingDays: pendingSpotting,
        };
        pendingSpotting = [];
        pendingNoneStreak = 0;
        if (boundary === "end") {
          episodes.push(finalizeEpisode(current, date, false));
          current = null;
        }
      } else if (bleeding === "spotting") {
        pendingSpotting.push(date);
        pendingNoneStreak = 0;
      } else if (pendingSpotting.length > 0 && isConfirmedNonBleeding) {
        pendingNoneStreak++;
        if (pendingNoneStreak >= 2) {
          pendingSpotting = [];
          pendingNoneStreak = 0;
        }
      }
    }
  }

  if (current !== null) {
    episodes.push(ongoingEpisode(current));
  }

  return episodes;
}

// ============================================================================
// Skip / anomaly detection — 01-cycle-prediction.md §5.3
// ============================================================================

/** Life-stage contexts in which skip splitting must be suppressed entirely
 * (01-cycle-prediction.md §5.3 item 5, §7.2/§7.4/§7.5): genuinely long gaps are common
 * in these contexts, and splitting them would fabricate periods that never happened. */
export interface SkipSuppressionState {
  perimenopause: boolean;
  postpartum: boolean;
  recentHormonalContraceptionStop: boolean;
}

/** The estimator's current typical-length and scale — owned by agent B's prediction
 * module, but the skip detector needs them, so they're threaded in as parameters
 * (never imported from prediction.ts — that would be a module cycle, per this agent's
 * brief item 4). */
export interface SkipDetectionParams {
  /** L̂ — current estimate of typical cycle length, in days. */
  lHat: number;
  /** σ̂ — current estimate of within-person cycle-length scale, in days. */
  sigmaHat: number;
}

export interface GapAnnotation {
  /** The (possibly merged) gap length in days between two consecutive first-menstrual-
   * bleed-days, i.e. the candidate cycle length this annotation describes. */
  gapDays: number;
  /** How many raw, un-merged consecutive gaps were folded into this one (>=1). Lets
   * the caller know how many "starts" this annotation actually spans. */
  mergedRawGapCount: number;
  status: "gap_unknown" | "ok" | "skip_suspected";
  /** k* — the best-fit implied number of cycles inside this gap. Only set when
   * `status === 'skip_suspected'`. */
  kStar?: number;
  /** G / k* — the implied length of each of the k* cycles. Only set alongside `kStar`. */
  impliedCycleLengthDays?: number;
  /** Human-readable, suitable for the history screen (spec brief item 5). */
  statusReason: string;
}

/**
 * The skip/anomaly detector, implementing 01-cycle-prediction.md §5.3 and STEP 2 of
 * "RECOMMENDED ALGORITHM FOR THIS APP" exactly:
 *
 *   0. Hard bounds (S5, S6): a raw gap < MIN_CYCLE is noise, not a real cycle boundary
 *      — it's merged forward into the next gap (repeatedly, if needed) until the
 *      merged total clears MIN_CYCLE, or merged backward into the previous group if
 *      it's the trailing gap with nothing left to merge forward into ("merge into
 *      previous period" — see the loop below for exactly which of the two neighbours
 *      survives). A merged gap > MAX_CYCLE is `gap_unknown` and is NEVER split further,
 *      matching S5/S15's own preprocessing.
 *   1. Any gap < NO_SPLIT_BELOW (45 d, comfortably above FIGO's 38 d upper-normal, S7)
 *      is always accepted as a single cycle — never scored.
 *   2. Otherwise, score every candidate multiplicity k = 1..floor(G/MIN_IMPLIED) via
 *      z_k = (G - k·L̂) / (sqrt(k) · max(σ̂, 2.5)) and take k* = argmin|z_k|.
 *   3. Flag `skip_suspected` only when ALL FIVE decisive conditions hold: k* >= 2,
 *      |z_1| > Z1_MIN (k=1 fits badly), |z_k*| < ZK_MAX (k* fits well), and
 *      MIN_IMPLIED <= G/k* <= MAX_IMPLIED (the implied per-cycle length is
 *      physiologically plausible) — AND detection is not suppressed for this user's
 *      current life-stage context (item 5).
 *
 * This function never mutates or discards anything (R7) — it only classifies. Nothing
 * here decides whether to exclude a gap from statistics; that's the caller's job,
 * reading `status` off the resulting Cycle.
 */
export function detectSkips(
  gaps: number[],
  params: SkipDetectionParams,
  state: SkipSuppressionState,
): GapAnnotation[] {
  interface Group {
    gapDays: number;
    mergedRawGapCount: number;
  }

  const groups: Group[] = [];
  let i = 0;
  while (i < gaps.length) {
    let merged = gaps[i];
    let count = 1;
    while (merged < MIN_CYCLE && i + count < gaps.length) {
      merged += gaps[i + count];
      count++;
    }
    groups.push({ gapDays: merged, mergedRawGapCount: count });
    i += count;
  }
  // A trailing short gap that reached the end of the array without finding a later
  // gap to merge forward into (it IS the last raw gap) merges backward into the
  // previous group instead — "merge into previous period" still applies, it just has
  // to reach the other direction when there's nothing after it.
  if (groups.length > 1) {
    const lastIdx = groups.length - 1;
    if (groups[lastIdx].gapDays < MIN_CYCLE) {
      const trailing = groups[lastIdx];
      const prev = groups[lastIdx - 1];
      prev.gapDays += trailing.gapDays;
      prev.mergedRawGapCount += trailing.mergedRawGapCount;
      groups.pop();
    }
  }

  const suppressed =
    state.perimenopause || state.postpartum || state.recentHormonalContraceptionStop;

  return groups.map(({ gapDays: G, mergedRawGapCount }): GapAnnotation => {
    if (G > MAX_CYCLE) {
      return {
        gapDays: G,
        mergedRawGapCount,
        status: "gap_unknown",
        statusReason:
          `A ${G}-day gap between periods is too long to interpret reliably ` +
          `(over ${MAX_CYCLE} days), so it's excluded from your statistics rather than guessed at.`,
      };
    }

    if (G < NO_SPLIT_BELOW) {
      return {
        gapDays: G,
        mergedRawGapCount,
        status: "ok",
        statusReason: `Counted as a single ${G}-day cycle.`,
      };
    }

    const kMax = Math.floor(G / MIN_IMPLIED);
    let kStar = 1;
    let bestAbsZ = Infinity;
    const zByK = new Map<number, number>();
    for (let k = 1; k <= kMax; k++) {
      const z = (G - k * params.lHat) / (Math.sqrt(k) * Math.max(params.sigmaHat, 2.5));
      zByK.set(k, z);
      if (Math.abs(z) < bestAbsZ) {
        bestAbsZ = Math.abs(z);
        kStar = k;
      }
    }
    const z1 = zByK.get(1) ?? 0;
    const zKStar = zByK.get(kStar) ?? 0;
    const impliedLength = G / kStar;

    const decisive =
      kStar >= 2 &&
      Math.abs(z1) > Z1_MIN &&
      Math.abs(zKStar) < ZK_MAX &&
      impliedLength >= MIN_IMPLIED &&
      impliedLength <= MAX_IMPLIED;

    if (decisive && !suppressed) {
      return {
        gapDays: G,
        mergedRawGapCount,
        status: "skip_suspected",
        kStar,
        impliedCycleLengthDays: impliedLength,
        statusReason:
          `This ${G}-day gap looks like about ${kStar} periods weren't logged ` +
          `(roughly ${Math.round(impliedLength)}-day cycles each). ` +
          `Did you miss logging a period around one of these dates?`,
      };
    }

    const suppressedNote =
      decisive && suppressed
        ? " (Skip detection is paused for your current life stage, so this is kept as one cycle.)"
        : "";
    return {
      gapDays: G,
      mergedRawGapCount,
      status: "ok",
      statusReason: `Counted as a single ${G}-day cycle.${suppressedNote}`,
    };
  });
}

// ============================================================================
// Life-stage suppression state, derived from Profile — feeds detectSkips
// ============================================================================

/** [choice] ~6 cycles (01-cycle-prediction.md §7.5), approximated in days because the
 * exact post-delivery completed-cycle count isn't known before cycles are built. */
const POSTPARTUM_SUPPRESS_DAYS = 180;
/** [choice] ~3 cycles (01-cycle-prediction.md §7.4: "down-weight the first 3 cycles"). */
const RECENT_HC_STOP_SUPPRESS_DAYS = 90;
/** S14: the variability change point is at 42.84 years; 43 is the nearest whole year. */
const PERIMENOPAUSE_AGE_YEARS = 43;

function approximateAgeYears(profile: Profile, today: CivilDate): number | null {
  if (profile.birthYear === undefined) return null;
  const todayYear = Number(today.slice(0, 4));
  return todayYear - profile.birthYear;
}

/**
 * Derives the skip-suppression flags for `detectSkips` from the user's profile and
 * life-stage state (01-cycle-prediction.md §5.3 item 5, §7.2/§7.4/§7.5). [choice]:
 * perimenopause is suppressed either by explicit self-declaration or by age
 * (>= PERIMENOPAUSE_AGE_YEARS, per S14); postpartum and recent-hormonal-contraception-
 * stop are suppressed for a fixed window after the relevant date, since a precise
 * completed-cycle count isn't available yet at this point in the pipeline.
 */
export function deriveSkipSuppressionState(
  profile: Profile,
  today: CivilDate,
): SkipSuppressionState {
  const age = approximateAgeYears(profile, today);
  const perimenopause =
    profile.state.perimenopauseSelfDeclared ||
    profile.state.menopauseSelfDeclared ||
    (age !== null && age >= PERIMENOPAUSE_AGE_YEARS);

  const postpartum =
    profile.state.deliveryDate !== undefined &&
    diffDays(profile.state.deliveryDate, today) < POSTPARTUM_SUPPRESS_DAYS;

  const recentHormonalContraceptionStop =
    profile.state.stoppedHormonalOn !== undefined &&
    diffDays(profile.state.stoppedHormonalOn, today) < RECENT_HC_STOP_SUPPRESS_DAYS;

  return { perimenopause, postpartum, recentHormonalContraceptionStop };
}

// ============================================================================
// buildCycles — episodes -> Cycle[]
// ============================================================================

function firstMenstrualDay(ep: BleedingEpisode): CivilDate | null {
  if (ep.menstrualDays.length === 0) return null;
  return ep.menstrualDays.reduce((min, d) => (compare(d, min) < 0 ? d : min));
}

/**
 * Build cycles from bleeding episodes (SPEC.md R6: cycle length is first-menstrual-
 * bleed-day to next first-menstrual-bleed-day — the ACOG definition; spotting-only
 * episodes, which `buildEpisodes` never produces, could not contribute a cycle
 * boundary here either, since we look at `menstrualDays` specifically).
 *
 * `detectorParams` lets a caller (typically the integration layer, `lib/engine/
 * index.ts`) pass agent B's current L̂/σ̂ estimates in. This module never imports from
 * `prediction.ts` (that would be a module cycle — spec brief item 4), so when omitted
 * it falls back to the cited population-prior constants (`MU0_DEFAULT`, `SIGMA0`) —
 * a "sensible fallback" per the brief, and an honest one, since those constants are
 * exactly what the prediction module itself falls back to at N=0.
 *
 * Cycles are returned most-recent-first: the in-progress cycle (if any: none only when
 * there isn't a single menstrual bleed day anywhere in `episodes`), then completed
 * cycles from most to least recent. `index` is 0 for the most recent *completed* cycle,
 * increasing with age (SPEC.md §3); the in-progress cycle, not being completed, gets
 * the sentinel index -1 rather than overloading 0. [choice: the sentinel isn't spelled
 * out in SPEC.md, which only says "0 = most recent completed".]
 */
export function buildCycles(
  episodes: BleedingEpisode[],
  profile: Profile,
  today: CivilDate,
  detectorParams?: Partial<SkipDetectionParams>,
): Cycle[] {
  const withStart = episodes
    .map((episode) => ({ episode, start: firstMenstrualDay(episode) }))
    .filter((e): e is { episode: BleedingEpisode; start: CivilDate } => e.start !== null)
    .sort((a, b) => compare(a.start, b.start));

  if (withStart.length === 0) return [];

  const last = withStart[withStart.length - 1];
  const inProgress: Cycle = {
    index: -1,
    startDate: last.start,
    nextStartDate: null,
    lengthDays: null,
    status: "in_progress",
    weight: 1.0,
    episode: last.episode,
  };

  if (withStart.length === 1) {
    return [inProgress];
  }

  const rawGaps = withStart
    .slice(0, -1)
    .map((entry, idx) => diffDays(entry.start, withStart[idx + 1].start));

  const params: SkipDetectionParams = {
    lHat: detectorParams?.lHat ?? MU0_DEFAULT,
    sigmaHat: detectorParams?.sigmaHat ?? SIGMA0,
  };
  const suppression = deriveSkipSuppressionState(profile, today);
  const annotations = detectSkips(rawGaps, params, suppression);

  const completedChronological: Omit<Cycle, "index">[] = [];
  let startIdx = 0;
  for (const ann of annotations) {
    const startEntry = withStart[startIdx];
    const endEntry = withStart[startIdx + ann.mergedRawGapCount];
    const status: CycleStatus = ann.status;
    completedChronological.push({
      startDate: startEntry.start,
      nextStartDate: endEntry.start,
      lengthDays: ann.gapDays,
      status,
      statusReason: ann.statusReason,
      impliedSplitCount: ann.kStar,
      weight: 1.0,
      episode: startEntry.episode,
    });
    startIdx += ann.mergedRawGapCount;
  }

  const completedNewestFirst: Cycle[] = [...completedChronological]
    .reverse()
    .map((c, index) => ({ ...c, index }));

  return [inProgress, ...completedNewestFirst];
}

// ============================================================================
// buildSkipPrompt — the "did you miss logging a period?" affordance
// ============================================================================

export interface SkipPrompt {
  question: string;
  /** The single most-actionable candidate date: the first inferred missed-period
   * start, i.e. the one closest to `cycle.startDate`. */
  suggestedDate: CivilDate;
  /** All candidate inferred missed-period start dates implied by k* (length k*-1). */
  options: CivilDate[];
}

/**
 * Builds the prompt payload for a `skip_suspected` cycle
 * (01-cycle-prediction.md §5.3 item 3: "the highest-value UI affordance in this whole
 * document" — it turns the app's single largest error source into a user-answerable
 * question). Returns `null` for any cycle that isn't `skip_suspected` (nothing to ask).
 */
export function buildSkipPrompt(cycle: Cycle): SkipPrompt | null {
  if (
    cycle.status !== "skip_suspected" ||
    cycle.impliedSplitCount === undefined ||
    cycle.lengthDays === null
  ) {
    return null;
  }

  const k = cycle.impliedSplitCount;
  const options: CivilDate[] = [];
  for (let n = 1; n < k; n++) {
    options.push(addDays(cycle.startDate, Math.round((n * cycle.lengthDays) / k)));
  }
  if (options.length === 0) return null; // defensive: skip_suspected implies k* >= 2

  return {
    question: `Did you miss logging a period around ${options[0]}?`,
    suggestedDate: options[0],
    options,
  };
}

// ============================================================================
// applyUserSkipDecision — turn a confirmed skip into split, down-weighted cycles
// ============================================================================

export interface SkipDecision {
  /** Identifies which cycle this decision answers — matches `Cycle.startDate` of the
   * `skip_suspected` cycle the prompt was built from. */
  cycleStartDate: CivilDate;
  confirmed: boolean;
  /** Optional user-adjusted date for the single missed period, when k* === 2. Ignored
   * (and the evenly-spaced default is used instead) when k* > 2, since a single override
   * can't unambiguously place more than one missed period. */
  inferredStartDate?: CivilDate;
}

function inferredPseudoEpisode(start: CivilDate): BleedingEpisode {
  // No real DayLog exists for this date (R2: dayLogs is the sole source of recorded
  // truth — we never fabricate one). This is a placeholder representing "a period is
  // presumed to have started here", carrying no real menstrual/spotting observations
  // beyond the presumed start itself. [choice]
  return {
    startDate: start,
    endDate: null,
    menstrualDays: [start],
    spottingDays: [],
    durationDays: null,
    endInferred: true,
  };
}

/**
 * Applies the user's answer to a `buildSkipPrompt` question (01-cycle-prediction.md
 * §5.3 item 4). Never mutates `dayLogs` or the input `cycles` array (R2, R7) — returns
 * a new array. On confirmation, the target `skip_suspected` cycle is replaced by k*
 * cycles split at evenly-spaced inferred boundaries (or the user's own
 * `inferredStartDate` when k* === 2), each carrying `weight: 0.5` so they don't
 * tighten σ̂ as if they were directly observed (research doc §5.3 item 4, motivated by
 * S15's finding that treating inferred splits as ordinary data collapses interval
 * coverage). A `confirmed: false` decision, or a decision that doesn't match any
 * `skip_suspected` cycle in `cycles`, returns `cycles` unchanged.
 */
export function applyUserSkipDecision(cycles: Cycle[], decision: SkipDecision): Cycle[] {
  if (!decision.confirmed) return cycles;

  const targetIdx = cycles.findIndex((c) => c.startDate === decision.cycleStartDate);
  if (targetIdx === -1) return cycles;
  const target = cycles[targetIdx];
  if (
    target.status !== "skip_suspected" ||
    target.impliedSplitCount === undefined ||
    target.lengthDays === null ||
    target.nextStartDate === null
  ) {
    return cycles;
  }

  const k = target.impliedSplitCount;
  const boundaries: CivilDate[] = [target.startDate];
  if (k === 2 && decision.inferredStartDate !== undefined) {
    boundaries.push(decision.inferredStartDate);
  } else {
    for (let n = 1; n < k; n++) {
      boundaries.push(addDays(target.startDate, Math.round((n * target.lengthDays) / k)));
    }
  }
  boundaries.push(target.nextStartDate);

  const splitChronological: Omit<Cycle, "index">[] = [];
  for (let n = 0; n < boundaries.length - 1; n++) {
    const segStart = boundaries[n];
    const segEnd = boundaries[n + 1];
    splitChronological.push({
      startDate: segStart,
      nextStartDate: segEnd,
      lengthDays: diffDays(segStart, segEnd),
      status: "ok",
      statusReason:
        "Inferred from a confirmed missed log, not directly recorded — weighted less in your statistics.",
      weight: 0.5,
      episode: n === 0 ? target.episode : inferredPseudoEpisode(segStart),
    });
  }
  const splitNewestFirst = [...splitChronological].reverse();

  const spliced: Cycle[] = [
    ...cycles.slice(0, targetIdx),
    ...splitNewestFirst.map((c) => ({ ...c, index: 0 })), // placeholder; reindexed below
    ...cycles.slice(targetIdx + 1),
  ];

  // Every completed cycle's `index` shifts once the split inserts extra cycles;
  // re-walk the (already most-recent-first) array and reassign sequentially, leaving
  // the in-progress cycle's -1 sentinel untouched.
  let nextIndex = 0;
  return spliced.map((c) => {
    if (c.status === "in_progress") return { ...c, index: -1 };
    const index = nextIndex;
    nextIndex++;
    return { ...c, index };
  });
}
