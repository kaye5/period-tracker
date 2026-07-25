/**
 * `predictions` — one row per issued prediction, kept purely for performance
 * measurement and calibration (SPEC.md's Collections section: "issuedOn,
 * predictedCenter, low, high, resolvedActualStart, signedError, covered"). This is NOT
 * the same thing as `PredictionResult` (lib/domain/types.ts) — that's agent B's
 * computed, re-derivable-from-scratch *display* value (SPEC.md R2); this is a small,
 * durable record of what was predicted and how it turned out, so agent B's
 * lib/engine/performance.ts has something to compute rolling error/hit-rate from.
 *
 * lib/domain/schema.ts (F-owned) has no schema for this shape — it isn't part of the
 * F-owned type contract in SPEC.md §3 — so its validation schema is authored here,
 * reusing `civilDateSchema` for date fields exactly as F's schemas do.
 *
 * Storage: `predictions` (docs/DB-MIGRATION.md §3.4) — a MySQL `BIGINT AUTO_INCREMENT`
 * PK. `PredictionRecord.id` stays `string` (the domain-facing contract is unchanged);
 * `lib/repo/predictions.mapping.ts` does the id stringification and the
 * `low`/`high` <-> `predicted_low`/`predicted_high` column renaming.
 */
import { z } from "zod";
import { asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { CivilDate } from "@/lib/date/civil";
import { compare, diffDays } from "@/lib/date/civil";
import { civilDateSchema } from "@/lib/domain/schema";
import { getDb, predictions, type Db } from "@/lib/db";
import { fromRow, toInsertRow, type PredictionRecordInput } from "@/lib/repo/predictions.mapping";

export const predictionRecordSchema = z.object({
  issuedOn: civilDateSchema,
  predictedCenter: civilDateSchema.nullable(),
  low: civilDateSchema.nullable(),
  high: civilDateSchema.nullable(),
  resolvedActualStart: civilDateSchema.nullable(),
  signedError: z.number().nullable(),
  covered: z.boolean().nullable(),
});

export type PredictionRecord = z.infer<typeof predictionRecordSchema> & { id: string };

/** Parses a `PredictionRecord.id` (a stringified `BIGINT`) back to the numeric PK.
 * Returns `null` for anything that isn't a positive integer string, so a malformed or
 * unknown id is treated as "not found" rather than throwing. */
function parseId(id: string): number | null {
  if (!/^\d+$/.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function issuePrediction(
  input: {
    issuedOn: CivilDate;
    predictedCenter: CivilDate | null;
    low: CivilDate | null;
    high: CivilDate | null;
  },
  tx?: Db,
): Promise<PredictionRecord> {
  const db = tx ?? getDb();
  const validated: PredictionRecordInput = predictionRecordSchema.parse({
    ...input,
    resolvedActualStart: null,
    signedError: null,
    covered: null,
  });
  const [result] = await db.insert(predictions).values(toInsertRow(validated));
  return { ...validated, id: String(result.insertId) };
}

export async function listPredictions(
  filter?: { resolved?: boolean },
  tx?: Db,
): Promise<PredictionRecord[]> {
  const db = tx ?? getDb();
  const whereClause =
    filter?.resolved === true
      ? isNotNull(predictions.resolvedActualStart)
      : filter?.resolved === false
        ? isNull(predictions.resolvedActualStart)
        : undefined;
  const rows = whereClause
    ? await db.select().from(predictions).where(whereClause).orderBy(asc(predictions.issuedOn))
    : await db.select().from(predictions).orderBy(asc(predictions.issuedOn));
  return rows.map(fromRow);
}

/**
 * Resolves a previously issued prediction against the actual observed period start.
 * `signedError`/`covered` are simple date arithmetic via lib/date/civil (not "the
 * engine" — R3 governs lib/engine/**, not this data-layer bookkeeping): `signedError`
 * is positive when the period arrived later than the predicted center, negative when
 * earlier. The rolling aggregates (median absolute error, window hit rate) are agent
 * B's lib/engine/performance.ts's job, computed from the list this returns — not here.
 */
export async function resolvePrediction(
  id: string,
  actualStart: CivilDate,
  tx?: Db,
): Promise<PredictionRecord | null> {
  const db = tx ?? getDb();
  const numericId = parseId(id);
  if (numericId === null) return null;

  const [row] = await db.select().from(predictions).where(eq(predictions.id, numericId));
  if (!row) return null;

  const predicted = fromRow(row);
  const signedError = predicted.predictedCenter ? diffDays(predicted.predictedCenter, actualStart) : null;
  const covered =
    predicted.low && predicted.high
      ? compare(actualStart, predicted.low) >= 0 && compare(actualStart, predicted.high) <= 0
      : null;
  const update = { resolvedActualStart: actualStart, signedError, covered };
  await db.update(predictions).set(update).where(eq(predictions.id, numericId));
  return { ...predicted, ...update };
}

/** Hard delete of every prediction record — part of the "permanent delete" flow. */
export async function deleteAllPredictions(tx?: Db): Promise<number> {
  const db = tx ?? getDb();
  const [result] = await db.delete(predictions);
  return result.affectedRows ?? 0;
}
