/**
 * Pure row <-> domain mapping for the `predictions` table (docs/DB-MIGRATION.md §3.4).
 * No I/O, no database handle — `lib/repo/predictions.ts` calls these to translate
 * between the Drizzle row shape and `PredictionRecord`. Unit-tested exhaustively with
 * NO database per DB-MIGRATION.md §4.1; this file is the sole home of the
 * `low`/`high` (domain, `predictionRecordSchema`) <-> `predicted_low`/`predicted_high`
 * (column) renaming and of the numeric-id <-> string-id conversion.
 */
import type { CivilDate } from "@/lib/date/civil";
import type { predictions } from "@/lib/db/schema";
import type { PredictionRecord } from "@/lib/repo/predictions";

export type PredictionRow = typeof predictions.$inferSelect;
/** The insertable shape for a new prediction — everything but the autoincrement `id`,
 * which MySQL assigns on insert. Derived from the (fully-required) select row type
 * rather than Drizzle's insert type so every field this function produces is always
 * present — never omitted — matching the "never silently discard data" spirit of
 * SPEC.md R7; it remains assignable everywhere `typeof predictions.$inferInsert` is
 * expected, since a value with every optional field populated is always assignable to
 * the wider (optional-field) insert type. */
export type NewPredictionRow = Omit<PredictionRow, "id">;

/** `PredictionRecord` minus `id` — what `issuePrediction` has validated before a row
 * (and therefore an id) exists. */
export type PredictionRecordInput = Omit<PredictionRecord, "id">;

/** Domain -> insert row. `record.low`/`record.high` (the field names
 * `predictionRecordSchema` and callers use) map onto the `predicted_low`/
 * `predicted_high` columns; every other field is a straight rename to snake_case. */
export function toInsertRow(record: PredictionRecordInput): NewPredictionRow {
  return {
    issuedOn: record.issuedOn,
    predictedCenter: record.predictedCenter,
    predictedLow: record.low,
    predictedHigh: record.high,
    resolvedActualStart: record.resolvedActualStart,
    signedError: record.signedError,
    covered: record.covered,
  };
}

/** Row -> domain. The numeric autoincrement `id` is stringified: `PredictionRecord.id`
 * stays `string` (DB-MIGRATION.md §3.4 — the domain-facing shape is byte-identical to
 * the pre-migration one even though the underlying id is now a MySQL `BIGINT`). Date
 * columns are `CHAR(10)` and already "YYYY-MM-DD" at rest, so the cast to `CivilDate`
 * is a type-level assertion only, not a re-parse. */
export function fromRow(row: PredictionRow): PredictionRecord {
  return {
    id: String(row.id),
    issuedOn: row.issuedOn as CivilDate,
    predictedCenter: row.predictedCenter as CivilDate | null,
    low: row.predictedLow as CivilDate | null,
    high: row.predictedHigh as CivilDate | null,
    resolvedActualStart: row.resolvedActualStart as CivilDate | null,
    signedError: row.signedError,
    covered: row.covered,
  };
}
