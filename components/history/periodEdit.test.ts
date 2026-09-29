import { describe, expect, it } from "vitest";
import { toCivil, type CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, DayLog } from "@/lib/domain/types";
import {
  buildDayLogsToSave,
  buildEditableRange,
  buildPeriodEditDraft,
  computeBoundary,
  describeBoundary,
  setRowBleeding,
  setRowFlow,
} from "./periodEdit";

const d = (day: number) => toCivil(2026, 1, day);

function episode(overrides: Partial<BleedingEpisode> = {}): BleedingEpisode {
  return {
    startDate: d(10),
    endDate: d(13),
    menstrualDays: [d(10), d(11), d(12), d(13)],
    spottingDays: [],
    durationDays: 4,
    endInferred: false,
    ...overrides,
  };
}

function log(date: CivilDate, overrides: Partial<DayLog> = {}): DayLog {
  return {
    date,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: date,
    ...overrides,
  };
}

describe("buildEditableRange", () => {
  it("pads the episode's recorded span on both sides", () => {
    const range = buildEditableRange(episode(), 5);
    expect(range.start).toBe(d(5));
    expect(range.end).toBe(d(18));
  });

  it("uses the last logged bleeding day when endDate is null (ongoing episode)", () => {
    const range = buildEditableRange(
      episode({ endDate: null, menstrualDays: [d(10), d(11)], spottingDays: [d(12)] }),
      2,
    );
    expect(range.end).toBe(d(14)); // last day (12) + 2
  });
});

describe("buildPeriodEditDraft", () => {
  it("seeds each row from an existing DayLog, defaulting unlogged days to bleeding: none", () => {
    const byDate = new Map<CivilDate, DayLog>([
      [d(10), log(d(10), { bleeding: "menstrual", flow: "medium" })],
    ]);
    const draft = buildPeriodEditDraft({ start: d(9), end: d(11) }, byDate);
    expect(draft.rows).toHaveLength(3);
    expect(draft.rows[0]).toEqual({ date: d(9), bleeding: "none", flow: undefined });
    expect(draft.rows[1]).toEqual({ date: d(10), bleeding: "menstrual", flow: "medium" });
    expect(draft.rows[2]).toEqual({ date: d(11), bleeding: "none", flow: undefined });
  });
});

describe("setRowBleeding / setRowFlow", () => {
  const byDate = new Map<CivilDate, DayLog>();
  const draft = buildPeriodEditDraft({ start: d(1), end: d(3) }, byDate);

  it("setRowBleeding updates only the targeted row", () => {
    const next = setRowBleeding(draft, d(2), "menstrual");
    expect(next.rows.find((r) => r.date === d(2))!.bleeding).toBe("menstrual");
    expect(next.rows.find((r) => r.date === d(1))!.bleeding).toBe("none");
  });

  it("setRowBleeding to 'none' clears any flow", () => {
    const withFlow = setRowFlow(setRowBleeding(draft, d(2), "menstrual"), d(2), "heavy");
    const cleared = setRowBleeding(withFlow, d(2), "none");
    expect(cleared.rows.find((r) => r.date === d(2))!.flow).toBeUndefined();
  });

  it("setRowFlow is a no-op on a 'none' row", () => {
    const next = setRowFlow(draft, d(1), "heavy");
    expect(next.rows.find((r) => r.date === d(1))!.flow).toBeUndefined();
  });
});

describe("computeBoundary", () => {
  it("finds the contiguous bleeding run containing the anchor date", () => {
    const byDate = new Map<CivilDate, DayLog>([
      [d(10), log(d(10), { bleeding: "menstrual" })],
      [d(11), log(d(11), { bleeding: "menstrual" })],
      [d(12), log(d(12), { bleeding: "menstrual" })],
    ]);
    const draft = buildPeriodEditDraft({ start: d(8), end: d(14) }, byDate);
    const boundary = computeBoundary(draft, d(10));
    expect(boundary).toEqual({ start: d(10), end: d(12) });
  });

  it("extends the boundary when the user adds a day before the original start", () => {
    const byDate = new Map<CivilDate, DayLog>([
      [d(10), log(d(10), { bleeding: "menstrual" })],
      [d(11), log(d(11), { bleeding: "menstrual" })],
    ]);
    let draft = buildPeriodEditDraft({ start: d(8), end: d(13) }, byDate);
    draft = setRowBleeding(draft, d(9), "spotting");
    const boundary = computeBoundary(draft, d(10));
    expect(boundary).toEqual({ start: d(9), end: d(11) });
  });

  it("when the anchor day itself was cleared, searches outward for the nearest bleeding day", () => {
    const byDate = new Map<CivilDate, DayLog>([[d(11), log(d(11), { bleeding: "menstrual" })]]);
    const draft = buildPeriodEditDraft({ start: d(8), end: d(13) }, byDate);
    const boundary = computeBoundary(draft, d(10));
    expect(boundary).toEqual({ start: d(11), end: d(11) });
  });

  it("returns null when every day in the draft was cleared (the user deleted the period)", () => {
    const draft = buildPeriodEditDraft({ start: d(8), end: d(13) }, new Map());
    expect(computeBoundary(draft, d(10))).toBeNull();
  });
});

describe("buildDayLogsToSave", () => {
  it("omits days that didn't actually change", () => {
    const original = log(d(10), { bleeding: "menstrual", flow: "medium", periodBoundary: "start" });
    const byDate = new Map<CivilDate, DayLog>([[d(10), original]]);
    const draft = buildPeriodEditDraft({ start: d(10), end: d(10) }, byDate);
    const toSave = buildDayLogsToSave(draft, byDate, { start: d(10), end: d(10) }, d(15));
    expect(toSave).toHaveLength(0);
  });

  it("preserves untouched fields (symptoms/pain/notes) via read-merge-write", () => {
    const original = log(d(10), {
      bleeding: "menstrual",
      flow: "medium",
      symptoms: ["cramps"],
      notes: "kept me up",
      pain: { severity: "moderate" },
    });
    const byDate = new Map<CivilDate, DayLog>([[d(10), original]]);
    let draft = buildPeriodEditDraft({ start: d(10), end: d(10) }, byDate);
    draft = setRowFlow(draft, d(10), "heavy");
    const toSave = buildDayLogsToSave(draft, byDate, { start: d(10), end: d(10) }, d(15));
    expect(toSave).toHaveLength(1);
    expect(toSave[0].flow).toBe("heavy");
    expect(toSave[0].symptoms).toEqual(["cramps"]);
    expect(toSave[0].notes).toBe("kept me up");
    expect(toSave[0].pain).toEqual({ severity: "moderate" });
  });

  it("creates a minimal new DayLog, stamped with today's loggedAt, for a previously unlogged day added to the period", () => {
    const byDate = new Map<CivilDate, DayLog>();
    let draft = buildPeriodEditDraft({ start: d(10), end: d(10) }, byDate);
    draft = setRowBleeding(draft, d(10), "menstrual");
    const toSave = buildDayLogsToSave(draft, byDate, { start: d(10), end: d(10) }, d(15));
    expect(toSave).toHaveLength(1);
    expect(toSave[0]).toMatchObject({ date: d(10), bleeding: "menstrual", loggedAt: d(15), periodBoundary: "start" });
  });

  it("does not overwrite an existing day's loggedAt when only its bleeding/flow changed", () => {
    const original = log(d(10), { bleeding: "menstrual", loggedAt: d(11) });
    const byDate = new Map<CivilDate, DayLog>([[d(10), original]]);
    let draft = buildPeriodEditDraft({ start: d(10), end: d(10) }, byDate);
    draft = setRowFlow(setRowBleeding(draft, d(10), "menstrual"), d(10), "light");
    const toSave = buildDayLogsToSave(draft, byDate, { start: d(10), end: d(10) }, d(20));
    expect(toSave[0].loggedAt).toBe(d(11));
  });

  it("clears a previously-recorded period day back to bleeding: none, dropping its boundary flag", () => {
    const original = log(d(10), { bleeding: "menstrual", flow: "medium", periodBoundary: "start" });
    const byDate = new Map<CivilDate, DayLog>([[d(10), original]]);
    let draft = buildPeriodEditDraft({ start: d(10), end: d(10) }, byDate);
    draft = setRowBleeding(draft, d(10), "none");
    const toSave = buildDayLogsToSave(draft, byDate, null, d(20));
    expect(toSave).toHaveLength(1);
    expect(toSave[0].bleeding).toBe("none");
    expect(toSave[0].flow).toBeUndefined();
    expect(toSave[0].periodBoundary).toBeUndefined();
  });

  it("marks the first and last day of the computed boundary explicitly when the user actually extends it", () => {
    const byDate = new Map<CivilDate, DayLog>([
      [d(10), log(d(10), { bleeding: "menstrual" })],
      [d(11), log(d(11), { bleeding: "menstrual" })],
    ]);
    let draft = buildPeriodEditDraft({ start: d(10), end: d(12) }, byDate);
    // A real edit: the user adds day 12 to the period.
    draft = setRowBleeding(draft, d(12), "menstrual");
    const boundary = computeBoundary(draft, d(10));
    const toSave = buildDayLogsToSave(draft, byDate, boundary, d(20));
    const byDay = new Map(toSave.map((l) => [l.date, l]));
    expect(byDay.get(d(10))?.periodBoundary).toBe("start");
    expect(byDay.get(d(12))?.periodBoundary).toBe("end");
  });

  it("does NOT fabricate an 'end' boundary when the user merely opens an ongoing period and saves without editing anything", () => {
    // The exact reported bug: a period logged as still ongoing (no explicit end, no
    // periodBoundary stored on its last day) gets opened in the edit sheet and saved
    // with zero changes. Saving must not silently declare the period over.
    const byDate = new Map<CivilDate, DayLog>([
      [d(10), log(d(10), { bleeding: "menstrual" })],
      [d(11), log(d(11), { bleeding: "menstrual" })],
      [d(12), log(d(12), { bleeding: "menstrual" })],
    ]);
    const draft = buildPeriodEditDraft({ start: d(10), end: d(12) }, byDate);
    const boundary = computeBoundary(draft, d(10)); // {start: d(10), end: d(12)} — still "discovered"
    const toSave = buildDayLogsToSave(draft, byDate, boundary, d(20));
    expect(toSave).toHaveLength(0);
  });

  it("does NOT write 'end' on today — an unfinished day cannot carry the 'period is over' assertion", () => {
    // Reported bug: a period logged today only, still open. The user opens the edit
    // sheet to add the day they forgot (a real edit, so the `userEditedBleeding` gate
    // does not help) and saves. Writing `end` on today closes the episode, which drops
    // the calendar's "period expected to continue" days and badges today as a last day.
    const today = d(11);
    const byDate = new Map<CivilDate, DayLog>([[d(11), log(d(11), { bleeding: "menstrual" })]]);
    let draft = buildPeriodEditDraft({ start: d(9), end: d(13) }, byDate);
    draft = setRowBleeding(draft, d(10), "menstrual");
    const boundary = computeBoundary(draft, d(11));
    expect(boundary).toEqual({ start: d(10), end: d(11) });
    const byDay = new Map(buildDayLogsToSave(draft, byDate, boundary, today).map((l) => [l.date, l]));
    expect(byDay.get(d(10))?.periodBoundary).toBe("start"); // a start IS assertable
    expect(byDay.get(d(11))?.periodBoundary).toBeUndefined();
  });

  it("still re-asserts the boundary on unchanged edge days when some other day in the draft was edited", () => {
    const byDate = new Map<CivilDate, DayLog>([
      [d(10), log(d(10), { bleeding: "menstrual" })],
      [d(11), log(d(11), { bleeding: "menstrual" })],
      [d(12), log(d(12), { bleeding: "menstrual" })],
    ]);
    let draft = buildPeriodEditDraft({ start: d(10), end: d(12) }, byDate);
    draft = setRowFlow(draft, d(11), "heavy");
    const boundary = computeBoundary(draft, d(10));
    const toSave = buildDayLogsToSave(draft, byDate, boundary, d(20));
    const byDay = new Map(toSave.map((l) => [l.date, l]));
    expect(byDay.get(d(12))?.periodBoundary).toBe("end");
  });
});

describe("describeBoundary", () => {
  it("describes a null boundary honestly", () => {
    expect(describeBoundary(null)).toBe("No period days selected");
  });

  it("formats a real boundary as a date range", () => {
    expect(describeBoundary({ start: d(10), end: d(13) })).toContain("Jan 10, 2026");
  });
});
