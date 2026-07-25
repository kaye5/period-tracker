/**
 * Health-awareness rule engine — 03-additional-data-and-safety.md §5 (24-row rule table)
 * and §6 (data-coverage guards). Pure per SPEC.md R3: no I/O, no Date.now(), "today" is
 * an explicit parameter. lib/copy/health.ts owns every user-facing string; this file only
 * owns the *logic* that decides which rule fires, with which numbers, at which severity.
 *
 * ============================================================================
 * A note on `DayLog` and the URG-01 symptom checkboxes (read before touching this file)
 * ============================================================================
 * URG-01 requires "explicit user-ticked symptom checkboxes" for chest pain, shortness of
 * breath, feeling lightheaded/dizzy, and feeling faint (03-additional-data-and-safety.md
 * §2.7, §3.3). `DayLog.symptoms: SymptomId[]` (lib/domain/types.ts, owned by agent F) has
 * no such field — `SymptomId` is the ordinary wellness symptom panel (cramps, bloating,
 * mood, …), not a systemic-emergency-symptom checklist, and this file must not invent
 * values that don't exist in that union. Rather than silently mis-model these as regular
 * symptoms, `computeHealthMessages` takes them as a **separate, explicit input**
 * (`urgentSymptomsByDate`) alongside `dayLogs`. This keeps the engine pure and testable
 * today; it also means `DayLog` needs a real field for this (e.g.
 * `urgentSymptoms?: UrgentSystemicSymptom[]`) before the UI can wire real checkboxes to
 * it. See this agent's final report for the exact ask to agent F/U3.
 *
 * ============================================================================
 * Guard reference (03-additional-data-and-safety.md §5, "Global preconditions")
 * ============================================================================
 * G1 Coverage guard           — lib/engine/constants.ts's COVERAGE_GUARDS; see the
 *                                `hasXCoverage` / `find*Trigger` helpers below.
 * G2 Pregnancy/postpartum     — isG2Active
 * G3 Hormonal method          — isRecentHormonalMethodStart (<180d) +
 *                                isBleedingSuppressingMethodOngoing (permanent, AMEN-* only)
 * G4 Copper IUD               — isRecentCopperIud (<365d) — downgrades HMB-*, never
 *                                suppresses it (03-additional-data-and-safety.md §5, G4)
 * G5 Perimenopause            — isPerimenopauseActive — suppresses CYC-01/02/03(/04n.a.),
 *                                PERI-01 substitutes; HMB, DUR, IMB and PMB rules stay active
 * G6 Postmenopause             — isPostmenopauseActive — [choice, documented below and in
 *                                the final report] suppresses every rule except PMB-01 and
 *                                the URG-* pair, reading G6's own definition ("suppress ALL
 *                                cycle rules; only PMB-01 is active") as the operative text
 *                                over the §5 table's Suppressions column, which only spells
 *                                G6 out on the AMEN-01 row.
 * G7 Adolescent                — isAdolescent — routes CYC-01/02 to CYC-04's wider band
 * G8 Snooze/dismiss            — isSnoozed — 90 days per ruleId; URG-01, URG-02 and PMB-01
 *                                never consult it (03-additional-data-and-safety.md §5 rows;
 *                                SPEC.md agent D brief, deviation (b))
 * G9 Rate limit                — applied once, globally, at the end of computeHealthMessages
 *                                (SPEC.md agent D brief item 4): at most one non-urgent
 *                                message per call (= one per app-open, since this pure
 *                                function is invoked once per recomputation) and at most two
 *                                per cycle. URG-01, URG-02 and PMB-01 are exempt — these are
 *                                the three rules the §5 table marks as un-snoozable, and
 *                                treating them as "the urgent rules" for G9 too (not only
 *                                literal `seek_urgent_care` severity) is a deliberate,
 *                                documented choice: PMB-01 is "the highest-value single rule
 *                                in the whole app" per the research and must never be
 *                                silently starved by an unrelated informational message
 *                                that happened to claim the cycle's budget first.
 */
import type {
  BleedingEpisode,
  Cycle,
  DayLog,
  HealthMessage,
  HormonalMethodKind,
  Profile,
  Settings,
} from "@/lib/domain/types";
import { addDays, compare, diffDays, type CivilDate, rangeInclusive } from "@/lib/date/civil";
import { median } from "@/lib/stat";
import { COVERAGE_GUARDS } from "@/lib/engine/constants";
import { HEALTH_COPY, HMB_03_REASON_PHRASES, type HealthRuleId, type HealthSeverity } from "@/lib/copy/health";

// ============================================================================
// URG-01's explicit systemic-symptom checkboxes — see the module doc comment above.
// ============================================================================

export type UrgentSystemicSymptom =
  | "chest_pain"
  | "shortness_of_breath"
  | "lightheaded_or_dizzy"
  | "feeling_faint";

// ============================================================================
// Persisted, cross-call state (G8 snooze + G9's per-cycle counter). A pure function
// cannot know "was this shown to the user" on its own — see the doc comment on
// `HealthAwarenessState.nonUrgentShownThisCycle` for the caller's side of this contract.
// ============================================================================

export interface HealthAwarenessState {
  /** G8: per-rule dismissal. Never consulted for URG-01, URG-02 or PMB-01. */
  dismissals: Partial<Record<HealthRuleId, { dismissedOn: CivilDate }>>;
  /**
   * G9's second clause ("at most two per cycle"). The caller (repo/UI layer, not this
   * pure engine) is responsible for incrementing this every time it actually *displays*
   * a non-urgent message to the user, and for persisting it keyed by which cycle it
   * belongs to. This function only ever *reads* it to decide how much budget remains —
   * it never mutates it, because SPEC.md R3 forbids this file from having side effects.
   */
  nonUrgentShownThisCycle: { cycleStartDate: CivilDate; count: number } | null;
}

export const EMPTY_HEALTH_AWARENESS_STATE: HealthAwarenessState = {
  dismissals: {},
  nonUrgentShownThisCycle: null,
};

export interface HealthAwarenessInput {
  dayLogs: DayLog[];
  profile: Profile;
  cycles: Cycle[];
  episodes: BleedingEpisode[];
  today: CivilDate;
  /** Explicit, user-ticked systemic-symptom checkboxes (URG-01 only), keyed by the day
   * they were ticked. Never inferred from flow data — see the module doc comment. */
  urgentSymptomsByDate: Partial<Record<CivilDate, UrgentSystemicSymptom[]>>;
  state: HealthAwarenessState;
}

// ============================================================================
// Small date/life-stage helpers. No `new Date()` anywhere in this file (SPEC.md R1) —
// CivilDate is a fixed-width "YYYY-MM-DD" string, so reading the year back out is plain
// string parsing, not date arithmetic.
// ============================================================================

function civilYear(date: CivilDate): number {
  return Number(date.slice(0, 4));
}

function ageYears(profile: Profile, today: CivilDate): number | null {
  if (profile.birthYear === undefined) return null;
  return civilYear(today) - profile.birthYear;
}

function gynAgeYears(profile: Profile, today: CivilDate): number | null {
  if (profile.menarcheYear === undefined) return null;
  return civilYear(today) - profile.menarcheYear;
}

/** Most recent day with any logged bleeding (menstrual or spotting) on or before
 * `today`, expressed as days-ago. `null` if nothing has ever been logged. */
function daysSinceLastBleed(dayLogs: DayLog[], today: CivilDate): number | null {
  let latest: CivilDate | null = null;
  for (const log of dayLogs) {
    if (log.bleeding !== "none" && compare(log.date, today) <= 0) {
      if (latest === null || compare(log.date, latest) > 0) latest = log.date;
    }
  }
  return latest === null ? null : diffDays(latest, today);
}

// ============================================================================
// Guards G2–G7 (life-stage/context predicates)
// ============================================================================

function isG2Active(profile: Profile, today: CivilDate): boolean {
  const { pregnant, breastfeeding, deliveryDate } = profile.state;
  if (pregnant || breastfeeding) return true;
  if (deliveryDate !== undefined) {
    const days = diffDays(deliveryDate, today);
    if (days >= 0 && days < 180) return true;
  }
  return false;
}

function isRecentHormonalMethodStart(profile: Profile, today: CivilDate): boolean {
  const hm = profile.state.hormonalMethod;
  if (!hm) return false;
  const days = diffDays(hm.startedOn, today);
  return days >= 0 && days < 180;
}

/** [choice] Methods treated as reliably ongoing-bleeding-suppressing for the AMEN-*
 * permanent-suppression clause of G3. Combined/progestin-only pills, the patch and the
 * ring can still produce a regular withdrawal bleed, so they are *not* included here —
 * only the <180-day form of G3 applies to them. Documented in the final report. */
const BLEEDING_SUPPRESSING_METHODS: ReadonlyArray<HormonalMethodKind> = [
  "hormonal_iud",
  "implant",
  "injection",
];

function isBleedingSuppressingMethodOngoing(profile: Profile): boolean {
  const hm = profile.state.hormonalMethod;
  if (!hm) return false;
  if (profile.state.stoppedHormonalOn !== undefined) return false;
  return BLEEDING_SUPPRESSING_METHODS.includes(hm.kind);
}

function isRecentCopperIud(profile: Profile, today: CivilDate): boolean {
  const inserted = profile.state.copperIudInsertedOn;
  if (inserted === undefined) return false;
  const days = diffDays(inserted, today);
  return days >= 0 && days < 365;
}

function isPerimenopauseActive(profile: Profile, today: CivilDate): boolean {
  const age = ageYears(profile, today);
  return profile.state.perimenopauseSelfDeclared || (age !== null && age >= 45);
}

function isPostmenopauseActive(profile: Profile, dayLogs: DayLog[], today: CivilDate): boolean {
  const age = ageYears(profile, today);
  const eligible = profile.state.menopauseSelfDeclared || (age !== null && age >= 45);
  if (!eligible) return false;
  const gap = daysSinceLastBleed(dayLogs, today);
  return gap !== null && gap >= 365;
}

function isAdolescent(profile: Profile, today: CivilDate): boolean {
  const gynAge = gynAgeYears(profile, today);
  return gynAge !== null && gynAge < 3;
}

// ============================================================================
// Shared per-day / per-episode data helpers
// ============================================================================

function dayLogsByDate(dayLogs: DayLog[]): Map<CivilDate, DayLog> {
  return new Map(dayLogs.map((d) => [d.date, d]));
}

function sortedByStartDateDesc(episodes: BleedingEpisode[]): BleedingEpisode[] {
  return [...episodes].sort((a, b) => compare(b.startDate, a.startDate));
}

function episodeDays(episode: BleedingEpisode): CivilDate[] {
  if (episode.endDate === null) return [];
  return rangeInclusive(episode.startDate, episode.endDate);
}

/**
 * Recent cycles with a known length, most-recent-first, excluding cycles the user
 * excluded and cycles still in progress. Used as the "last N logged cycles" window
 * throughout the CYC-* and DYS-02 rules.
 */
function recentCompletedCycles(cycles: Cycle[], n: number): Cycle[] {
  return [...cycles]
    .filter((c) => c.status !== "excluded_by_user" && c.status !== "in_progress" && c.lengthDays !== null)
    .sort((a, b) => a.index - b.index)
    .slice(0, n);
}

// ============================================================================
// G1 coverage guards (03-additional-data-and-safety.md §6, transcribed into
// lib/engine/constants.ts's COVERAGE_GUARDS by agent F). "A rule that lacks its
// underlying data must not fire" — every rule family below is gated by one of these
// before its trigger condition is even evaluated.
// ============================================================================

/**
 * [choice] The §6 table's "≥90% of expected bleed-days logged" isn't directly
 * computable from `Cycle`/`BleedingEpisode` summaries alone (that would need per-day
 * "was a bleed day expected here" ground truth this engine doesn't have). As a
 * conservative proxy for general day-logging diligence over the window, this measures
 * what fraction of *all* calendar days in the window have *any* DayLog entry at all.
 * Documented as an approximation in the final report.
 */
function overallLoggingCoveragePct(dayLogs: DayLog[], windowStart: CivilDate, windowEnd: CivilDate): number {
  const totalDays = diffDays(windowStart, windowEnd) + 1;
  if (totalDays <= 0) return 0;
  const logged = new Set(dayLogs.map((d) => d.date));
  let count = 0;
  for (const day of rangeInclusive(windowStart, windowEnd)) {
    if (logged.has(day)) count++;
  }
  return count / totalDays;
}

function hasCycCoverage(
  cycles: Cycle[],
  dayLogs: DayLog[],
  today: CivilDate,
): { ok: boolean; window: Cycle[] } {
  const window = recentCompletedCycles(cycles, COVERAGE_GUARDS.CYC.minCompleteCycles);
  if (window.length < COVERAGE_GUARDS.CYC.minCompleteCycles) return { ok: false, window };
  const hasUnexplainedGap = window.some(
    (c) => c.status === "gap_unknown" && (c.lengthDays ?? 0) > COVERAGE_GUARDS.CYC.maxUnexplainedGapDays,
  );
  if (hasUnexplainedGap) return { ok: false, window };
  const oldest = window[window.length - 1];
  const coverage = overallLoggingCoveragePct(dayLogs, oldest.startDate, today);
  if (coverage < COVERAGE_GUARDS.CYC.minExpectedBleedDayCoveragePct) return { ok: false, window };
  return { ok: true, window };
}

function hasExplicitBoundaries(episode: BleedingEpisode, dayLogs: DayLog[]): boolean {
  const startLog = dayLogs.find((d) => d.date === episode.startDate);
  const hasExplicitStart = startLog?.periodBoundary === "start";
  const hasExplicitEnd = episode.endDate !== null && !episode.endInferred;
  return Boolean(hasExplicitStart) && hasExplicitEnd;
}

function completeEpisodesWithExplicitBoundaries(
  episodes: BleedingEpisode[],
  dayLogs: DayLog[],
): BleedingEpisode[] {
  return episodes.filter((e) => e.endDate !== null && hasExplicitBoundaries(e, dayLogs));
}

function hmbCoverageOk(episode: BleedingEpisode, byDate: Map<CivilDate, DayLog>): boolean {
  if (episode.endDate === null) return false;
  const days = episodeDays(episode);
  if (days.length === 0) return false;
  let logged = 0;
  for (const day of days) {
    const log = byDate.get(day);
    if (log && (log.flow !== undefined || log.productChanges !== undefined)) logged++;
  }
  return logged / days.length >= COVERAGE_GUARDS.HMB_01_02_03.minPerDayProductOrFlowLoggingCoveragePct;
}

// ============================================================================
// Per-episode "is this period heavy" signals, shared by HMB-01..05.
// ============================================================================

/**
 * [choice] `DayLog` records the day's product-change *count* and the *shortest*
 * interval between any two changes, not a literal "sustained pace" field. This proxy
 * treats a day as matching "changing every {maxHours} hours for >{minSpanHours}
 * consecutive hours" when the shortest logged interval is at or under `maxHours` *and*
 * the implied span across all the day's changes ((count − 1) × shortest interval) meets
 * `minSpanHours`. Documented in the final report as a data-model limitation.
 */
function fastChangeSpanHours(log: DayLog, maxIntervalHours: number): number | null {
  if (log.fastestProductChangeHours === undefined || log.productChanges === undefined) return null;
  if (log.fastestProductChangeHours > maxIntervalHours) return null;
  const span = (log.productChanges - 1) * log.fastestProductChangeHours;
  return span > 0 ? span : null;
}

function episodeHasFastProductChanges(
  episode: BleedingEpisode,
  byDate: Map<CivilDate, DayLog>,
): { has: boolean; hours: number } {
  let bestHours = 0;
  for (const day of episodeDays(episode)) {
    const log = byDate.get(day);
    if (!log) continue;
    const span = fastChangeSpanHours(log, 2);
    if (span !== null && span >= 2 && span > bestHours) bestHours = span;
  }
  return { has: bestHours > 0, hours: bestHours };
}

function episodeHasQualifyingClots(episode: BleedingEpisode, byDate: Map<CivilDate, DayLog>): boolean {
  return episodeDays(episode).some((day) => byDate.get(day)?.clots === "ge_2_5cm");
}

type Hmb03Reason = keyof typeof HMB_03_REASON_PHRASES;

function episodeOtherHmbReasons(
  episode: BleedingEpisode,
  byDate: Map<CivilDate, DayLog>,
): Set<Hmb03Reason> {
  const reasons = new Set<Hmb03Reason>();
  for (const day of episodeDays(episode)) {
    const log = byDate.get(day);
    if (!log) continue;
    if (log.doubleProtection) reasons.add("doubleProtection");
    if (log.nightChange) reasons.add("nightChange");
    if (log.leakThrough) reasons.add("leakThrough");
  }
  return reasons;
}

function episodeIsHeavy(episode: BleedingEpisode, byDate: Map<CivilDate, DayLog>): boolean {
  return (
    episodeHasFastProductChanges(episode, byDate).has ||
    episodeHasQualifyingClots(episode, byDate) ||
    episodeOtherHmbReasons(episode, byDate).size > 0
  );
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ============================================================================
// Message construction
// ============================================================================

function fillTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = params[key];
    return v === undefined ? match : String(v);
  });
}

function buildMessage(
  ruleId: HealthRuleId,
  params: Record<string, string | number> = {},
  overrides: Partial<Pick<HealthMessage, "severity">> = {},
): HealthMessage {
  const copy = HEALTH_COPY[ruleId];
  return {
    ruleId,
    severity: overrides.severity ?? copy.severity,
    message: fillTemplate(copy.messageTemplate, params),
    sourceName: copy.sourceName,
    sourceUrl: copy.sourceUrl,
    sourceThreshold: copy.sourceThreshold,
    dismissible: copy.dismissible,
  };
}

/** HMB-01/02/03 under G4 (copper IUD <365 days): severity downgraded to informational,
 * with the ACOG copper-IUD context line appended (03-additional-data-and-safety.md §5,
 * G4: "downgrade HMB-* severity to informational and append the ACOG context line"). */
function buildHmbMessage(
  ruleId: "HMB-01" | "HMB-02" | "HMB-03",
  params: Record<string, string | number>,
  downgrade: boolean,
): HealthMessage {
  const base = buildMessage(ruleId, params, downgrade ? { severity: "informational" } : {});
  if (!downgrade) return base;
  return { ...base, message: `${base.message} ${HEALTH_COPY["CTX-01"].messageTemplate}` };
}

// ============================================================================
// Rule context — everything the per-rule evaluators need, computed once per call.
// ============================================================================

interface RuleContext {
  dayLogs: DayLog[];
  profile: Profile;
  cycles: Cycle[];
  episodes: BleedingEpisode[];
  today: CivilDate;
  urgentSymptomsByDate: Partial<Record<CivilDate, UrgentSystemicSymptom[]>>;
  byDate: Map<CivilDate, DayLog>;
  age: number | null;
  gynAge: number | null;
  g2: boolean;
  g3RecentStart: boolean;
  g4RecentCopperIud: boolean;
  g5Perimenopause: boolean;
  g6Postmenopause: boolean;
  g7Adolescent: boolean;
}

function buildContext(input: HealthAwarenessInput): RuleContext {
  const { dayLogs, profile, cycles, episodes, today, urgentSymptomsByDate } = input;
  return {
    dayLogs,
    profile,
    cycles,
    episodes,
    today,
    urgentSymptomsByDate,
    byDate: dayLogsByDate(dayLogs),
    age: ageYears(profile, today),
    gynAge: gynAgeYears(profile, today),
    g2: isG2Active(profile, today),
    g3RecentStart: isRecentHormonalMethodStart(profile, today),
    g4RecentCopperIud: isRecentCopperIud(profile, today),
    g5Perimenopause: isPerimenopauseActive(profile, today),
    g6Postmenopause: isPostmenopauseActive(profile, dayLogs, today),
    g7Adolescent: isAdolescent(profile, today),
  };
}

// ============================================================================
// CYC-01 / CYC-01i / CYC-02 / CYC-02i — cycle frequency
// (03-additional-data-and-safety.md §2.1's two-tier rule: FIGO 24–38 as the primary
// adult band, ACOG's 21–35 as the "disagreement zone" that only escalates when the
// coverage guard's persistence requirement — ≥4 of the last 6 cycles in the zone — is
// met.) Caller (computeHealthMessages) is responsible for G2/G5/G6/G7 gating; this
// function only evaluates coverage (G1) + the trigger itself.
// ============================================================================

function evaluateCycleFrequency(ctx: RuleContext): HealthMessage[] {
  const coverage = hasCycCoverage(ctx.cycles, ctx.dayLogs, ctx.today);
  if (!coverage.ok) return [];
  const lengths = coverage.window.map((c) => c.lengthDays as number);
  const n = Math.round(median(lengths));

  const shortCount = lengths.filter((l) => l < 21).length;
  const zoneShortCount = lengths.filter((l) => l >= 21 && l <= 23).length;
  const longCount = lengths.filter((l) => l > 38).length;
  const zoneLongCount = lengths.filter((l) => l >= 36 && l <= 38).length;

  const out: HealthMessage[] = [];
  if (shortCount >= 3) {
    out.push(buildMessage("CYC-01", { n }));
  } else if (zoneShortCount >= COVERAGE_GUARDS.CYC_DISAGREEMENT_ZONE.minCyclesInZone) {
    out.push(buildMessage("CYC-01i", { n }));
  }
  if (longCount >= 3) {
    out.push(buildMessage("CYC-02", { n }));
  } else if (zoneLongCount >= COVERAGE_GUARDS.CYC_DISAGREEMENT_ZONE.minCyclesInZone) {
    out.push(buildMessage("CYC-02i", { n }));
  }
  return out;
}

// ============================================================================
// CYC-03 — regularity (shortest-to-longest spread), FIGO's age-banded bounds.
// ============================================================================

function figoRegularityBoundDays(age: number): number | null {
  if (age >= 18 && age <= 25) return 9;
  if (age >= 26 && age <= 41) return 7;
  if (age >= 42 && age <= 45) return 9;
  return null; // [choice] FIGO's age-banded regularity table only covers 18–45.
}

function evaluateCyc03(ctx: RuleContext): HealthMessage | null {
  if (ctx.age === null) return null; // [choice] can't pick the right band — stay silent.
  const k = figoRegularityBoundDays(ctx.age);
  if (k === null) return null;
  const coverage = hasCycCoverage(ctx.cycles, ctx.dayLogs, ctx.today);
  if (!coverage.ok) return null;
  const lengths = coverage.window.map((c) => c.lengthDays as number);
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  if (longest - shortest > k) {
    return buildMessage("CYC-03", { a: shortest, b: longest, k });
  }
  return null;
}

// ============================================================================
// CYC-04 — adolescent band (ACOG CO 651: 21–45 days).
// ============================================================================

function evaluateCyc04(ctx: RuleContext): HealthMessage | null {
  if (!ctx.g7Adolescent) return null;
  const window = recentCompletedCycles(ctx.cycles, 6);
  if (window.length < 3) return null; // [choice] reasonable minimum before firing.
  const lengths = window.map((c) => c.lengthDays as number);
  const n = Math.round(median(lengths));
  if (n < 21 || n > 45) {
    return buildMessage("CYC-04", { n });
  }
  return null;
}

// ============================================================================
// DUR-01i / DUR-02 — prolonged menses.
// ============================================================================

function evaluateDurationFamily(ctx: RuleContext): HealthMessage[] {
  const complete = completeEpisodesWithExplicitBoundaries(ctx.episodes, ctx.dayLogs);
  if (complete.length < COVERAGE_GUARDS.DUR.minCompleteBleedingEpisodesWithExplicitBoundaries) return [];

  const ordered = sortedByStartDateDesc(complete);
  const out: HealthMessage[] = [];

  const mostRecent = ordered[0];
  if (mostRecent && (mostRecent.durationDays ?? 0) > 7) {
    out.push(buildMessage("DUR-01i", { n: mostRecent.durationDays as number }));
  }

  const last3 = ordered.slice(0, 3);
  const over8 = last3.filter((e) => (e.durationDays ?? 0) > 8).length;
  if (over8 >= 2) {
    out.push(buildMessage("DUR-02", { k: over8 }));
  }
  return out;
}

// ============================================================================
// HMB-01..05 — heavy menstrual bleeding self-report criteria.
// ============================================================================

function findHmb01Trigger(
  episodes: BleedingEpisode[],
  byDate: Map<CivilDate, DayLog>,
): { n: number } | null {
  const candidates = sortedByStartDateDesc(episodes).filter((e) => hmbCoverageOk(e, byDate));
  for (const e of candidates) {
    const { has, hours } = episodeHasFastProductChanges(e, byDate);
    if (has) return { n: Math.round(hours) };
  }
  return null;
}

function findHmb02Trigger(
  episodes: BleedingEpisode[],
  byDate: Map<CivilDate, DayLog>,
): { k: number } | null {
  const last3 = sortedByStartDateDesc(episodes).filter((e) => hmbCoverageOk(e, byDate)).slice(0, 3);
  const qualifying = last3.filter((e) => episodeHasQualifyingClots(e, byDate)).length;
  return qualifying >= 2 ? { k: qualifying } : null;
}

function findHmb03Trigger(
  episodes: BleedingEpisode[],
  byDate: Map<CivilDate, DayLog>,
): { k: number; reasons: string[] } | null {
  const last3 = sortedByStartDateDesc(episodes).filter((e) => hmbCoverageOk(e, byDate)).slice(0, 3);
  const qualifying = last3.filter((e) => episodeOtherHmbReasons(e, byDate).size > 0);
  if (qualifying.length < 2) return null;
  const reasonSet = new Set<string>();
  for (const e of qualifying) {
    for (const r of episodeOtherHmbReasons(e, byDate)) reasonSet.add(HMB_03_REASON_PHRASES[r]);
  }
  return { k: qualifying.length, reasons: [...reasonSet] };
}

function findHmb04Trigger(
  episodes: BleedingEpisode[],
  dayLogs: DayLog[],
  byDate: Map<CivilDate, DayLog>,
  urgentSymptomsByDate: Partial<Record<CivilDate, UrgentSystemicSymptom[]>>,
): boolean {
  const ordered = sortedByStartDateDesc(episodes).filter((e) => hmbCoverageOk(e, byDate));
  if (ordered.length < COVERAGE_GUARDS.HMB_04.minQualifyingEpisodes) return false;
  const lastThree = ordered.slice(0, 3);
  if (lastThree.length < 3 || !lastThree.every((e) => episodeIsHeavy(e, byDate))) return false;
  const windowStart = lastThree[2].startDate;
  const fatigueLogged = dayLogs.some(
    (d) => compare(d.date, windowStart) >= 0 && d.symptoms.includes("fatigue"),
  );
  const breathlessLogged = Object.entries(urgentSymptomsByDate).some(([date, symptoms]) => {
    const day = date as CivilDate;
    return compare(day, windowStart) >= 0 && (symptoms ?? []).includes("shortness_of_breath");
  });
  return fatigueLogged || breathlessLogged;
}

function findHmb05Trigger(
  episodes: BleedingEpisode[],
  byDate: Map<CivilDate, DayLog>,
  gynAge: number | null,
): boolean {
  if (gynAge === null || gynAge < 1) return false;
  const ordered = episodes.filter((e) => hmbCoverageOk(e, byDate));
  if (ordered.length < COVERAGE_GUARDS.HMB_05.minQualifyingEpisodes) return false;
  const heavyCount = ordered.filter((e) => episodeIsHeavy(e, byDate)).length;
  return heavyCount / ordered.length >= 0.8;
}

function evaluateHmbFamily(ctx: RuleContext, suppressHmb05ByG3: boolean): HealthMessage[] {
  const out: HealthMessage[] = [];
  const downgrade = ctx.g4RecentCopperIud;

  const hmb01 = findHmb01Trigger(ctx.episodes, ctx.byDate);
  if (hmb01) out.push(buildHmbMessage("HMB-01", { n: hmb01.n }, downgrade));

  const hmb02 = findHmb02Trigger(ctx.episodes, ctx.byDate);
  if (hmb02) out.push(buildHmbMessage("HMB-02", { k: hmb02.k }, downgrade));

  const hmb03 = findHmb03Trigger(ctx.episodes, ctx.byDate);
  if (hmb03) {
    out.push(buildHmbMessage("HMB-03", { k: hmb03.k, reasons: formatList(hmb03.reasons) }, downgrade));
  }

  if (findHmb04Trigger(ctx.episodes, ctx.dayLogs, ctx.byDate, ctx.urgentSymptomsByDate)) {
    out.push(buildMessage("HMB-04", {}));
  }

  if (!suppressHmb05ByG3 && findHmb05Trigger(ctx.episodes, ctx.byDate, ctx.gynAge)) {
    out.push(buildMessage("HMB-05", {}));
  }

  return out;
}

// ============================================================================
// URG-01 — the red-flag combination. Fires regardless of every other guard (G2–G9);
// requires explicit, user-ticked symptom checkboxes, never inferred flow data
// (03-additional-data-and-safety.md §2.7, §3.3). SPEC.md agent D brief deviation (a):
// fires on the bleeding criterion plus ANY ONE systemic symptom, not the conjunction of
// all three ACOG's sentence literally requires.
// ============================================================================

function evaluateUrg01(
  byDate: Map<CivilDate, DayLog>,
  urgentSymptomsByDate: Partial<Record<CivilDate, UrgentSystemicSymptom[]>>,
): HealthMessage | null {
  for (const [date, symptoms] of Object.entries(urgentSymptomsByDate)) {
    if (!symptoms || symptoms.length === 0) continue;
    const log = byDate.get(date as CivilDate);
    if (!log) continue;
    const span = fastChangeSpanHours(log, 1); // "every hour", not "every 1-2 hours"
    if (span !== null && span > 2) {
      return buildMessage("URG-01", {});
    }
  }
  return null;
}

// ============================================================================
// URG-02 — NHS urgent-pain rule. Severity is locale-gated; G8 does not apply.
// ============================================================================

function evaluateUrg02(dayLogs: DayLog[], locale: Settings["locale"]): HealthMessage | null {
  const triggered = dayLogs.some(
    (d) => d.pain.severity === "severe" && d.pain.painkillerDidNotHelp === true,
  );
  if (!triggered) return null;
  const severity: HealthSeverity = locale === "en-GB" ? "seek_urgent_care" : "discuss_with_clinician";
  return buildMessage("URG-02", {}, { severity });
}

// ============================================================================
// DYS-01 / DYS-02 — dysmenorrhea: functional interference, and pain outside the
// expected premenstrual/menstrual window.
// ============================================================================

function evaluateDysFamily(ctx: RuleContext): HealthMessage[] {
  const out: HealthMessage[] = [];

  const completed = sortedByStartDateDesc(ctx.episodes).filter((e) => e.endDate !== null);
  const last3Episodes = completed.slice(0, 3);
  if (last3Episodes.length >= 2) {
    const qualifying = last3Episodes.filter((e) => {
      const days = episodeDays(e);
      const interferedDays = days.filter(
        (d) => (ctx.byDate.get(d)?.pain.interferedWith?.length ?? 0) > 0,
      ).length;
      return interferedDays >= 2;
    }).length;
    if (qualifying >= 2) out.push(buildMessage("DYS-01", { k: qualifying }));
  }

  const last3Cycles = recentCompletedCycles(ctx.cycles, 3);
  if (last3Cycles.length >= 2) {
    let qualifyingCycles = 0;
    for (const cycle of last3Cycles) {
      const episode = cycle.episode;
      const windowStart = addDays(episode.startDate, -3);
      const windowEnd = episode.endDate ?? episode.startDate;
      const cycleEnd = cycle.nextStartDate ?? ctx.today;
      const painOutsideWindow = ctx.dayLogs.some(
        (d) =>
          compare(d.date, cycle.startDate) >= 0 &&
          compare(d.date, cycleEnd) < 0 &&
          d.pain.severity !== "none" &&
          !(compare(d.date, windowStart) >= 0 && compare(d.date, windowEnd) <= 0),
      );
      if (painOutsideWindow) qualifyingCycles++;
    }
    if (qualifyingCycles >= 2) out.push(buildMessage("DYS-02", {}));
  }

  return out;
}

// ============================================================================
// IMB-01 / PCB-01 — intermenstrual and postcoital bleeding.
// ============================================================================

function evaluateImb01(ctx: RuleContext): HealthMessage | null {
  const occurrences = ctx.dayLogs.filter((d) => d.bleedingContext === "intermenstrual");
  if (occurrences.length < 2) return null;
  const cyclesInvolved = new Set<number>();
  for (const occ of occurrences) {
    const cycle = ctx.cycles.find(
      (c) =>
        compare(occ.date, c.startDate) >= 0 &&
        compare(occ.date, c.nextStartDate ?? ctx.today) < 0,
    );
    if (cycle) cyclesInvolved.add(cycle.index);
  }
  if (cyclesInvolved.size < 2) return null;
  return buildMessage("IMB-01", { n: occurrences.length });
}

function evaluatePcb01(dayLogs: DayLog[]): HealthMessage | null {
  const occurrences = dayLogs.filter((d) => d.bleedingContext === "postcoital");
  if (occurrences.length < 2) return null;
  return buildMessage("PCB-01", {});
}

// ============================================================================
// AMEN-01 / AMEN-02 — amenorrhea.
// ============================================================================

/**
 * [choice] Deliberately reads `dayLogs` directly rather than `episodes` — the last
 * logged *day* of menstrual bleeding (R6: spotting never opens a cycle, so only
 * `bleeding === "menstrual"` counts) is a simpler and more robust proxy for "days since
 * your last logged period" than reconstructing a period's first day, and it means
 * AMEN-01/02 keep working correctly even if a caller's `episodes` array is stale or
 * absent, since a fresh `dayLogs` array is always the one thing every caller has.
 */
function maxDateWithBleeding(dayLogs: DayLog[], kind: DayLog["bleeding"]): CivilDate | null {
  let latest: CivilDate | null = null;
  for (const log of dayLogs) {
    if (log.bleeding !== kind) continue;
    if (latest === null || compare(log.date, latest) > 0) latest = log.date;
  }
  return latest;
}

function evaluateAmen01(ctx: RuleContext): HealthMessage | null {
  if (ctx.g2 || ctx.g3RecentStart || isBleedingSuppressingMethodOngoing(ctx.profile)) return null;
  if (ctx.g6Postmenopause) return null;
  const lastMenstrualDay = maxDateWithBleeding(ctx.dayLogs, "menstrual");
  if (lastMenstrualDay === null) return null;
  const n = diffDays(lastMenstrualDay, ctx.today);
  if (n >= COVERAGE_GUARDS.AMEN_01.minAppInstalledDays) {
    return buildMessage("AMEN-01", { n });
  }
  return null;
}

function evaluateAmen02(ctx: RuleContext): HealthMessage | null {
  if (ctx.age === null || ctx.age < 15) return null;
  if (ctx.profile.menarcheYear !== undefined) return null;
  const hasAnyPeriod = maxDateWithBleeding(ctx.dayLogs, "menstrual") !== null;
  if (hasAnyPeriod) return null;
  return buildMessage("AMEN-02", {});
}

// ============================================================================
// PMB-01 — postmenopausal bleeding. The single highest-value rule per the research.
// Ignores every guard except G1 (needs at least one prior bleed date to compute a gap);
// overrides G5; never snoozed by G8; exempt from G9's rate limit (see module doc).
// ============================================================================

function evaluatePmb01(ctx: RuleContext): HealthMessage | null {
  const eligible = ctx.profile.state.menopauseSelfDeclared || (ctx.age !== null && ctx.age >= 45);
  if (!eligible) return null;
  const bleedingDates = [...new Set(ctx.dayLogs.filter((d) => d.bleeding !== "none").map((d) => d.date))].sort(
    (a, b) => compare(a, b),
  );
  if (bleedingDates.length < 2) return null; // G1: needs >=1 prior bleed date + the new one.
  const latest = bleedingDates[bleedingDates.length - 1];
  const previous = bleedingDates[bleedingDates.length - 2];
  if (diffDays(previous, latest) >= 365) {
    return buildMessage("PMB-01", {});
  }
  return null;
}

// ============================================================================
// PERI-01 — perimenopause variability note (substitutes for CYC-01/02/03 under G5).
// ============================================================================

function evaluatePeri01(ctx: RuleContext): HealthMessage | null {
  const window = recentCompletedCycles(ctx.cycles, COVERAGE_GUARDS.PERI_01.minCycles);
  const selfDeclared = ctx.profile.state.perimenopauseSelfDeclared;
  if (window.length < COVERAGE_GUARDS.PERI_01.minCycles && !selfDeclared) return null;

  let variable = false;
  if (window.length >= 2) {
    const lengths = window.map((c) => c.lengthDays as number);
    if (Math.max(...lengths) - Math.min(...lengths) > 9) variable = true;
  }
  const anyBigGap = window.some((c) => (c.lengthDays ?? 0) >= 60);
  if (variable || anyBigGap) {
    return buildMessage("PERI-01", {});
  }
  return null;
}

// ============================================================================
// G8 snooze + G9 rate limit
// ============================================================================

function isSnoozed(ruleId: HealthRuleId, state: HealthAwarenessState, today: CivilDate): boolean {
  const dismissal = state.dismissals[ruleId];
  if (!dismissal) return false;
  return diffDays(dismissal.dismissedOn, today) < 90;
}

/** [choice] Rough clinical-priority ordering used to pick "the one" non-urgent message
 * G9 allows per app-open, and which messages count first against the per-cycle cap.
 * URG-01/URG-02/PMB-01 are exempt from G9 entirely and never appear in this list. */
const RULE_PRIORITY_ORDER: HealthRuleId[] = [
  "AMEN-01",
  "AMEN-02",
  "HMB-04",
  "HMB-01",
  "HMB-02",
  "DUR-02",
  "DYS-01",
  "IMB-01",
  "PCB-01",
  "HMB-03",
  "HMB-05",
  "CYC-01",
  "CYC-02",
  "DUR-01i",
  "CYC-01i",
  "CYC-02i",
  "CYC-03",
  "CYC-04",
  "DYS-02",
  "PERI-01",
  "CTX-01",
];

function rulePriority(ruleId: HealthRuleId): number {
  const idx = RULE_PRIORITY_ORDER.indexOf(ruleId);
  return idx === -1 ? RULE_PRIORITY_ORDER.length : idx;
}

function currentCycleKey(cycles: Cycle[], today: CivilDate): CivilDate {
  if (cycles.length === 0) return today;
  return [...cycles].sort((a, b) => a.index - b.index)[0].startDate;
}

// ============================================================================
// Orchestration
// ============================================================================

/** The three rules the §5 table marks as un-snoozable and, per this file's documented
 * choice, exempt from G9's rate limit too. */
const NEVER_SUPPRESSED_RULES: ReadonlySet<HealthRuleId> = new Set(["URG-01", "URG-02", "PMB-01"]);

export function computeHealthMessages(input: HealthAwarenessInput): HealthMessage[] {
  const { profile, cycles, state, today } = input;
  const ctx = buildContext(input);

  // URG-01 / URG-02 / PMB-01: evaluated unconditionally, exempt from every other guard.
  const exempt: HealthMessage[] = [];
  const urg01 = evaluateUrg01(ctx.byDate, ctx.urgentSymptomsByDate);
  if (urg01) exempt.push(urg01);
  const urg02 = evaluateUrg02(ctx.dayLogs, profile.settings.locale);
  if (urg02) exempt.push(urg02);
  const pmb01 = evaluatePmb01(ctx);
  if (pmb01) exempt.push(pmb01);

  if (!profile.settings.healthAwarenessEnabled) {
    // [choice] The general feature toggle gates every non-safety-critical rule; the
    // never-suppressed trio still fires — see NEVER_SUPPRESSED_RULES's doc comment.
    return exempt;
  }

  let candidates: HealthMessage[] = [];

  if (!ctx.g6Postmenopause) {
    let suppressedByRecentMethod = false;

    if (!ctx.g2) {
      if (ctx.g7Adolescent) {
        const cyc04 = evaluateCyc04(ctx);
        if (cyc04) {
          if (ctx.g3RecentStart) suppressedByRecentMethod = true;
          else candidates.push(cyc04);
        }
      } else if (!ctx.g5Perimenopause) {
        const freq = evaluateCycleFrequency(ctx);
        const cyc03 = evaluateCyc03(ctx);
        const all = cyc03 ? [...freq, cyc03] : freq;
        if (all.length > 0) {
          if (ctx.g3RecentStart) suppressedByRecentMethod = true;
          else candidates.push(...all);
        }
      }
      // g5Perimenopause && !g7Adolescent: CYC-01/02/03 suppressed; PERI-01 handles it
      // below — no CTX-01 substitution here, since G5 (not G3/G4) is the reason.

      const dur = evaluateDurationFamily(ctx);
      if (dur.length > 0) {
        if (ctx.g3RecentStart || ctx.g4RecentCopperIud) suppressedByRecentMethod = true;
        else candidates.push(...dur);
      }

      const imb = evaluateImb01(ctx);
      if (imb) {
        if (ctx.g3RecentStart) suppressedByRecentMethod = true;
        else candidates.push(imb);
      }
    }

    // HMB-*, DYS-*, PCB-01, AMEN-*, PERI-01 stay active through pregnancy/postpartum
    // (G2) per the §5 table's Suppressions column — only HMB-05 additionally respects
    // G3's recent-start clause.
    candidates.push(...evaluateHmbFamily(ctx, ctx.g3RecentStart));
    candidates.push(...evaluateDysFamily(ctx));

    const pcb = evaluatePcb01(ctx.dayLogs);
    if (pcb) candidates.push(pcb);

    const amen01 = evaluateAmen01(ctx);
    if (amen01) candidates.push(amen01);

    const amen02 = evaluateAmen02(ctx);
    if (amen02) candidates.push(amen02);

    if (ctx.g5Perimenopause && !ctx.g2) {
      const peri = evaluatePeri01(ctx);
      if (peri) candidates.push(peri);
    }

    if (suppressedByRecentMethod) {
      candidates.push(buildMessage("CTX-01", {}));
    }
  }
  // g6Postmenopause: every other rule suppressed; only PMB-01 (already in `exempt`) fires.

  // G8: snooze/dismiss.
  candidates = candidates.filter((m) => !isSnoozed(m.ruleId as HealthRuleId, state, today));

  // G9: rate limit. Sort by priority, then take at most one, capped further by the
  // per-cycle budget already used this cycle (as reported by the caller in `state`).
  const nonUrgent = [...candidates].sort(
    (a, b) => rulePriority(a.ruleId as HealthRuleId) - rulePriority(b.ruleId as HealthRuleId),
  );
  const cycleKey = currentCycleKey(cycles, today);
  const alreadyShown =
    state.nonUrgentShownThisCycle && state.nonUrgentShownThisCycle.cycleStartDate === cycleKey
      ? state.nonUrgentShownThisCycle.count
      : 0;
  const remainingBudget = Math.max(0, 2 - alreadyShown);
  const selected = remainingBudget > 0 && nonUrgent.length > 0 ? [nonUrgent[0]] : [];

  return [...exempt, ...selected];
}

// Re-exported for tests and for callers that want the raw rule-id/severity/copy
// vocabulary without importing lib/copy/health.ts directly.
export type { HealthRuleId, HealthSeverity };
export { NEVER_SUPPRESSED_RULES };
