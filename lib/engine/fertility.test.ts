import { describe, expect, it } from "vitest";

import { addDays, diffDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import { LUTEAL_MEAN, LUTEAL_SD } from "@/lib/engine/constants";
import { FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import type { PredictionResult } from "@/lib/domain/types";
import {
  CONFIDENCE_EXTRA_DAYS,
  FERTILE_DAYS_AFTER_OVULATION,
  FERTILE_DAYS_BEFORE_OVULATION,
  estimateFertility,
} from "@/lib/engine/fertility";
import { NORMAL_UPPER_QUANTILE, predictiveSpreadDays } from "@/lib/engine/prediction";

const d = (s: string): CivilDate => parseCivil(s);
const PREDICTED_START = d("2026-08-01");

/**
 * A `PredictionResult` with a chosen predictive spread. `halfWidthDays` is what
 * `predictiveSpreadDays` inverts, so setting it to `tCritical * sPred` pins `s_pred`
 * exactly.
 */
function predictionWithSpread(
  sPred: number,
  confidence: PredictionResult["confidence"] = "more_consistent",
): PredictionResult {
  // effectiveN chosen so the recovered df is large; the exact value does not matter as
  // long as the test inverts with the same df the module uses.
  const effectiveN = 9;
  // tQuantile is re-derived inside predictiveSpreadDays; solve for halfWidth by using the
  // module's own inversion as the source of truth.
  const probe: PredictionResult = {
    kind: "personal",
    center: PREDICTED_START,
    low: addDays(PREDICTED_START, -5),
    high: addDays(PREDICTED_START, 5),
    predictedLengthDays: 29,
    confidence,
    confidenceReason: "Your last 9 cycles have stayed close in length.",
    basis: {
      usableCycles: effectiveN,
      windowCycles: effectiveN,
      effectiveN,
      sigma: 2,
      halfWidthDays: 1,
      calibrationFactor: 1,
    },
  };
  const tCritical = 1 / (predictiveSpreadDays(probe) as number); // halfWidth 1 -> 1/t
  return {
    ...probe,
    basis: { ...probe.basis, halfWidthDays: sPred * tCritical },
  };
}

describe("estimateFertility — structural guarantees", () => {
  it("returns nothing at all when fertility is switched off", () => {
    expect(
      estimateFertility({
        prediction: predictionWithSpread(2.5),
        fertilityEnabled: false,
      }),
    ).toBeNull();
  });

  it("carries the disclaimer INSIDE the estimate on every branch", () => {
    const confidences: PredictionResult["confidence"][] = [
      "not_enough_information",
      "early_estimate",
      "limited",
      "more_consistent",
    ];
    for (const confidence of confidences) {
      for (const sPred of [1.5, 3, 6, 10]) {
        const estimate = estimateFertility({
          prediction: predictionWithSpread(sPred, confidence),
          fertilityEnabled: true,
        });
        expect(estimate).not.toBeNull();
        expect(estimate?.disclaimer).toBe(FERTILITY_DISCLAIMER);
        expect((estimate?.disclaimer ?? "").length).toBeGreaterThan(0);
        expect((estimate?.confidenceNote ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("never uses the words this product is forbidden from using", () => {
    const banned = [
      /\bsafe\b/i,
      /guaranteed/i,
      /confirmed/i,
      /you are ovulating/i,
      /cannot become pregnant/i,
      /accuracy/i,
      /%\s*accurate/i,
    ];
    for (const confidence of [
      "not_enough_information",
      "early_estimate",
      "limited",
      "more_consistent",
    ] as PredictionResult["confidence"][]) {
      const estimate = estimateFertility({
        prediction: predictionWithSpread(3, confidence),
        fertilityEnabled: true,
      });
      const strings = [estimate?.confidenceNote ?? "", estimate?.disclaimer ?? ""];
      for (const s of strings) {
        for (const pattern of banned) {
          expect(s).not.toMatch(pattern);
        }
      }
    }
  });

  it("returns nothing when the prediction is suppressed or has no centre", () => {
    const suppressed: PredictionResult = {
      ...predictionWithSpread(3),
      kind: "none",
      center: null,
      low: null,
      high: null,
      suppressed: { reason: "pregnant" },
    };
    expect(estimateFertility({ prediction: suppressed, fertilityEnabled: true })).toBeNull();
  });
});

describe("estimateFertility — the arithmetic of STEP 5", () => {
  it("estimates ovulation BACKWARD from the predicted period, not forward, and not at day 14", () => {
    const estimate = estimateFertility({
      prediction: predictionWithSpread(2.0),
      fertilityEnabled: true,
    });
    const low = diffDays(estimate?.ovulationLow as CivilDate, PREDICTED_START);
    const high = diffDays(estimate?.ovulationHigh as CivilDate, PREDICTED_START);
    // Both band edges sit before the predicted period start.
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
    // The band brackets LUTEAL_MEAN = 12.5, and is not a 14-day point.
    expect(high).toBeLessThanOrEqual(Math.floor(LUTEAL_MEAN));
    expect(low).toBeGreaterThanOrEqual(Math.ceil(LUTEAL_MEAN));
  });

  it("convolves the prediction spread with LUTEAL_SD: ovulation_sd = sqrt(s_pred^2 + LUTEAL_SD^2)", () => {
    for (const sPred of [1, 2.5, 5]) {
      const estimate = estimateFertility({
        prediction: predictionWithSpread(sPred),
        fertilityEnabled: true,
      });
      expect(estimate?.basis.predictionSpreadDays).toBeCloseTo(sPred, 8);
      expect(estimate?.basis.ovulationSdDays).toBeCloseTo(
        Math.sqrt(sPred * sPred + LUTEAL_SD * LUTEAL_SD),
        8,
      );
      expect(estimate?.basis.ovulationHalfWidthDays).toBeCloseTo(
        NORMAL_UPPER_QUANTILE * Math.sqrt(sPred * sPred + LUTEAL_SD * LUTEAL_SD),
        8,
      );
    }
  });

  it("is never tighter than the luteal SD alone, even with a perfect prediction", () => {
    const estimate = estimateFertility({
      prediction: predictionWithSpread(0.0001),
      fertilityEnabled: true,
    });
    expect(estimate?.basis.ovulationSdDays).toBeGreaterThanOrEqual(LUTEAL_SD);
    // 80% band on LUTEAL_SD alone is about +-3.1 days, so the ovulation band is >= 6 days.
    const bandDays =
      diffDays(estimate?.ovulationLow as CivilDate, estimate?.ovulationHigh as CivilDate) + 1;
    expect(bandDays).toBeGreaterThanOrEqual(6);
  });

  it("runs the fertile window from ovulation-5 to ovulation+1, applied to the whole band", () => {
    const estimate = estimateFertility({
      prediction: predictionWithSpread(2.0),
      fertilityEnabled: true,
    });
    expect(estimate?.fertileLow).toBe(
      addDays(estimate?.ovulationLow as CivilDate, -FERTILE_DAYS_BEFORE_OVULATION),
    );
    expect(estimate?.fertileHigh).toBe(
      addDays(estimate?.ovulationHigh as CivilDate, FERTILE_DAYS_AFTER_OVULATION),
    );
    const reported = estimate?.basis.fertileWindowDays as number;
    expect(
      diffDays(estimate?.fertileLow as CivilDate, estimate?.fertileHigh as CivilDate) + 1,
    ).toBe(reported);
  });

  it("widens monotonically as the underlying prediction gets less certain", () => {
    const widths = [1, 2, 4, 8].map((sPred) => {
      const estimate = estimateFertility({
        prediction: predictionWithSpread(sPred),
        fertilityEnabled: true,
      });
      return estimate?.basis.fertileWindowDays as number;
    });
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });

  it("widens further when the prediction's confidence is low", () => {
    const width = (confidence: PredictionResult["confidence"]) =>
      estimateFertility({
        prediction: predictionWithSpread(2.5, confidence),
        fertilityEnabled: true,
      })?.basis.fertileWindowDays as number;

    expect(width("limited")).toBeGreaterThan(width("more_consistent"));
    expect(width("not_enough_information")).toBeGreaterThan(width("limited"));
    expect(width("early_estimate")).toBe(width("not_enough_information"));
    expect(CONFIDENCE_EXTRA_DAYS.more_consistent).toBe(0);
  });

  it("rounds outward, so the reported band is never narrower than the arithmetic", () => {
    for (const sPred of [0.7, 1.3, 2.2, 3.9, 5.5]) {
      const estimate = estimateFertility({
        prediction: predictionWithSpread(sPred),
        fertilityEnabled: true,
      });
      const half = estimate?.basis.ovulationHalfWidthDays as number;
      const earliest = diffDays(estimate?.ovulationLow as CivilDate, PREDICTED_START);
      const latest = diffDays(estimate?.ovulationHigh as CivilDate, PREDICTED_START);
      expect(earliest).toBeGreaterThanOrEqual(LUTEAL_MEAN + half);
      expect(latest).toBeLessThanOrEqual(LUTEAL_MEAN - half);
    }
  });

  it("truncates the band at the predicted period start rather than reporting ovulation after it", () => {
    const estimate = estimateFertility({
      prediction: predictionWithSpread(12),
      fertilityEnabled: true,
    });
    expect(diffDays(estimate?.ovulationHigh as CivilDate, PREDICTED_START)).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("R1: every emitted date is a YYYY-MM-DD civil date", () => {
    const estimate = estimateFertility({
      prediction: predictionWithSpread(3),
      fertilityEnabled: true,
    });
    for (const value of [
      estimate?.ovulationLow,
      estimate?.ovulationHigh,
      estimate?.fertileLow,
      estimate?.fertileHigh,
    ]) {
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("says out loud when the window rests on population averages rather than the user's data", () => {
    const population: PredictionResult = {
      ...predictionWithSpread(6.1, "early_estimate"),
      kind: "population_estimate",
    };
    const estimate = estimateFertility({
      prediction: population,
      fertilityEnabled: true,
    });
    expect(estimate?.confidenceNote).toContain("population averages");
  });
});
