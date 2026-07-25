import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import { engineOutputSchema } from "@/lib/domain/schema";
import { DEFAULT_PROFILE } from "@/lib/repo/profile";
import { DEFAULT_USER_DECISIONS } from "@/lib/repo/decisions";
import { DEFAULT_CALIBRATION_STATE } from "@/lib/repo/calibration";
import { computeEverything } from "@/lib/repo/computeEngineOutput";

// This file only guards the PLACEHOLDER (see this module's header comment for the swap
// point). It intentionally does not test any real cycle/prediction/insight logic — that
// is agents A-E's and I's responsibility once lib/engine/index.ts exists.
describe("lib/repo/computeEngineOutput (placeholder for lib/engine/index.ts)", () => {
  it("always returns a shape that satisfies engineOutputSchema", () => {
    const output = computeEverything({
      dayLogs: [],
      profile: DEFAULT_PROFILE,
      today: parseCivil("2026-07-22"),
      decisions: DEFAULT_USER_DECISIONS,
      calibration: DEFAULT_CALIBRATION_STATE,
    });
    expect(() => engineOutputSchema.parse(output)).not.toThrow();
  });

  it("never claims a prediction it cannot back — kind 'none', all dates null, suppressed", () => {
    const output = computeEverything({
      dayLogs: [],
      profile: DEFAULT_PROFILE,
      today: parseCivil("2026-07-22"),
      decisions: DEFAULT_USER_DECISIONS,
      calibration: DEFAULT_CALIBRATION_STATE,
    });
    expect(output.prediction.kind).toBe("none");
    expect(output.prediction.center).toBeNull();
    expect(output.prediction.confidence).toBe("not_enough_information");
    expect(output.prediction.suppressed).toBeDefined();
  });

  it("threads the calibration factor through basis.calibrationFactor", () => {
    const output = computeEverything({
      dayLogs: [],
      profile: DEFAULT_PROFILE,
      today: parseCivil("2026-07-22"),
      decisions: DEFAULT_USER_DECISIONS,
      calibration: { cumulativeAdjustment: 1.42, recentCoverage: [] },
    });
    expect(output.prediction.basis.calibrationFactor).toBe(1.42);
  });
});
