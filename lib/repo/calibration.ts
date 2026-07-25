/**
 * `calibration` — a single row (`id: 1`) holding the current on-device calibration
 * factor, plus the ordered `calibration_coverage` child table holding its recent-
 * coverage history (01-cycle-prediction.md §4.4; `CalibrationState` in
 * lib/domain/types.ts).
 *
 * Storage: `calibration` + `calibration_coverage` (docs/DB-MIGRATION.md §3.8).
 * `lib/repo/calibration.mapping.ts` does the row <-> `CalibrationState` translation,
 * including the `position`-ordered coverage array. Rewriting the state replaces every
 * coverage row inside one transaction (delete all, insert the current array) — SQL row
 * order is never relied upon; `position` is the only source of order.
 */
import { asc, eq } from "drizzle-orm";
import { calibrationStateSchema } from "@/lib/domain/schema";
import type { CalibrationState } from "@/lib/domain/types";
import { calibration, calibrationCoverage, getDb, type Db } from "@/lib/db";
import { CALIBRATION_ID, fromRows, toRows } from "@/lib/repo/calibration.mapping";

/** No adjustment yet: `cumulativeAdjustment: 1.0` is the neutral multiplier (within the
 * type's documented [0.7, 2.0] clamp range), and `recentCoverage: []` reflects that no
 * prediction has been resolved yet to have a coverage outcome. [choice] — the research
 * docs specify the update rule (01-cycle-prediction.md §4.4) but not a starting value,
 * since "no history yet" isn't a state the calibration algorithm itself needs to name. */
export const DEFAULT_CALIBRATION_STATE: CalibrationState = {
  cumulativeAdjustment: 1.0,
  recentCoverage: [],
};

export async function getCalibrationState(tx?: Db): Promise<CalibrationState> {
  const db = tx ?? getDb();
  const [row] = await db.select().from(calibration).where(eq(calibration.id, CALIBRATION_ID));
  if (!row) return DEFAULT_CALIBRATION_STATE;
  const coverageRows = await db
    .select()
    .from(calibrationCoverage)
    .orderBy(asc(calibrationCoverage.position));
  return calibrationStateSchema.parse(fromRows(row, coverageRows));
}

export async function updateCalibrationState(state: CalibrationState, tx?: Db): Promise<CalibrationState> {
  const db = tx ?? getDb();
  const validated = calibrationStateSchema.parse(state);
  const { row, coverageRows } = toRows(validated);
  await db.transaction(async (t) => {
    await t
      .insert(calibration)
      .values(row)
      .onDuplicateKeyUpdate({ set: { cumulativeAdjustment: row.cumulativeAdjustment } });
    await t.delete(calibrationCoverage);
    if (coverageRows.length > 0) {
      await t.insert(calibrationCoverage).values(coverageRows);
    }
  });
  return validated;
}

/** Hard delete — part of the "permanent delete" flow. Also clears
 * `calibration_coverage`, which has no FK back to `calibration` (docs/DB-MIGRATION.md
 * §3.8 declares no cascade for this pair), so it must be cleared explicitly or a future
 * `getCalibrationState` would resurrect stale coverage history against a fresh row. */
export async function deleteCalibrationState(tx?: Db): Promise<boolean> {
  const db = tx ?? getDb();
  return db.transaction(async (t) => {
    const [result] = await t.delete(calibration).where(eq(calibration.id, CALIBRATION_ID));
    await t.delete(calibrationCoverage);
    return (result.affectedRows ?? 0) === 1;
  });
}
