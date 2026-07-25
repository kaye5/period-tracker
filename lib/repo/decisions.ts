/**
 * User decisions, now split across three relational tables instead of one Mongo
 * collection (DB-MIGRATION.md §3.5-3.7):
 *
 * - `excluded_cycles` + `skip_prompt_decisions` together back `UserDecisions`
 *   (lib/domain/types.ts) — `skipPrompts` (answers to skip-suspected prompts) and
 *   `excludedCycles` (user-excluded cycles). `getUserDecisions` reads both and
 *   reassembles the exact aggregate shape callers already depend on.
 * - `health_message_decisions` is a separate, sibling table for dismissed/snoozed health
 *   messages — not part of `UserDecisions` (it isn't in SPEC.md §3's fixed type contract
 *   at all), which is why it gets its own table and its own small API here rather than a
 *   field bolted onto `UserDecisions` (that would mean editing lib/domain/types.ts, an
 *   F-owned file).
 *
 * All row <-> domain conversion lives in lib/repo/decisions.mapping.ts; this file is a
 * thin Drizzle wrapper around it plus the read-after-write pattern the old Mongo version
 * used (every mutator returns the freshly-reassembled `UserDecisions`).
 */
import { eq } from "drizzle-orm";
import type { CivilDate } from "@/lib/date/civil";
import { userDecisionsSchema } from "@/lib/domain/schema";
import type { UserDecisions } from "@/lib/domain/types";
import { getDb, type Db } from "@/lib/db";
import {
  excludedCycles as excludedCyclesTable,
  skipPromptDecisions as skipPromptDecisionsTable,
  healthMessageDecisions as healthMessageDecisionsTable,
} from "@/lib/db/schema";
import {
  fromHealthMessageDecisionRow,
  healthMessageDecisionSchema,
  toExcludedCycleRow,
  toHealthMessageDecisionRow,
  toSkipPromptRow,
  userDecisionsFromRows,
  type HealthMessageDecision,
} from "@/lib/repo/decisions.mapping";

// Re-exported for callers that import these from lib/repo/decisions (their pre-migration
// home) rather than lib/repo/decisions.mapping directly — see components/dashboard/healthState.ts.
export { healthMessageDecisionSchema };
export type { HealthMessageDecision };

export const DEFAULT_USER_DECISIONS: UserDecisions = { excludedCycles: {}, skipPrompts: {} };

async function readUserDecisions(db: Db): Promise<UserDecisions> {
  const [excludedCycleRows, skipPromptRows] = await Promise.all([
    db.select().from(excludedCyclesTable),
    db.select().from(skipPromptDecisionsTable),
  ]);
  return userDecisionsSchema.parse(userDecisionsFromRows({ excludedCycleRows, skipPromptRows }));
}

export async function getUserDecisions(tx?: Db): Promise<UserDecisions> {
  const db = tx ?? getDb();
  return readUserDecisions(db);
}

/** Records the user's answer to a "did you miss logging a period around {date}?"
 * prompt (01-cycle-prediction.md §5.3) — keyed by the gap's start date so the prompt
 * does not keep resurfacing once answered. */
export async function recordSkipPromptAnswer(
  gapStartDate: CivilDate,
  answer: { confirmed: boolean; inferredStartDate?: CivilDate },
  decidedOn: CivilDate,
  tx?: Db,
): Promise<UserDecisions> {
  const db = tx ?? getDb();
  const row = toSkipPromptRow(gapStartDate, { ...answer, decidedOn });
  await db.insert(skipPromptDecisionsTable).values(row).onDuplicateKeyUpdate({ set: row });
  return readUserDecisions(db);
}

/** Marks a cycle as user-excluded (SPEC.md R7: "an excluded cycle stays visible in
 * history, marked, with the reason" — this records the reason; the recomputation that
 * actually excludes it from stats/predictions is lib/engine's job). */
export async function excludeCycle(
  cycleStartDate: CivilDate,
  reason: string,
  decidedOn: CivilDate,
  tx?: Db,
): Promise<UserDecisions> {
  const db = tx ?? getDb();
  const row = toExcludedCycleRow(cycleStartDate, { reason, decidedOn });
  await db.insert(excludedCyclesTable).values(row).onDuplicateKeyUpdate({ set: row });
  return readUserDecisions(db);
}

export async function unexcludeCycle(cycleStartDate: CivilDate, tx?: Db): Promise<UserDecisions> {
  const db = tx ?? getDb();
  await db.delete(excludedCyclesTable).where(eq(excludedCyclesTable.cycleStartDate, cycleStartDate));
  return readUserDecisions(db);
}

// ---------------------------------------------------------------------------
// Health-message decisions (dismiss/snooze) — see file header.
// ---------------------------------------------------------------------------

export async function getHealthMessageDecision(
  ruleId: string,
  tx?: Db,
): Promise<HealthMessageDecision | null> {
  const db = tx ?? getDb();
  const rows = await db
    .select()
    .from(healthMessageDecisionsTable)
    .where(eq(healthMessageDecisionsTable.ruleId, ruleId))
    .limit(1);
  const row = rows[0];
  return row ? fromHealthMessageDecisionRow(row) : null;
}

export async function listHealthMessageDecisions(tx?: Db): Promise<HealthMessageDecision[]> {
  const db = tx ?? getDb();
  const rows = await db.select().from(healthMessageDecisionsTable);
  return rows.map(fromHealthMessageDecisionRow);
}

/** `dismissed`/`snoozedUntil` default to the existing record's values (or `false`/`null`
 * for a brand-new one) so a caller can update just one of the two without clobbering the
 * other — unlike day logs (see lib/repo/dayLogs.ts's comment), a dismiss action and a
 * snooze action are genuinely independent, so a partial update here does not risk
 * silently discarding unrelated user data. */
export async function setHealthMessageDecision(
  ruleId: string,
  update: { dismissed?: boolean; snoozedUntil?: CivilDate | null },
  decidedOn: CivilDate,
  tx?: Db,
): Promise<HealthMessageDecision> {
  const db = tx ?? getDb();
  const existing = await getHealthMessageDecision(ruleId, db);
  const validated = healthMessageDecisionSchema.parse({
    ruleId,
    dismissed: update.dismissed ?? existing?.dismissed ?? false,
    snoozedUntil: update.snoozedUntil !== undefined ? update.snoozedUntil : (existing?.snoozedUntil ?? null),
    decidedOn,
  });
  const row = toHealthMessageDecisionRow(validated);
  await db.insert(healthMessageDecisionsTable).values(row).onDuplicateKeyUpdate({ set: row });
  return validated;
}

/** Hard delete of every decision across all three tables — part of the "permanent
 * delete" flow. One transaction, so a failure partway through never leaves the tables
 * inconsistent with each other. Returns the total number of rows removed, matching the
 * old single-collection `deleteMany({}).deletedCount` semantics. */
export async function deleteAllDecisions(tx?: Db): Promise<number> {
  const db = tx ?? getDb();
  return db.transaction(async (t) => {
    const [excludedResult] = await t.delete(excludedCyclesTable);
    const [skipResult] = await t.delete(skipPromptDecisionsTable);
    const [healthResult] = await t.delete(healthMessageDecisionsTable);
    return (
      (excludedResult.affectedRows ?? 0) +
      (skipResult.affectedRows ?? 0) +
      (healthResult.affectedRows ?? 0)
    );
  });
}
