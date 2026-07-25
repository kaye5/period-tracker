/**
 * Generates a realistic, fully deterministic 14-cycle history (plus one in-progress
 * cycle) so every other agent can exercise the interesting paths without hand-writing
 * fixtures (SPEC.md's G brief). Run via `pnpm db:seed` (see package.json — it invokes
 * this through scripts/register-ts-loader.mjs so plain `node` can run TypeScript with
 * the same "@/" alias and extensionless imports the rest of the codebase uses, with no
 * ts-node/tsx dependency; see that file's header for why).
 *
 * Deliberately included, per the brief:
 *   - one skipped log producing a ~58-day gap (cycle index SKIPPED_LOG_GAP_CYCLE_INDEX)
 *   - one spotting-only episode that must NOT open a cycle (mid-cycle in
 *     SPOTTING_ONLY_CYCLE_INDEX, R6)
 *   - one cycle with sparse symptom logging that should fail the insight coverage gate
 *     (SPARSE_SYMPTOM_CYCLE_INDEX — bleeding days are logged normally; every other day
 *     in that cycle is left entirely unlogged)
 *   - one 9-day period, firing DUR-02 (NINE_DAY_PERIOD_CYCLE_INDEX)
 *   - a recurring premenstrual symptom (cramps) strong enough to produce a real insight,
 *     present on 5 of the last 7 days before the next period in every cycle except the
 *     two data-sparse ones above, and absent in each cycle's postmenstrual reference
 *     window — well past MIN_QUALIFYING_CYCLES_TO_CLAIM (5; constants.ts)
 *   - one in-progress cycle (the most recent period, with no next start yet)
 *
 * All randomness is seeded from a fixed constant (SEED) — re-running this script against
 * a fresh database always produces byte-identical dates and field values.
 */
import { sql } from "drizzle-orm";
import { addDays, compare, diffDays, parseCivil, type CivilDate } from "../lib/date/civil";
import type { DayLog, FlowLevel, MoodId, Profile, SymptomId } from "../lib/domain/types";
import { upsertDayLog } from "../lib/repo/dayLogs";
import { upsertProfile } from "../lib/repo/profile";
import { excludeCycle, setHealthMessageDecision } from "../lib/repo/decisions";
import { updateCalibrationState } from "../lib/repo/calibration";
import { issuePrediction, resolvePrediction } from "../lib/repo/predictions";
import { closeDb, getDb } from "../lib/db/client";

// ============================================================================
// Deterministic PRNG — mulberry32. Same seed -> same sequence, every run, forever.
// ============================================================================
const SEED = 20260722;
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function chance(p: number): boolean {
  return rng() < p;
}

// ============================================================================
// Cycle-history layout
// ============================================================================
const SEED_TODAY: CivilDate = parseCivil("2026-07-22");
const ONGOING_START: CivilDate = addDays(SEED_TODAY, -7); // periodStarts[14]; today = cycle day 8

/** 14 gaps between 15 period starts = 14 completed cycles, ending at ONGOING_START. */
const GAP_DAYS = [29, 30, 28, 27, 31, 29, 58, 28, 29, 30, 27, 29, 28, 30] as const;

const SKIPPED_LOG_GAP_CYCLE_INDEX = 6; // GAP_DAYS[6] === 58
const NINE_DAY_PERIOD_CYCLE_INDEX = 9; // fires DUR-02
const SPARSE_SYMPTOM_CYCLE_INDEX = 3; // fails the insight coverage gate
const SPOTTING_ONLY_CYCLE_INDEX = 5; // isolated spotting, must not open a cycle (R6)
const EXCLUDED_CYCLE_INDEX = 11; // an ordinary cycle, for the excludedCycles example

const periodStarts: CivilDate[] = new Array(15);
periodStarts[14] = ONGOING_START;
for (let i = 13; i >= 0; i--) {
  periodStarts[i] = addDays(periodStarts[i + 1], -GAP_DAYS[i]);
}

// ============================================================================
// Day-log construction
// ============================================================================
const logsByDate = new Map<CivilDate, DayLog>();
function addLog(log: DayLog): void {
  logsByDate.set(log.date, log);
}

function periodLengthFor(cycleIndex: number): number {
  if (cycleIndex === NINE_DAY_PERIOD_CYCLE_INDEX) return 9;
  return 4 + Math.floor(rng() * 3); // deterministic jitter: 4, 5, or 6
}

function flowForOffset(offset: number, periodLen: number): FlowLevel {
  if (offset === 0 || offset === periodLen - 1) return "light";
  if (offset === 1 || offset === 2) return chance(0.5) ? "heavy" : "medium";
  return "medium";
}

function logMenstrualDay(date: CivilDate, offset: number, periodLen: number): void {
  const flow = flowForOffset(offset, periodLen);
  const heavy = flow === "heavy";
  addLog({
    date,
    bleeding: "menstrual",
    flow,
    periodBoundary: offset === 0 ? "start" : offset === periodLen - 1 ? "end" : undefined,
    clots: heavy ? "small" : "none",
    productChanges: heavy ? 5 : flow === "light" ? 2 : 3,
    doubleProtection: heavy && chance(0.3) ? true : undefined,
    nightChange: heavy && chance(0.2) ? true : undefined,
    pain: {
      severity: heavy ? "moderate" : "mild",
      sites: heavy ? ["lower_abdomen"] : undefined,
      interferedWith: heavy && chance(0.4) ? ["sleep"] : undefined,
    },
    symptoms: heavy && chance(0.6) ? ["cramps"] : [],
    mood: chance(0.2) ? [pick<MoodId>(["irritable", "low", "calm"])] : undefined,
    loggedAt: date,
  });
}

const NOISE_SYMPTOMS: readonly SymptomId[] = ["bloating", "fatigue", "headache", "sleep_change"];

function logNonBleedingDay(date: CivilDate, symptoms: SymptomId[], nothingToReport: boolean): void {
  addLog({
    date,
    bleeding: "none",
    pain: { severity: symptoms.includes("cramps") ? "mild" : "none" },
    symptoms,
    nothingToReport: nothingToReport ? true : undefined,
    mood: symptoms.length > 0 && chance(0.3) ? [pick<MoodId>(["irritable", "sensitive", "low"])] : undefined,
    loggedAt: date,
  });
}

function logSpottingDay(date: CivilDate): void {
  // Isolated intermenstrual spotting — deliberately NOT a periodBoundary assertion, and
  // far from any real period, so the cycle engine must not treat it as one (R6: spotting
  // never opens a cycle).
  addLog({
    date,
    bleeding: "spotting",
    flow: "spotting",
    bleedingContext: "intermenstrual",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: date,
  });
}

for (let i = 0; i < GAP_DAYS.length; i++) {
  const start = periodStarts[i];
  const cycleLen = GAP_DAYS[i];
  const periodLen = periodLengthFor(i);
  const isSparse = i === SPARSE_SYMPTOM_CYCLE_INDEX;
  const isGapTail = i === SKIPPED_LOG_GAP_CYCLE_INDEX;

  for (let offset = 0; offset < periodLen; offset++) {
    logMenstrualDay(addDays(start, offset), offset, periodLen);
  }

  if (isSparse || isGapTail) {
    // Deliberately no further logging this cycle: `isSparse` fails the insight
    // coverage gate on ordinary cycle-length data; `isGapTail` is the ~58-day gap
    // itself (the *next* cycle's GAP_DAYS entry is 58 — this cycle simply stops being
    // logged until the next real period start).
    continue;
  }

  const premenstrualStart = cycleLen - 7;
  const referenceStart = Math.max(periodLen, 4);
  const referenceEnd = referenceStart + 6;

  for (let offset = periodLen; offset < cycleLen; offset++) {
    const date = addDays(start, offset);

    if (offset >= premenstrualStart) {
      // Backward-anchored premenstrual window (W_PREMENSTRUAL, constants.ts): cramps
      // present on exactly 5 of these 7 days, every qualifying cycle — a deliberate,
      // consistent signal for the paired sign test (02-symptom-insights.md §E).
      const withinWindow = offset - premenstrualStart; // 0..6
      const crampsToday = withinWindow < 5;
      logNonBleedingDay(date, crampsToday ? ["cramps"] : [], !crampsToday);
    } else if (offset >= referenceStart && offset <= referenceEnd) {
      // Postmenstrual reference window (W_FOLLICULAR_REF): kept clean of cramps so the
      // premenstrual signal above is unambiguous.
      logNonBleedingDay(date, [], true);
    } else if (chance(0.15)) {
      logNonBleedingDay(date, [pick(NOISE_SYMPTOMS)], false);
    } else {
      logNonBleedingDay(date, [], true);
    }
  }

  if (i === SPOTTING_ONLY_CYCLE_INDEX) {
    // Mid-cycle, well clear of both the period itself and the premenstrual window on
    // either side.
    logSpottingDay(addDays(start, 15));
  }
}

// The in-progress (15th) cycle: bleeding logged, no next start yet.
const ONGOING_PERIOD_LEN = 5;
for (let offset = 0; offset < ONGOING_PERIOD_LEN; offset++) {
  logMenstrualDay(addDays(ONGOING_START, offset), offset, ONGOING_PERIOD_LEN);
}
for (let offset = ONGOING_PERIOD_LEN; offset < diffDays(ONGOING_START, SEED_TODAY); offset++) {
  logNonBleedingDay(addDays(ONGOING_START, offset), [], true);
}

const allDayLogs = [...logsByDate.values()].sort((a, b) => compare(a.date, b.date));

// ============================================================================
// Profile — fertility and Tier C enabled so U-agents have both surfaces to build
// against; every other setting is a plausible, non-default onboarding answer.
// ============================================================================
const profile: Profile = {
  birthYear: 1994,
  menarcheYear: 2008,
  reportedTypicalCycleLength: 29,
  reportedTypicalPeriodDays: 5,
  reportedRegularity: "variable",
  state: {
    pregnant: false,
    breastfeeding: false,
    perimenopauseSelfDeclared: false,
    menopauseSelfDeclared: false,
    knownIrregular: false,
    preferNotToSay: false,
  },
  settings: {
    fertilityEnabled: true,
    tierCSymptomsEnabled: true,
    healthAwarenessEnabled: true,
    notifications: {
      periodReminder: true,
      fertileReminder: true,
      symptomReminder: true,
      medicationReminder: false,
      loggingReminder: true,
      healthAwareness: true,
      privateWording: true,
    },
    locale: "en-US",
  },
};

// ============================================================================
// Main — wipe, then seed every table. Retries the initial connection to ride out a
// transient cold-start failure (container still booting, DNS not yet resolvable, etc.).
// ============================================================================

/** Every table this schema defines, truncated with FK checks off so order never matters
 * (belt-and-suspenders — mirrors lib/repo/testUtils.ts's truncateAll, which this
 * duplicates rather than imports: that module is test-only, and this script must run
 * standalone via `pnpm db:seed` with no vitest in the loop). */
const ALL_TABLES = [
  "day_log_symptoms",
  "day_log_moods",
  "day_log_pain_sites",
  "day_log_pain_interference",
  "day_logs",
  "calibration_coverage",
  "calibration",
  "predictions",
  "excluded_cycles",
  "skip_prompt_decisions",
  "health_message_decisions",
  "profile",
] as const;

async function waitForDb(maxAttempts = 20, delayMs = 1000): Promise<void> {
  const db = getDb();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.execute(sql`SELECT 1`);
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`  waiting for the database... (attempt ${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main(): Promise<void> {
  console.log("Connecting to the database...");
  await waitForDb();

  console.log("Wiping existing tables for a deterministic re-seed...");
  const db = getDb();
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  try {
    for (const table of ALL_TABLES) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }

  console.log(`Writing ${allDayLogs.length} day logs...`);
  for (const log of allDayLogs) {
    await upsertDayLog(log);
  }

  console.log("Writing profile...");
  await upsertProfile(profile);

  console.log("Writing calibration state...");
  await updateCalibrationState({
    cumulativeAdjustment: 1.15,
    recentCoverage: [true, true, false, true, true],
  });

  console.log("Writing decisions (one excluded cycle, one snoozed health message)...");
  await excludeCycle(
    periodStarts[EXCLUDED_CYCLE_INDEX],
    "Logged while traveling across time zones — this cycle's flow pattern doesn't reflect a typical cycle.",
    addDays(periodStarts[EXCLUDED_CYCLE_INDEX + 1], 2),
  );
  await setHealthMessageDecision(
    "CYC-02",
    { snoozedUntil: addDays(SEED_TODAY, 30) },
    addDays(SEED_TODAY, -10),
  );
  // Deliberately NOT answering the skip-suspected prompt for the 58-day gap
  // (SKIPPED_LOG_GAP_CYCLE_INDEX, see lib/repo/decisions.ts's recordSkipPromptAnswer) —
  // it stays open so other agents can build/test the actual prompt UI against a live,
  // unresolved case.

  console.log("Writing prediction history (resolved for completed cycles, one open)...");
  for (let i = 9; i < 14; i++) {
    const issuedOn = periodStarts[i];
    const predictedCenter = addDays(issuedOn, 29);
    const rec = await issuePrediction({
      issuedOn,
      predictedCenter,
      low: addDays(predictedCenter, -4),
      high: addDays(predictedCenter, 4),
    });
    await resolvePrediction(rec.id, periodStarts[i + 1]);
  }
  // The live, unresolved prediction for the in-progress cycle.
  await issuePrediction({
    issuedOn: ONGOING_START,
    predictedCenter: addDays(ONGOING_START, 29),
    low: addDays(ONGOING_START, 25),
    high: addDays(ONGOING_START, 33),
  });

  console.log("\nSeed summary:");
  console.log(`  day logs:        ${allDayLogs.length}`);
  console.log(`  period starts:   ${periodStarts.length} (14 completed cycles + 1 in progress)`);
  console.log(`  58-day gap:      ${periodStarts[SKIPPED_LOG_GAP_CYCLE_INDEX]} -> ${periodStarts[SKIPPED_LOG_GAP_CYCLE_INDEX + 1]}`);
  console.log(`  9-day period at: ${periodStarts[NINE_DAY_PERIOD_CYCLE_INDEX]}`);
  console.log(`  sparse cycle at: ${periodStarts[SPARSE_SYMPTOM_CYCLE_INDEX]}`);
  console.log(`  spotting-only:   ${addDays(periodStarts[SPOTTING_ONLY_CYCLE_INDEX], 15)}`);
  console.log(`  in-progress:     ${ONGOING_START} (today = ${SEED_TODAY})`);
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
