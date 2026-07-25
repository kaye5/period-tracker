/**
 * Real round-trip tests for lib/repo/calibration.ts against MySQL — the singleton
 * `calibration` row plus its ordered `calibration_coverage` child rows
 * (docs/DB-MIGRATION.md §3.8). The coverage array's order matters (most recent last) and
 * a rewrite must fully replace the previous coverage rows, not append to them.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { DEFAULT_CALIBRATION_STATE, deleteCalibrationState, getCalibrationState, updateCalibrationState } from "@/lib/repo/calibration";
import { closeDb, describeIfDb, ensureMigrationsApplied, itIfDb, truncateAll } from "@/lib/repo/testUtils";

describeIfDb("lib/repo/calibration.ts (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("getCalibrationState returns DEFAULT_CALIBRATION_STATE before any write", async () => {
    expect(await getCalibrationState()).toEqual(DEFAULT_CALIBRATION_STATE);
  });

  itIfDb("updateCalibrationState round-trips cumulativeAdjustment and an ordered coverage array", async () => {
    const state = {
      cumulativeAdjustment: 1.35,
      recentCoverage: [true, true, false, true, false, false, true],
    };
    const saved = await updateCalibrationState(state);
    expect(saved).toEqual(state);

    const fetched = await getCalibrationState();
    expect(fetched).toEqual(state);
    // Order matters (0-based, most recent last) — not just the same multiset.
    expect(fetched.recentCoverage).toEqual([true, true, false, true, false, false, true]);
  });

  itIfDb("a second write fully replaces the coverage rows, not appends to them", async () => {
    await updateCalibrationState({
      cumulativeAdjustment: 1.1,
      recentCoverage: [true, true, true, true, true, true, true, true, true, true],
    });

    const shorter = {
      cumulativeAdjustment: 0.9,
      recentCoverage: [false, true],
    };
    await updateCalibrationState(shorter);

    const fetched = await getCalibrationState();
    expect(fetched.recentCoverage).toEqual([false, true]);
    expect(fetched.recentCoverage.length).toBe(2);
    expect(fetched.cumulativeAdjustment).toBe(0.9);
  });

  itIfDb("updateCalibrationState handles an empty coverage array", async () => {
    await updateCalibrationState({ cumulativeAdjustment: 1.5, recentCoverage: [false] });
    const saved = await updateCalibrationState({ cumulativeAdjustment: 1.0, recentCoverage: [] });
    expect(saved.recentCoverage).toEqual([]);
    expect(await getCalibrationState()).toEqual({ cumulativeAdjustment: 1.0, recentCoverage: [] });
  });

  itIfDb("deleteCalibrationState hard-deletes; a subsequent read falls back to the default", async () => {
    await updateCalibrationState({ cumulativeAdjustment: 1.2, recentCoverage: [true, false] });
    expect(await deleteCalibrationState()).toBe(true);
    expect(await getCalibrationState()).toEqual(DEFAULT_CALIBRATION_STATE);
    expect(await deleteCalibrationState()).toBe(false);
  });
});
