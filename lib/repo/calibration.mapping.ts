/**
 * Pure row <-> domain mapping for the `calibration` singleton + `calibration_coverage`
 * child table (docs/DB-MIGRATION.md §3.8). No I/O, no database handle —
 * `lib/repo/calibration.ts` calls these to translate between the two Drizzle row shapes
 * and `CalibrationState`. Unit-tested exhaustively with NO database per
 * DB-MIGRATION.md §4.1.
 *
 * `recentCoverage` is an *ordered* array, most recent last (lib/domain/types.ts). The
 * relational shape preserves that order explicitly via `calibration_coverage.position`
 * (0-based) rather than relying on row-insertion order, which SQL never guarantees.
 */
import type { CalibrationState } from "@/lib/domain/types";
import type { calibration, calibrationCoverage } from "@/lib/db/schema";

/** Fixed PK of the single `calibration` row (docs/DB-MIGRATION.md §3.8). */
export const CALIBRATION_ID = 1;

export type CalibrationRow = typeof calibration.$inferSelect;
export type CalibrationCoverageRow = typeof calibrationCoverage.$inferSelect;

/** `toRows` always populates every field (both tables have no columns this mapping
 * would legitimately omit), so it returns the fully-required select-row shapes rather
 * than Drizzle's insert types — those stay assignable everywhere an insert value is
 * expected, since a fully-populated object is always assignable to a type where some of
 * those same fields are merely optional. */
export interface CalibrationRows {
  row: CalibrationRow;
  coverageRows: CalibrationCoverageRow[];
}

/** Domain -> rows, for a full rewrite: the singleton row plus the ordered set of
 * coverage rows (position 0..n-1, most recent last — same order as
 * `state.recentCoverage`). The caller is responsible for replacing (not merely
 * upserting) the coverage rows in one transaction, per DB-MIGRATION.md §3.8. */
export function toRows(state: CalibrationState): CalibrationRows {
  return {
    row: { id: CALIBRATION_ID, cumulativeAdjustment: state.cumulativeAdjustment },
    coverageRows: state.recentCoverage.map((covered, position) => ({ position, covered })),
  };
}

/** Rows -> domain. `coverageRows` need not already be ordered — this sorts by
 * `position` ascending before dropping down to the plain `boolean[]` the domain type
 * expects, so a caller (e.g. a future query without an explicit `ORDER BY`) can't
 * silently corrupt the sequence. */
export function fromRows(row: CalibrationRow, coverageRows: CalibrationCoverageRow[]): CalibrationState {
  const ordered = [...coverageRows].sort((a, b) => a.position - b.position);
  return {
    cumulativeAdjustment: row.cumulativeAdjustment,
    recentCoverage: ordered.map((r) => r.covered),
  };
}
