import { describe, expect, it } from "vitest";
import { toCivil } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle } from "@/lib/domain/types";
import type { SkipPromptItem } from "@/lib/engine";
import {
  applyDateFilter,
  buildCycleRowViewModels,
  buildSkipPromptViewModels,
  parseDatesParam,
  sortCyclesDescending,
} from "./cycleListData";

const d = (day: number) => toCivil(2026, 1, day);

function episode(overrides: Partial<BleedingEpisode> = {}): BleedingEpisode {
  return {
    startDate: d(1),
    endDate: d(4),
    menstrualDays: [d(1), d(2), d(3), d(4)],
    spottingDays: [],
    durationDays: 4,
    endInferred: false,
    ...overrides,
  };
}

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    index: 0,
    startDate: d(1),
    nextStartDate: d(30),
    lengthDays: 29,
    status: "ok",
    weight: 1,
    episode: episode(),
    ...overrides,
  };
}

describe("sortCyclesDescending", () => {
  it("orders most-recent-first", () => {
    const a = cycle({ startDate: d(1) });
    const b = cycle({ startDate: d(15) });
    expect(sortCyclesDescending([a, b]).map((c) => c.startDate)).toEqual([d(15), d(1)]);
  });
});

describe("buildCycleRowViewModels", () => {
  it("never drops an anomalous cycle and restates its statusReason verbatim", () => {
    const anomalous = cycle({
      status: "gap_unknown",
      statusReason: "There's a long, unexplained gap here.",
      lengthDays: null,
    });
    const rows = buildCycleRowViewModels([anomalous]);
    expect(rows).toHaveLength(1);
    expect(rows[0].statusReason).toBe("There's a long, unexplained gap here.");
    expect(rows[0].isAnomalous).toBe(true);
    expect(rows[0].statusLabel).toBe("Gap — unknown");
  });

  it("an ok, completed cycle is not flagged anomalous", () => {
    const rows = buildCycleRowViewModels([cycle({ status: "ok" })]);
    expect(rows[0].isAnomalous).toBe(false);
  });

  it("an in-progress cycle is not flagged anomalous and shows 'present' in its range", () => {
    const rows = buildCycleRowViewModels([cycle({ status: "in_progress", nextStartDate: null, lengthDays: null })]);
    expect(rows[0].isAnomalous).toBe(false);
    expect(rows[0].dateRangeText).toContain("present");
  });

  it("highlights rows whose episode overlaps a highlighted date, leaves the rest unhighlighted", () => {
    const match = cycle({ startDate: d(1), episode: episode({ startDate: d(1), menstrualDays: [d(1), d(2)] }) });
    const other = cycle({ startDate: d(31), episode: episode({ startDate: d(31), menstrualDays: [d(31)] }) });
    const rows = buildCycleRowViewModels([match, other], [d(2)]);
    const matchRow = rows.find((r) => r.key === d(1))!;
    const otherRow = rows.find((r) => r.key === d(31))!;
    expect(matchRow.isHighlighted).toBe(true);
    expect(otherRow.isHighlighted).toBe(false);
  });

  it("with no highlighted dates, nothing is highlighted", () => {
    const rows = buildCycleRowViewModels([cycle()], []);
    expect(rows.every((r) => !r.isHighlighted)).toBe(true);
  });
});

describe("applyDateFilter", () => {
  it("passes through unfiltered when no dates are given", () => {
    const rows = buildCycleRowViewModels([cycle()]);
    const result = applyDateFilter(rows, []);
    expect(result.filtered).toBe(false);
    expect(result.rows).toHaveLength(1);
  });

  it("filters to only the matching rows when at least one matches", () => {
    const match = cycle({ startDate: d(1), episode: episode({ menstrualDays: [d(1)] }) });
    const other = cycle({ startDate: d(31), episode: episode({ startDate: d(31), menstrualDays: [d(31)] }) });
    const rows = buildCycleRowViewModels([match, other], [d(1)]);
    const result = applyDateFilter(rows, [d(1)]);
    expect(result.filtered).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].key).toBe(d(1));
  });

  it("falls back to the unfiltered list rather than showing nothing for a stale link", () => {
    const rows = buildCycleRowViewModels([cycle({ startDate: d(1), episode: episode({ menstrualDays: [d(1)] }) })]);
    const result = applyDateFilter(rows, [toCivil(2020, 1, 1)]);
    expect(result.filtered).toBe(false);
    expect(result.rows).toHaveLength(1);
  });
});

describe("parseDatesParam", () => {
  it("parses a comma-separated list", () => {
    expect(parseDatesParam("2026-01-01,2026-01-15")).toEqual([toCivil(2026, 1, 1), toCivil(2026, 1, 15)]);
  });

  it("returns an empty array for null/undefined/empty", () => {
    expect(parseDatesParam(null)).toEqual([]);
    expect(parseDatesParam(undefined)).toEqual([]);
    expect(parseDatesParam("")).toEqual([]);
  });

  it("drops malformed entries instead of throwing", () => {
    expect(parseDatesParam("2026-01-01,not-a-date,2026-02-30")).toEqual([toCivil(2026, 1, 1)]);
  });
});

describe("buildSkipPromptViewModels", () => {
  it("builds a question, a suggested date and any alternatives, sorted by cycle start", () => {
    const items: SkipPromptItem[] = [
      {
        cycleStartDate: d(15),
        prompt: { question: "Did you miss logging a period around Jan 20?", suggestedDate: d(20), options: [d(18), d(20), d(22)] },
      },
      {
        cycleStartDate: d(1),
        prompt: { question: "Did you miss logging a period around Jan 6?", suggestedDate: d(6), options: [d(6)] },
      },
    ];
    const vms = buildSkipPromptViewModels(items);
    expect(vms.map((v) => v.cycleStartDate)).toEqual([d(1), d(15)]);
    expect(vms[1].suggestedDate).toBe(d(20));
    expect(vms[1].alternativeDates.map((a) => a.date)).toEqual([d(18), d(22)]);
    expect(vms[0].alternativeDates).toEqual([]);
  });
});
