import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { Cycle, DayLog, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
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

const CYCLE: Cycle = {
  index: -1,
  startDate: parseCivil("2026-06-15"),
  nextStartDate: null,
  lengthDays: null,
  status: "in_progress",
  weight: 1.0,
  episode: {
    startDate: parseCivil("2026-06-15"),
    endDate: null,
    menstrualDays: [parseCivil("2026-06-15")],
    spottingDays: [],
    durationDays: null,
    endInferred: true,
  },
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
    // A real user has a typical period length, and the predicted BLEEDING SPAN is
    // centre..centre+length-1 — here 07-20..07-24, which still reaches TODAY (07-23).
    // Without it the span is the single day 07-20, entirely in the past, and
    // `predictedPeriodRange` correctly draws nothing (see its own test).
    typicalPeriodDays: 5,
  });
}

function findCell(weeks: ReturnType<typeof july2026Weeks>, date: string) {
  const target = parseCivil(date);
  const cell = weeks.flat().find((c) => c.date === target);
  if (!cell) throw new Error(`cell for ${date} not found in grid`);
  return cell;
}

/**
 * The reported bug, end to end: "today 29 Sept I have a period, the next 5 days should be
 * shown as period expected to continue, not the whole month". `expectedPeriodRange` always
 * produced the 5-day span — it was drowned out by `isPredictedPeriod`, which painted
 * `prediction.low..high` (start-date uncertainty, easily ±8-15 days) across most of the
 * grid. Both halves are asserted here.
 */
describe("buildCalendarWeeks — ongoing period expectation vs. next-period prediction", () => {
  const TODAY_SEP = parseCivil("2026-09-29");
  const LOGS = [makeDayLog("2026-09-29", { bleeding: "menstrual", flow: "medium" })];
  // Deliberately WIDE: low..high spans 7 days and would dash a week of October if the
  // uncertainty band ever reached the grid again.
  const NEXT: PredictionResult = {
    ...PREDICTION,
    center: parseCivil("2026-10-27"),
    low: parseCivil("2026-10-24"),
    high: parseCivil("2026-10-30"),
  };
  const ONGOING: Cycle = {
    ...CYCLE,
    startDate: TODAY_SEP,
    episode: { ...CYCLE.episode, startDate: TODAY_SEP, menstrualDays: [TODAY_SEP] },
  };

  const monthOf = (year: number, month: number) =>
    buildCalendarWeeks({
      year,
      month,
      weekStartsOn: 1,
      today: TODAY_SEP,
      dayLogByDate: dayLogLookup(LOGS),
      prediction: NEXT,
      fertility: null,
      fertilityEnabled: false,
      cycles: [ONGOING],
      typicalPeriodDays: 5,
      episodes: [ONGOING.episode],
    });

  const september = monthOf(2026, 9);
  const october = monthOf(2026, 10);
  const cellFor = (date: string) =>
    findCell(date.startsWith("2026-09") ? september : october, date);

  it("shows exactly the four remaining days of the 5-day period as expected to continue", () => {
    for (const date of ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]) {
      const cell = cellFor(date);
      expect(cell.indicators.isExpectedPeriodDay, date).toBe(true);
      expect(cell.accessibleLabel).toContain("period expected to continue");
    }
    // The logged day itself is a recorded fact, not an expectation.
    expect(cellFor("2026-09-29").indicators.isExpectedPeriodDay).toBe(false);
    expect(cellFor("2026-09-29").accessibleLabel).toContain("period recorded");
    // Day 6 onwards: the period has run its typical length, so nothing further is claimed.
    for (const date of ["2026-10-04", "2026-10-05", "2026-10-10"]) {
      expect(cellFor(date).indicators.isExpectedPeriodDay, date).toBe(false);
    }
  });

  it("marks only the predicted bleeding span as predicted — never the whole month", () => {
    const predicted = [...september, ...october]
      .flat()
      .filter((c) => c.indicators.isPredictedPeriod)
      .map((c) => c.date);
    // center 10-27 + 5 typical days - 1 => 10-27..10-31, and nothing else. In particular
    // NOT 10-24..10-26, which are inside prediction.low..high.
    expect([...new Set(predicted)].sort()).toEqual([
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
  });

  it("never gives one day both the predicted and the expected-to-continue marker", () => {
    for (const cell of [...september, ...october].flat()) {
      expect(
        cell.indicators.isPredictedPeriod && cell.indicators.isExpectedPeriodDay,
        cell.date,
      ).toBe(false);
    }
  });
});

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
    // PREDICTION.center, i.e. inside the predicted BLEEDING SPAN. (Was 2026-07-19, a day
    // inside PREDICTION.low..high only — that band is start-date uncertainty and no
    // longer reaches the grid; see predictedPeriodRange.)
    const cell = findCell(weeks, "2026-07-20");
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

  // Cycle phase plumbing: CYCLE starts 2026-06-15 (in-progress), FERTILITY's ovulation
  // window is 07-05..07-07, and PREDICTION.high is 07-22 — so July should show
  // follicular before 07-05, ovulatory 07-05..07-07, luteal 07-08..07-22, and null after.
  // Built as its own grid (rather than added to the shared `weeks` fixture used above)
  // so it doesn't change what every other, phase-unrelated test in this file sees.
  function julyWeeksWithCycle(fertilityEnabled = true) {
    return buildCalendarWeeks({
      year: 2026,
      month: 7,
      weekStartsOn: 1,
      today: TODAY,
      dayLogByDate: dayLogLookup(DAY_LOGS),
      prediction: PREDICTION,
      fertility: FERTILITY,
      fertilityEnabled,
      cycles: [CYCLE],
    });
  }

  it("threads `cycles` through to classify each day's estimated phase", () => {
    const withCycle = julyWeeksWithCycle();
    expect(findCell(withCycle, "2026-07-01").indicators.phase).toBe("follicular");
    expect(findCell(withCycle, "2026-07-06").indicators.phase).toBe("ovulatory");
    expect(findCell(withCycle, "2026-07-15").indicators.phase).toBe("luteal");
    expect(findCell(withCycle, "2026-07-15").accessibleLabel).toContain("estimated luteal phase");
    expect(findCell(withCycle, "2026-07-01").accessibleLabel).toContain("estimated follicular phase");
  });

  it("phase is null past the predicted high, and when fertility is disabled", () => {
    const withCycle = julyWeeksWithCycle();
    expect(findCell(withCycle, "2026-07-23").indicators.phase).toBeNull();

    const disabled = julyWeeksWithCycle(false);
    expect(findCell(disabled, "2026-07-01").indicators.phase).toBeNull();
  });

  it("phase is null when no `cycles` are passed at all (backward compatible)", () => {
    expect(findCell(weeks, "2026-07-01").indicators.phase).toBeNull();
  });
});
