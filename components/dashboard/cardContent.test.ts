import { describe, expect, it } from "vitest";
import type { CivilDate, Cycle, PredictionResult } from "@/lib/domain/types";
import { buildCurrentStatusCard, buildHeaderStatus, buildNextPeriodCard } from "./cardContent";

/**
 * Regression coverage for the "open period rendered as though it had ended" bug: an
 * in-progress cycle's `episode.endDate` is `null` (SPEC.md: "because we don't know when
 * the period will end we cannot directly set the end"). Nothing in this module may
 * substitute `startDate` for a missing end, or compute a duration from `today` and
 * present it as a finished period's length — the day count these cards do show is an
 * elapsed-days-so-far counter, never a final duration claim.
 */

function openCycle(startDate: CivilDate): Cycle {
  return {
    index: 0,
    startDate,
    nextStartDate: null,
    lengthDays: null,
    status: "in_progress",
    weight: 1,
    episode: {
      startDate,
      endDate: null,
      menstrualDays: [startDate],
      spottingDays: [],
      durationDays: null,
      endInferred: true,
    },
  };
}

const NO_PREDICTION: PredictionResult = {
  kind: "none",
  center: null,
  low: null,
  high: null,
  predictedLengthDays: null,
  confidence: "not_enough_information",
  confidenceReason: "Not enough data yet.",
  basis: {
    usableCycles: 0,
    windowCycles: 0,
    effectiveN: 0,
    sigma: 0,
    halfWidthDays: 0,
    calibrationFactor: 1,
  },
};

describe("buildCurrentStatusCard", () => {
  it("never states an end date or a finished duration for an open episode", () => {
    const cycles = [openCycle("2026-09-27" as CivilDate)];
    const card = buildCurrentStatusCard({ cycles, today: "2026-09-28" as CivilDate });

    expect(card).not.toBeNull();
    // The only day-count claim is elapsed days into the ongoing cycle, not a finished
    // period length, and the body never repeats the start date as if it were an end.
    expect(card!.body).toContain("2 days into your current cycle");
    expect(card!.body).toContain("Last period started");
    expect(card!.body).not.toMatch(/ended|lasted|duration/i);
  });

  it("returns null when there is no in-progress cycle (nothing open to describe)", () => {
    expect(buildCurrentStatusCard({ cycles: [], today: "2026-09-28" as CivilDate })).toBeNull();
  });
});

describe("buildHeaderStatus", () => {
  it("describes the open cycle by elapsed day count, never a completed range", () => {
    const cycles = [openCycle("2026-09-27" as CivilDate)];
    const status = buildHeaderStatus({
      prediction: NO_PREDICTION,
      cycles,
      typicalCycleLength: null,
      today: "2026-09-28" as CivilDate,
    });

    expect(status.cycleDayText).toBe("Day 2 of your current cycle");
    expect(status.lastPeriodStartText).toBe("Last period started September 27");
  });
});

describe("buildNextPeriodCard", () => {
  it("falls back to the no-estimate headline rather than inventing a range", () => {
    const card = buildNextPeriodCard({ prediction: NO_PREDICTION, cycles: [] });
    expect(card.headline).toBe("We can't estimate a range yet");
  });
});
