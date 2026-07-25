import { describe, expect, it } from "vitest";
import type { CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle, DayLog } from "@/lib/domain/types";
import type { FlowPatternDay } from "@/lib/engine/stats";
import {
  bucketCycleLengthsByMonth,
  bucketPeriodDurationsByMonth,
  buildFlowByDayPoints,
  buildSymptomTimelineData,
  predictedVsActualErrorDomain,
} from "@/components/charts/transforms";

function d(s: string): CivilDate {
  return s as CivilDate;
}

function cycle(overrides: Partial<Cycle>): Cycle {
  return {
    index: 0,
    startDate: d("2026-01-01"),
    nextStartDate: null,
    lengthDays: null,
    status: "ok",
    weight: 1,
    episode: {
      startDate: d("2026-01-01"),
      endDate: null,
      menstrualDays: [],
      spottingDays: [],
      durationDays: null,
      endInferred: true,
    },
    ...overrides,
  };
}

function episode(overrides: Partial<BleedingEpisode>): BleedingEpisode {
  return {
    startDate: d("2026-01-01"),
    endDate: null,
    menstrualDays: [],
    spottingDays: [],
    durationDays: null,
    endInferred: true,
    ...overrides,
  };
}

function dayLog(overrides: Partial<DayLog>): DayLog {
  return {
    date: d("2026-01-01"),
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: d("2026-01-01"),
    ...overrides,
  };
}

describe("bucketCycleLengthsByMonth", () => {
  it("groups cycles by the calendar month of their start date, months chronological", () => {
    const cycles = [
      cycle({ startDate: d("2026-02-10"), lengthDays: 30 }),
      cycle({ startDate: d("2026-01-05"), lengthDays: 28 }),
      cycle({ startDate: d("2026-01-20"), lengthDays: 29 }),
    ];
    const buckets = bucketCycleLengthsByMonth(cycles);
    expect(buckets.map((b) => b.monthKey)).toEqual(["2026-01", "2026-02"]);
    expect(buckets[0].points.map((p) => p.lengthDays)).toEqual([28, 29]);
    expect(buckets[0].label).toBe("Jan 2026");
  });

  it("excludes cycles with no known length (in-progress) rather than showing a fake zero", () => {
    const cycles = [cycle({ lengthDays: null }), cycle({ lengthDays: 30 })];
    const buckets = bucketCycleLengthsByMonth(cycles);
    const total = buckets.reduce((n, b) => n + b.points.length, 0);
    expect(total).toBe(1);
  });

  it("keeps every status (not just ok) so excluded/gap cycles stay visible (R7)", () => {
    const cycles = [cycle({ lengthDays: 40, status: "gap_unknown" })];
    const buckets = bucketCycleLengthsByMonth(cycles);
    expect(buckets[0].points[0].status).toBe("gap_unknown");
  });
});

describe("bucketPeriodDurationsByMonth", () => {
  it("groups episodes with a known duration by month", () => {
    const episodes = [
      episode({ startDate: d("2026-03-01"), durationDays: 5 }),
      episode({ startDate: d("2026-03-15"), durationDays: 4 }),
      episode({ startDate: d("2026-04-01"), durationDays: null }),
    ];
    const buckets = bucketPeriodDurationsByMonth(episodes);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].points).toHaveLength(2);
  });
});

describe("buildFlowByDayPoints", () => {
  it("converts counts to fractions of the logged-day denominator", () => {
    const pattern: FlowPatternDay[] = [
      {
        periodDay: 1,
        flowCounts: { spotting: 0, light: 1, medium: 1, heavy: 2, very_heavy: 0 },
        loggedDayCount: 4,
        heavyOrHigherCount: 2,
      },
    ];
    const points = buildFlowByDayPoints(pattern);
    expect(points[0].fractions.heavy).toBeCloseTo(0.5);
    expect(points[0].fractions.light).toBeCloseTo(0.25);
    expect(points[0].heavyOrHigherFraction).toBeCloseTo(0.5);
  });

  it("returns all-zero fractions rather than NaN when nothing was logged that day", () => {
    const pattern: FlowPatternDay[] = [
      {
        periodDay: 2,
        flowCounts: { spotting: 0, light: 0, medium: 0, heavy: 0, very_heavy: 0 },
        loggedDayCount: 0,
        heavyOrHigherCount: 0,
      },
    ];
    const [point] = buildFlowByDayPoints(pattern);
    expect(point.fractions.heavy).toBe(0);
    expect(point.heavyOrHigherFraction).toBe(0);
  });

  it("sorts by period day", () => {
    const pattern: FlowPatternDay[] = [
      { periodDay: 3, flowCounts: { spotting: 0, light: 0, medium: 0, heavy: 0, very_heavy: 0 }, loggedDayCount: 0, heavyOrHigherCount: 0 },
      { periodDay: 1, flowCounts: { spotting: 0, light: 0, medium: 0, heavy: 0, very_heavy: 0 }, loggedDayCount: 0, heavyOrHigherCount: 0 },
    ];
    expect(buildFlowByDayPoints(pattern).map((p) => p.periodDay)).toEqual([1, 3]);
  });
});

describe("buildSymptomTimelineData", () => {
  it("computes the domain from the earliest/latest day log", () => {
    const logs = [
      dayLog({ date: d("2026-01-05") }),
      dayLog({ date: d("2026-01-10") }),
    ];
    const data = buildSymptomTimelineData(logs, ["cramps"]);
    expect(data.domainStart).toBe(d("2026-01-05"));
    expect(data.domainEnd).toBe(d("2026-01-10"));
  });

  it("returns a null domain for no logs", () => {
    const data = buildSymptomTimelineData([], ["cramps"]);
    expect(data.domainStart).toBeNull();
    expect(data.domainEnd).toBeNull();
    expect(data.periodBands).toEqual([]);
  });

  it("merges consecutive bleeding days into a single band and keeps a gap as two bands", () => {
    const logs = [
      dayLog({ date: d("2026-01-01"), bleeding: "menstrual" }),
      dayLog({ date: d("2026-01-02"), bleeding: "menstrual" }),
      dayLog({ date: d("2026-01-03"), bleeding: "menstrual" }),
      dayLog({ date: d("2026-01-10"), bleeding: "spotting" }),
    ];
    const data = buildSymptomTimelineData(logs, []);
    expect(data.periodBands).toEqual([
      { start: d("2026-01-01"), end: d("2026-01-03") },
      { start: d("2026-01-10"), end: d("2026-01-10") },
    ]);
  });

  it("lists only the dates a symptom was actually logged as present, per symptom row", () => {
    const logs = [
      dayLog({ date: d("2026-01-01"), symptoms: ["cramps"] }),
      dayLog({ date: d("2026-01-02"), symptoms: ["headache"] }),
      dayLog({ date: d("2026-01-03"), symptoms: ["cramps", "headache"] }),
    ];
    const data = buildSymptomTimelineData(logs, ["cramps", "headache"]);
    expect(data.series).toEqual([
      { symptom: "cramps", dates: [d("2026-01-01"), d("2026-01-03")] },
      { symptom: "headache", dates: [d("2026-01-02"), d("2026-01-03")] },
    ]);
  });
});

describe("predictedVsActualErrorDomain", () => {
  it("is symmetric around zero and covers the largest absolute error", () => {
    const points = [
      { cycleIndex: 0, anchorStart: d("2026-01-01"), signedErrorDays: -5, insideWindow: true },
      { cycleIndex: 1, anchorStart: d("2026-02-01"), signedErrorDays: 8, insideWindow: false },
    ];
    expect(predictedVsActualErrorDomain(points)).toEqual([-8, 8]);
  });

  it("floors the domain at +/-3 days so a near-perfect prediction still gets a readable axis", () => {
    const points = [{ cycleIndex: 0, anchorStart: d("2026-01-01"), signedErrorDays: 1, insideWindow: true }];
    expect(predictedVsActualErrorDomain(points)).toEqual([-3, 3]);
  });

  it("handles an empty series without producing NaN", () => {
    expect(predictedVsActualErrorDomain([])).toEqual([-3, 3]);
  });
});
