import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { DayLog, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
import { buildCalendarWeeks, dayLogLookup } from "./calendarCells";

const TODAY = parseCivil("2026-07-23");

function makeDayLog(date: string, overrides: Partial<DayLog> = {}): DayLog {
  const d = parseCivil(date);
  return { date: d, bleeding: "none", pain: { severity: "none" }, symptoms: [], loggedAt: d, ...overrides };
}

const PREDICTION: PredictionResult = {
  kind: "personal",
  center: parseCivil("2026-07-20"),
  low: parseCivil("2026-07-18"),
  high: parseCivil("2026-07-22"),
  predictedLengthDays: 28,
  confidence: "more_consistent",
  confidenceReason: "test",
  basis: { usableCycles: 6, windowCycles: 6, effectiveN: 6, sigma: 2, halfWidthDays: 2, calibrationFactor: 1 },
};

const FERTILITY: FertilityEstimate = {
  ovulationLow: parseCivil("2026-07-05"),
  ovulationHigh: parseCivil("2026-07-07"),
  fertileLow: parseCivil("2026-07-02"),
  fertileHigh: parseCivil("2026-07-08"),
  confidenceNote: "test",
  disclaimer: "test disclaimer",
};

const DAY_LOGS: DayLog[] = [
  makeDayLog("2026-07-03", { bleeding: "menstrual", flow: "medium" }),
  makeDayLog("2026-07-04", { bleeding: "spotting" }),
  makeDayLog("2026-07-10", { symptoms: ["cramps"] }),
  makeDayLog("2026-07-11", { nothingToReport: true }),
];

function july2026Weeks() {
  return buildCalendarWeeks({
    year: 2026,
    month: 7,
    weekStartsOn: 1,
    today: TODAY,
    dayLogByDate: dayLogLookup(DAY_LOGS),
    prediction: PREDICTION,
    fertility: FERTILITY,
    fertilityEnabled: true,
  });
}

function findCell(weeks: ReturnType<typeof july2026Weeks>, date: string) {
  const target = parseCivil(date);
  const cell = weeks.flat().find((c) => c.date === target);
  if (!cell) throw new Error(`cell for ${date} not found in grid`);
  return cell;
}

describe("dayLogLookup", () => {
  it("keys logs by their own date", () => {
    const map = dayLogLookup(DAY_LOGS);
    expect(map.get(parseCivil("2026-07-03"))?.bleeding).toBe("menstrual");
    expect(map.size).toBe(DAY_LOGS.length);
  });
});

describe("buildCalendarWeeks", () => {
  const weeks = july2026Weeks();

  it("produces full weeks of exactly 7 days each", () => {
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("flags days outside the requested month as not-in-current-month", () => {
    const flat = weeks.flat();
    const leading = flat.filter((c) => !c.inCurrentMonth);
    // July 1 2026 is a Wednesday and the grid starts on Monday, so there are leading
    // June days; the grid always pads to full weeks so there is at least one.
    expect(leading.length).toBeGreaterThan(0);
    for (const cell of leading) expect(cell.date.startsWith("2026-07")).toBe(false);
  });

  // SPEC.md §4.2: "A test asserts every calendar day cell exposes a non-colour
  // indicator." accessibleLabel is that non-colour indicator — every single cell in the
  // grid must carry descriptive text, never an empty or date-only label a screen reader
  // would read as silence.
  it("gives every cell in the grid a non-empty, descriptive accessible label", () => {
    for (const cell of weeks.flat()) {
      expect(cell.accessibleLabel.length).toBeGreaterThan(0);
      // Must be more than just the bare date: at least one indicator fragment after
      // the ". " separator, even if that fragment is the neutral "no records".
      const [, fragmentPart] = cell.accessibleLabel.split(". ");
      expect(fragmentPart).toBeTruthy();
      expect(fragmentPart).not.toBe(".");
    }
  });

  it("labels a day with no records as such, distinctly from any recorded or predicted day", () => {
    const cell = findCell(weeks, "2026-07-15");
    expect(cell.accessibleLabel).toContain("no records");
    expect(cell.accessibleLabel).not.toContain("period recorded");
    expect(cell.accessibleLabel).not.toContain("predicted period range");
  });

  it("recorded menstrual bleeding is labelled distinctly from a prediction, never both", () => {
    const cell = findCell(weeks, "2026-07-03");
    expect(cell.indicators.recordedBleeding).toBe("menstrual");
    expect(cell.accessibleLabel).toContain("period recorded");
    expect(cell.accessibleLabel).not.toContain("predicted period range");
  });

  it("recorded spotting is labelled distinctly from a recorded period", () => {
    const cell = findCell(weeks, "2026-07-04");
    expect(cell.indicators.recordedBleeding).toBe("spotting");
    expect(cell.accessibleLabel).toContain("spotting recorded");
    expect(cell.accessibleLabel).not.toContain("period recorded");
  });

  it("a predicted-but-unrecorded day is labelled as predicted, and only that day range", () => {
    const cell = findCell(weeks, "2026-07-19"); // inside PREDICTION.low..high, nothing recorded
    expect(cell.indicators.isPredictedPeriod).toBe(true);
    expect(cell.accessibleLabel).toContain("predicted period range");
    expect(cell.accessibleLabel).not.toContain("period recorded");
  });

  it("a day outside the predicted range is not labelled as predicted", () => {
    const cell = findCell(weeks, "2026-07-15");
    expect(cell.indicators.isPredictedPeriod).toBe(false);
    expect(cell.accessibleLabel).not.toContain("predicted period range");
  });

  it("carries the symptoms/notes indicator into the label", () => {
    const cell = findCell(weeks, "2026-07-10");
    expect(cell.accessibleLabel).toContain("symptoms or notes logged");
  });

  it("carries the nothing-to-report indicator into the label", () => {
    const cell = findCell(weeks, "2026-07-11");
    expect(cell.accessibleLabel).toContain("nothing to report logged");
  });

  it("carries fertile window and ovulation window indicators when fertility is enabled", () => {
    const fertileCell = findCell(weeks, "2026-07-05");
    expect(fertileCell.accessibleLabel).toContain("estimated fertile window");
    expect(fertileCell.accessibleLabel).toContain("estimated ovulation range");
  });

  it("suppresses fertility indicators entirely when fertility is disabled", () => {
    const disabled = buildCalendarWeeks({
      year: 2026,
      month: 7,
      weekStartsOn: 1,
      today: TODAY,
      dayLogByDate: dayLogLookup(DAY_LOGS),
      prediction: PREDICTION,
      fertility: FERTILITY,
      fertilityEnabled: false,
    });
    const cell = findCell(disabled, "2026-07-05");
    expect(cell.indicators.isFertileWindow).toBe(false);
    expect(cell.indicators.isOvulationWindow).toBe(false);
    expect(cell.accessibleLabel).not.toContain("fertile");
    expect(cell.accessibleLabel).not.toContain("ovulation");
  });

  it("flags today", () => {
    const cell = findCell(weeks, "2026-07-23");
    expect(cell.indicators.isToday).toBe(true);
    expect(cell.accessibleLabel).toContain("today");
  });
});
