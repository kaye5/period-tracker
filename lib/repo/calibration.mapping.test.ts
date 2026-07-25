/**
 * Pure round-trip tests for lib/repo/calibration.mapping.ts — no database
 * (docs/DB-MIGRATION.md §4.1). Covers: empty coverage, an ordered coverage array
 * preserved exactly (including out-of-order input rows being re-sorted by position),
 * and cumulativeAdjustment.
 */
import { describe, expect, it } from "vitest";
import { CALIBRATION_ID, fromRows, toRows, type CalibrationCoverageRow, type CalibrationRow } from "@/lib/repo/calibration.mapping";
import type { CalibrationState } from "@/lib/domain/types";

describe("lib/repo/calibration.mapping", () => {
  it("toRows maps the singleton row at the fixed id and cumulativeAdjustment straight through", () => {
    const state: CalibrationState = { cumulativeAdjustment: 1.3, recentCoverage: [] };
    const { row } = toRows(state);
    expect(row).toEqual({ id: CALIBRATION_ID, cumulativeAdjustment: 1.3 });
  });

  it("toRows produces no coverage rows for an empty history", () => {
    const { coverageRows } = toRows({ cumulativeAdjustment: 1.0, recentCoverage: [] });
    expect(coverageRows).toEqual([]);
  });

  it("toRows assigns 0-based positions in array order (most recent last)", () => {
    const { coverageRows } = toRows({ cumulativeAdjustment: 1.0, recentCoverage: [true, true, false] });
    expect(coverageRows).toEqual([
      { position: 0, covered: true },
      { position: 1, covered: true },
      { position: 2, covered: false },
    ]);
  });

  it("fromRows returns an empty recentCoverage array when there are no coverage rows", () => {
    const row: CalibrationRow = { id: CALIBRATION_ID, cumulativeAdjustment: 1.0 };
    expect(fromRows(row, [])).toEqual({ cumulativeAdjustment: 1.0, recentCoverage: [] });
  });

  it("fromRows preserves the ordered coverage array exactly", () => {
    const row: CalibrationRow = { id: CALIBRATION_ID, cumulativeAdjustment: 1.3 };
    const coverageRows: CalibrationCoverageRow[] = [
      { position: 0, covered: true },
      { position: 1, covered: true },
      { position: 2, covered: false },
    ];
    expect(fromRows(row, coverageRows)).toEqual({
      cumulativeAdjustment: 1.3,
      recentCoverage: [true, true, false],
    });
  });

  it("fromRows re-sorts coverage rows by position, regardless of input order", () => {
    const row: CalibrationRow = { id: CALIBRATION_ID, cumulativeAdjustment: 1.0 };
    const coverageRows: CalibrationCoverageRow[] = [
      { position: 2, covered: false },
      { position: 0, covered: true },
      { position: 1, covered: true },
    ];
    expect(fromRows(row, coverageRows).recentCoverage).toEqual([true, true, false]);
  });

  it("toRows -> fromRows round-trips cumulativeAdjustment and an ordered coverage array", () => {
    const original: CalibrationState = { cumulativeAdjustment: 0.85, recentCoverage: [false, true, true, false] };
    const { row, coverageRows } = toRows(original);
    expect(fromRows(row, coverageRows)).toEqual(original);
  });

  it("toRows -> fromRows round-trips the empty-coverage neutral state", () => {
    const original: CalibrationState = { cumulativeAdjustment: 1.0, recentCoverage: [] };
    const { row, coverageRows } = toRows(original);
    expect(fromRows(row, coverageRows)).toEqual(original);
  });
});
