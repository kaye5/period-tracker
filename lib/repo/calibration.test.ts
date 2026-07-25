/**
 * Tests for the parts of lib/repo/calibration.ts that don't require a database:
 * `DEFAULT_CALIBRATION_STATE` and the `calibrationStateSchema` validation boundary. The
 * actual read/write functions (getCalibrationState, updateCalibrationState,
 * deleteCalibrationState) now do real Drizzle I/O and are exercised by the integration
 * suite (lib/repo/__integration__/**, owned by the seed/test-infra agent) against a
 * real MySQL, per docs/DB-MIGRATION.md §4. The row<->domain mapping they depend on
 * (ordered coverage <-> position column) is unit-tested with no database in
 * lib/repo/calibration.mapping.test.ts.
 */
import { describe, expect, it } from "vitest";
import { calibrationStateSchema } from "@/lib/domain/schema";
import { DEFAULT_CALIBRATION_STATE } from "@/lib/repo/calibration";

describe("lib/repo/calibration", () => {
  it("DEFAULT_CALIBRATION_STATE is the neutral multiplier with no coverage history", () => {
    expect(DEFAULT_CALIBRATION_STATE).toEqual({ cumulativeAdjustment: 1.0, recentCoverage: [] });
  });

  it("DEFAULT_CALIBRATION_STATE satisfies its own schema", () => {
    expect(() => calibrationStateSchema.parse(DEFAULT_CALIBRATION_STATE)).not.toThrow();
  });

  it("calibrationStateSchema accepts an ordered coverage history", () => {
    const state = { cumulativeAdjustment: 1.3, recentCoverage: [true, true, false] };
    expect(calibrationStateSchema.parse(state)).toEqual(state);
  });

  it("calibrationStateSchema rejects a non-number cumulativeAdjustment", () => {
    const bad = { cumulativeAdjustment: "not-a-number", recentCoverage: [] };
    expect(() => calibrationStateSchema.parse(bad)).toThrow();
  });

  it("calibrationStateSchema rejects a non-boolean entry in recentCoverage", () => {
    const bad = { cumulativeAdjustment: 1.0, recentCoverage: [true, "false"] };
    expect(() => calibrationStateSchema.parse(bad)).toThrow();
  });
});
