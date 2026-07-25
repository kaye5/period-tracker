/**
 * Pure mapping between the three decisions tables (DB-MIGRATION.md §3.5-3.7) and the
 * domain shapes they back:
 *
 * - `excluded_cycles` + `skip_prompt_decisions` together assemble `UserDecisions`
 *   (lib/domain/types.ts) — the same aggregate the old single Mongo document held, now
 *   split across two tables and joined back together here.
 * - `health_message_decisions` backs `HealthMessageDecision`, a sibling shape not in
 *   SPEC.md's fixed type contract (lib/repo/decisions.ts's file header explains why it
 *   lives here rather than as a field on `UserDecisions`).
 *
 * No I/O here — row <-> domain conversion only, unit-tested with plain objects and no
 * database (DB-MIGRATION.md §4.1). Each `to*Row` validates its input with the matching
 * zod schema (civil-date format, required fields) before handing back a row, mirroring
 * the validate-at-every-boundary discipline the old Mongo-backed decisions.ts used.
 */
import { z } from "zod";
import type { CivilDate } from "@/lib/date/civil";
import { civilDateSchema } from "@/lib/domain/schema";
import type { UserDecisions } from "@/lib/domain/types";
import type {
  excludedCycles as excludedCyclesTable,
  skipPromptDecisions as skipPromptDecisionsTable,
  healthMessageDecisions as healthMessageDecisionsTable,
} from "@/lib/db/schema";

export type ExcludedCycleRow = typeof excludedCyclesTable.$inferSelect;
export type SkipPromptRow = typeof skipPromptDecisionsTable.$inferSelect;
export type HealthMessageDecisionRow = typeof healthMessageDecisionsTable.$inferSelect;

// ============================================================================
// excluded_cycles <-> UserDecisions.excludedCycles
// ============================================================================

const excludedCycleEntrySchema = z.object({
  reason: z.string(),
  decidedOn: civilDateSchema,
});
export type ExcludedCycleEntry = z.infer<typeof excludedCycleEntrySchema>;

export function toExcludedCycleRow(
  cycleStartDate: CivilDate,
  entry: ExcludedCycleEntry,
): ExcludedCycleRow {
  const validated = excludedCycleEntrySchema.parse(entry);
  return {
    cycleStartDate: civilDateSchema.parse(cycleStartDate),
    reason: validated.reason,
    decidedOn: validated.decidedOn,
  };
}

/** One row -> its `[cycleStartDate, entry]` pair, for callers that read a single row
 * (e.g. a future `getExcludedCycle`) without wanting the whole-map helper below. */
export function fromExcludedCycleRow(
  row: ExcludedCycleRow,
): { cycleStartDate: CivilDate; reason: string; decidedOn: CivilDate } {
  return {
    cycleStartDate: row.cycleStartDate as CivilDate,
    reason: row.reason,
    decidedOn: row.decidedOn as CivilDate,
  };
}

export function excludedCyclesFromRows(rows: ExcludedCycleRow[]): UserDecisions["excludedCycles"] {
  const out: UserDecisions["excludedCycles"] = {};
  for (const row of rows) {
    const { cycleStartDate, reason, decidedOn } = fromExcludedCycleRow(row);
    out[cycleStartDate] = { reason, decidedOn };
  }
  return out;
}

// ============================================================================
// skip_prompt_decisions <-> UserDecisions.skipPrompts
// ============================================================================

const skipPromptEntrySchema = z.object({
  confirmed: z.boolean(),
  inferredStartDate: civilDateSchema.optional(),
  decidedOn: civilDateSchema,
});
export type SkipPromptEntry = z.infer<typeof skipPromptEntrySchema>;

export function toSkipPromptRow(gapStartDate: CivilDate, entry: SkipPromptEntry): SkipPromptRow {
  const validated = skipPromptEntrySchema.parse(entry);
  return {
    gapStartDate: civilDateSchema.parse(gapStartDate),
    confirmed: validated.confirmed,
    inferredStartDate: validated.inferredStartDate ?? null,
    decidedOn: validated.decidedOn,
  };
}

export function fromSkipPromptRow(
  row: SkipPromptRow,
): { gapStartDate: CivilDate; confirmed: boolean; inferredStartDate?: CivilDate; decidedOn: CivilDate } {
  return {
    gapStartDate: row.gapStartDate as CivilDate,
    confirmed: row.confirmed,
    inferredStartDate: (row.inferredStartDate as CivilDate | null) ?? undefined,
    decidedOn: row.decidedOn as CivilDate,
  };
}

export function skipPromptsFromRows(rows: SkipPromptRow[]): UserDecisions["skipPrompts"] {
  const out: UserDecisions["skipPrompts"] = {};
  for (const row of rows) {
    const { gapStartDate, confirmed, inferredStartDate, decidedOn } = fromSkipPromptRow(row);
    out[gapStartDate] = { confirmed, inferredStartDate, decidedOn };
  }
  return out;
}

// ============================================================================
// Both tables together -> the full UserDecisions aggregate.
// ============================================================================

export function userDecisionsFromRows(input: {
  excludedCycleRows: ExcludedCycleRow[];
  skipPromptRows: SkipPromptRow[];
}): UserDecisions {
  return {
    excludedCycles: excludedCyclesFromRows(input.excludedCycleRows),
    skipPrompts: skipPromptsFromRows(input.skipPromptRows),
  };
}

// ============================================================================
// health_message_decisions <-> HealthMessageDecision
// ============================================================================

export const healthMessageDecisionSchema = z.object({
  ruleId: z.string(),
  dismissed: z.boolean(),
  snoozedUntil: civilDateSchema.nullable(),
  decidedOn: civilDateSchema,
});
export type HealthMessageDecision = z.infer<typeof healthMessageDecisionSchema>;

export function toHealthMessageDecisionRow(decision: HealthMessageDecision): HealthMessageDecisionRow {
  const validated = healthMessageDecisionSchema.parse(decision);
  return {
    ruleId: validated.ruleId,
    dismissed: validated.dismissed,
    snoozedUntil: validated.snoozedUntil,
    decidedOn: validated.decidedOn,
  };
}

export function fromHealthMessageDecisionRow(row: HealthMessageDecisionRow): HealthMessageDecision {
  return healthMessageDecisionSchema.parse({
    ruleId: row.ruleId,
    dismissed: row.dismissed,
    snoozedUntil: row.snoozedUntil,
    decidedOn: row.decidedOn,
  });
}
