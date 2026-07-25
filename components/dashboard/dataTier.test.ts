import { describe, expect, it } from "vitest";
import type { Cycle, CivilDate } from "@/lib/domain/types";
import { selectDataTier } from "./dataTier";

function stubCycle(index: number): Cycle {
  return {
    index,
    startDate: "2026-01-01" as CivilDate,
    nextStartDate: null,
    lengthDays: null,
    status: "in_progress",
    weight: 1,
    episode: {
      startDate: "2026-01-01" as CivilDate,
      endDate: null,
      menstrualDays: ["2026-01-01" as CivilDate],
      spottingDays: [],
      durationDays: null,
      endInferred: true,
    },
  };
}

describe("selectDataTier", () => {
  it("returns 'empty' for zero recorded periods", () => {
    expect(selectDataTier([])).toBe("empty");
  });

  it("returns 'one' for exactly one recorded period", () => {
    expect(selectDataTier([stubCycle(-1)])).toBe("one");
  });

  it("returns 'two' for exactly two recorded periods", () => {
    expect(selectDataTier([stubCycle(-1), stubCycle(0)])).toBe("two");
  });

  it("returns 'established' for three or more recorded periods", () => {
    expect(selectDataTier([stubCycle(-1), stubCycle(0), stubCycle(1)])).toBe("established");
    expect(
      selectDataTier([stubCycle(-1), stubCycle(0), stubCycle(1), stubCycle(2), stubCycle(3)]),
    ).toBe("established");
  });
});
