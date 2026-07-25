import { describe, expect, it } from "vitest";
import { addDays, diffDays, parseCivil, rangeInclusive, type CivilDate } from "@/lib/date/civil";
import type {
  BleedingEpisode,
  Cycle,
  DayLog,
  LifeStageState,
  Profile,
  Settings,
} from "@/lib/domain/types";
import {
  computeHealthMessages,
  EMPTY_HEALTH_AWARENESS_STATE,
  NEVER_SUPPRESSED_RULES,
  type HealthAwarenessInput,
  type HealthAwarenessState,
  type UrgentSystemicSymptom,
} from "./health";

// ============================================================================
// Fixtures
// ============================================================================

function d(s: string): CivilDate {
  return parseCivil(s);
}

const TODAY = d("2026-07-22");

function log(date: string, bleeding: DayLog["bleeding"], extra: Partial<DayLog> = {}): DayLog {
  return {
    date: d(date),
    bleeding,
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: d(date),
    ...extra,
  };
}

const DEFAULT_SETTINGS: Settings = {
  fertilityEnabled: false,
  tierCSymptomsEnabled: false,
  healthAwarenessEnabled: true,
  notifications: {
    periodReminder: true,
    fertileReminder: false,
    symptomReminder: true,
    medicationReminder: false,
    loggingReminder: true,
    healthAwareness: true,
    privateWording: true,
  },
  locale: "en-US",
};

const DEFAULT_STATE: LifeStageState = {
  pregnant: false,
  breastfeeding: false,
  perimenopauseSelfDeclared: false,
  menopauseSelfDeclared: false,
  knownIrregular: false,
  preferNotToSay: false,
};

function profile(overrides: Partial<Profile> = {}, stateOverrides: Partial<LifeStageState> = {}): Profile {
  return {
    state: { ...DEFAULT_STATE, ...stateOverrides },
    settings: DEFAULT_SETTINGS,
    ...overrides,
  };
}

function makeEpisode(start: string, end: string, extra: Partial<BleedingEpisode> = {}): BleedingEpisode {
  const startDate = d(start);
  const endDate = d(end);
  return {
    startDate,
    endDate,
    menstrualDays: rangeInclusive(startDate, endDate),
    spottingDays: [],
    durationDays: diffDays(startDate, endDate) + 1,
    endInferred: false,
    ...extra,
  };
}

function input(overrides: Partial<HealthAwarenessInput> = {}): HealthAwarenessInput {
  return {
    dayLogs: [],
    profile: profile(),
    cycles: [],
    episodes: [],
    today: TODAY,
    urgentSymptomsByDate: {},
    state: EMPTY_HEALTH_AWARENESS_STATE,
    ...overrides,
  };
}

/**
 * Builds a chronological run of `periodLengths.length` periods, `cycleLengths.length`
 * (= periodLengths.length - 1) gaps between them, plus the resulting BleedingEpisode[]
 * and Cycle[] (most-recent-first, index 0 = most recent *completed* cycle, in-progress
 * cycle at index -1 for the final, still-open period). By default every day in the full
 * window (oldest period start .. `today`) gets a DayLog — bleeding days from the period
 * loop, `bleeding: "none"` filler elsewhere — so the G1 day-logging-coverage proxy
 * passes; pass `logEveryDay: false` to opt out for coverage-guard-failure tests.
 */
function buildHistory(params: {
  firstStart: string;
  periodLengths: number[];
  cycleLengths: number[];
  today?: CivilDate;
  logEveryDay?: boolean;
  dayLogFor?: (info: { periodIndex: number; dayIndexInPeriod: number; date: CivilDate }) => Partial<DayLog>;
}): { dayLogs: DayLog[]; episodes: BleedingEpisode[]; cycles: Cycle[] } {
  const { firstStart, periodLengths, cycleLengths, dayLogFor } = params;
  const today = params.today ?? TODAY;
  const logEveryDay = params.logEveryDay ?? true;
  if (cycleLengths.length !== periodLengths.length - 1) {
    throw new Error("cycleLengths must have exactly one fewer entry than periodLengths");
  }

  const starts: CivilDate[] = [];
  const episodes: BleedingEpisode[] = [];
  const dayLogs: DayLog[] = [];
  let cursor = d(firstStart);

  for (let i = 0; i < periodLengths.length; i++) {
    starts.push(cursor);
    const len = periodLengths[i];
    const end = addDays(cursor, len - 1);
    const days = rangeInclusive(cursor, end);
    days.forEach((date, dayIdx) => {
      const extra = dayLogFor ? dayLogFor({ periodIndex: i, dayIndexInPeriod: dayIdx, date }) : {};
      const boundary: DayLog["periodBoundary"] | undefined =
        dayIdx === 0 ? "start" : dayIdx === days.length - 1 && days.length > 1 ? "end" : undefined;
      dayLogs.push(
        log(date, "menstrual", {
          periodBoundary: boundary,
          flow: "medium",
          ...extra,
        }),
      );
    });
    episodes.push(makeEpisode(cursor, end));
    if (i < cycleLengths.length) {
      cursor = addDays(cursor, cycleLengths[i]);
    }
  }

  if (logEveryDay) {
    const covered = new Set(dayLogs.map((l) => l.date));
    for (const date of rangeInclusive(starts[0], today)) {
      if (!covered.has(date)) dayLogs.push(log(date, "none"));
    }
  }

  const n = periodLengths.length;
  const completed: Cycle[] = [];
  for (let j = n - 2; j >= 0; j--) {
    completed.push({
      index: completed.length,
      startDate: starts[j],
      nextStartDate: starts[j + 1],
      lengthDays: diffDays(starts[j], starts[j + 1]),
      status: "ok",
      weight: 1.0,
      episode: episodes[j],
    });
  }
  const inProgress: Cycle = {
    index: -1,
    startDate: starts[n - 1],
    nextStartDate: null,
    lengthDays: null,
    status: "in_progress",
    weight: 1.0,
    episode: episodes[n - 1],
  };

  return { dayLogs, episodes, cycles: [inProgress, ...completed] };
}

/** Six completed cycles of `cycleLength` days, five-day periods, ending today with an
 * in-progress sixth period — the standard "coverage satisfied" fixture for CYC-*. */
function sixCyclesOf(cycleLength: number, periodLength = 5): ReturnType<typeof buildHistory> {
  const totalSpan = cycleLength * 6;
  const firstStart = addDays(TODAY, -totalSpan);
  return buildHistory({
    firstStart,
    periodLengths: new Array(7).fill(periodLength),
    cycleLengths: new Array(6).fill(cycleLength),
  });
}

function ruleIds(messages: ReturnType<typeof computeHealthMessages>): string[] {
  return messages.map((m) => m.ruleId);
}

// ============================================================================
// Baseline
// ============================================================================

describe("computeHealthMessages — baseline", () => {
  it("returns nothing for a brand-new user with no data", () => {
    expect(computeHealthMessages(input())).toEqual([]);
  });
});

// ============================================================================
// CYC-01 / CYC-01i / CYC-02 / CYC-02i — cycle frequency, boundary from both sides
// ============================================================================

describe("CYC-01 / CYC-01i — short cycles", () => {
  it("does not fire at 21 days (right at the ACOG/FIGO boundary)", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(21);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });

  it("fires CYC-01 (discuss_with_clinician) when >=3 of the last 6 cycles are <21 days", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const cyc01 = messages.find((m) => m.ruleId === "CYC-01");
    expect(cyc01).toBeDefined();
    expect(cyc01?.severity).toBe("discuss_with_clinician");
    expect(cyc01?.message).toContain("19");
    expect(cyc01?.dismissible).toBe(true);
  });

  it("fires CYC-01i (informational) in the 21-23 day disagreement zone with >=4 of 6 cycles in it", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(22);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const cyc01i = messages.find((m) => m.ruleId === "CYC-01i");
    expect(cyc01i).toBeDefined();
    expect(cyc01i?.severity).toBe("informational");
  });

  it("does not fire CYC-01i just below the zone's coverage requirement (only 3 of 6 in zone)", () => {
    // 3 cycles at 22 (in the zone), 3 cycles at 30 (well outside it) — only half the
    // window, short of COVERAGE_GUARDS.CYC_DISAGREEMENT_ZONE.minCyclesInZone (4).
    const firstStart = addDays(TODAY, -(22 * 3 + 30 * 3));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(7).fill(5),
      cycleLengths: [22, 22, 22, 30, 30, 30],
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("CYC-01i");
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });
});

describe("CYC-02 / CYC-02i — long cycles", () => {
  it("does not fire at 38 days (right at the boundary)", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(38);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("CYC-02");
  });

  it("fires CYC-02 when >=3 of the last 6 cycles are >38 days", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(41);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const cyc02 = messages.find((m) => m.ruleId === "CYC-02");
    expect(cyc02).toBeDefined();
    expect(cyc02?.severity).toBe("discuss_with_clinician");
    expect(cyc02?.message).toContain("41");
  });

  it("fires CYC-02i in the 36-38 day disagreement zone", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(37);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).toContain("CYC-02i");
  });
});

describe("CYC-01/02 — G1 coverage guard", () => {
  it("does not fire with only 5 completed cycles even though all are short", () => {
    const firstStart = addDays(TODAY, -(19 * 5));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(6).fill(5),
      cycleLengths: new Array(5).fill(19),
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });

  it("does not fire when day-logging coverage over the window is too sparse", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    // Keep only the bleeding-day logs — drop the "quiet day" filler entries so overall
    // logging coverage falls well under the 90% guard.
    const sparse = dayLogs.filter((l) => l.bleeding !== "none");
    const messages = computeHealthMessages(input({ dayLogs: sparse, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });
});

// ============================================================================
// CYC-03 — regularity spread, age-banded
// ============================================================================

describe("CYC-03 — regularity spread", () => {
  function historyWithLengths(lengths: number[]): ReturnType<typeof buildHistory> {
    const firstStart = addDays(TODAY, -lengths.reduce((a, b) => a + b, 0));
    return buildHistory({
      firstStart,
      periodLengths: new Array(lengths.length + 1).fill(5),
      cycleLengths: lengths,
    });
  }

  it("does not fire at exactly a 7-day spread for a 30-year-old (26-41 band)", () => {
    const { dayLogs, episodes, cycles } = historyWithLengths([28, 28, 28, 28, 28, 35]); // spread = 7
    const p = profile({ birthYear: 1996 }); // ~30 in 2026
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-03");
  });

  it("fires CYC-03 when the spread exceeds 7 days for a 30-year-old", () => {
    const { dayLogs, episodes, cycles } = historyWithLengths([28, 28, 28, 28, 28, 36]); // spread = 8
    const p = profile({ birthYear: 1996 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    const cyc03 = messages.find((m) => m.ruleId === "CYC-03");
    expect(cyc03).toBeDefined();
    expect(cyc03?.severity).toBe("informational");
    expect(cyc03?.message).toContain("28");
    expect(cyc03?.message).toContain("36");
  });

  it("uses the wider 9-day band for a 20-year-old and does not fire an 8-day spread", () => {
    const { dayLogs, episodes, cycles } = historyWithLengths([28, 28, 28, 28, 28, 36]); // spread = 8
    const p = profile({ birthYear: 2006 }); // ~20 in 2026
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-03");
  });

  it("stays silent when age is unknown rather than guessing a band", () => {
    const { dayLogs, episodes, cycles } = historyWithLengths([28, 28, 28, 28, 28, 40]); // spread = 12
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles })); // no birthYear
    expect(ruleIds(messages)).not.toContain("CYC-03");
  });
});

// ============================================================================
// CYC-04 — adolescent band (G7)
// ============================================================================

describe("CYC-04 — adolescent band", () => {
  it("uses the 21-45 day ACOG CO 651 band instead of CYC-01/02 for a recent menarche", () => {
    // gynAge < 3: menarche this year or last two.
    const firstStart = addDays(TODAY, -(40 * 4));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(5).fill(5),
      cycleLengths: new Array(4).fill(40), // would be CYC-02 (>38) for an adult
    });
    const p = profile({ menarcheYear: 2025 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-02");
    expect(ruleIds(messages)).not.toContain("CYC-04"); // 40 is inside 21-45, so silent
  });

  it("fires CYC-04 when the adolescent median falls outside 21-45", () => {
    const firstStart = addDays(TODAY, -(50 * 4));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(5).fill(5),
      cycleLengths: new Array(4).fill(50),
    });
    const p = profile({ menarcheYear: 2025 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    const cyc04 = messages.find((m) => m.ruleId === "CYC-04");
    expect(cyc04).toBeDefined();
    expect(cyc04?.severity).toBe("informational");
  });
});

// ============================================================================
// Guard suppression tests
// ============================================================================

describe("guards suppress the rules they say they suppress", () => {
  it("G2 (pregnant) suppresses CYC-01", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const p = profile({}, { pregnant: true });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });

  it("G2 (postpartum <180d) suppresses CYC-01", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const p = profile({}, { deliveryDate: addDays(TODAY, -90) });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });

  it("G2 does not suppress HMB rules (heavy bleeding stays active during pregnancy)", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(28 * 3)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [28, 28, 28],
      dayLogFor: ({ dayIndexInPeriod }) =>
        dayIndexInPeriod === 1 ? { clots: "ge_2_5cm" } : {},
    });
    const p = profile({}, { pregnant: true });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).toContain("HMB-02");
  });

  it("G3 (hormonal method started <180 days ago) suppresses CYC-01 and substitutes CTX-01", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const p = profile(
      {},
      { hormonalMethod: { kind: "combined_pill", startedOn: addDays(TODAY, -30) } },
    );
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
    expect(ruleIds(messages)).toContain("CTX-01");
  });

  it("G3 does not suppress once the method has been active >=180 days", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const p = profile(
      {},
      { hormonalMethod: { kind: "combined_pill", startedOn: addDays(TODAY, -400) } },
    );
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).toContain("CYC-01");
  });

  it("G4 (copper IUD <365 days) downgrades HMB-02 to informational and appends the ACOG context line", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(28 * 3)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [28, 28, 28],
      dayLogFor: ({ dayIndexInPeriod }) => (dayIndexInPeriod === 1 ? { clots: "ge_2_5cm" } : {}),
    });
    const p = profile({}, { copperIudInsertedOn: addDays(TODAY, -100) });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    const hmb02 = messages.find((m) => m.ruleId === "HMB-02");
    expect(hmb02).toBeDefined();
    expect(hmb02?.severity).toBe("informational");
    expect(hmb02?.message).toMatch(/copper IUD/i);
  });

  it("G5 (perimenopause) suppresses CYC-01/02/03 and substitutes PERI-01", () => {
    // Variable cycle lengths (spread > 9) so PERI-01's own trigger is actually met —
    // G5 suppressing CYC-01 alone doesn't imply PERI-01 fires; it has its own condition.
    const firstStart = addDays(TODAY, -(19 * 3 + 45 * 3));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(7).fill(5),
      cycleLengths: [19, 19, 19, 45, 45, 45],
    });
    const p = profile({ birthYear: 1976 }); // ~50 in 2026
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
    expect(ruleIds(messages)).toContain("PERI-01");
  });

  it("G5 does not suppress HMB/DUR/IMB — they stay active during perimenopause", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(28 * 3)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [28, 28, 28],
      dayLogFor: ({ dayIndexInPeriod }) => (dayIndexInPeriod === 1 ? { clots: "ge_2_5cm" } : {}),
    });
    const p = profile({ birthYear: 1976 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).toContain("HMB-02");
  });

  it("G6 (postmenopause) suppresses every other rule; only PMB-01 remains", () => {
    const bleedDates = ["2023-01-01", "2026-07-20"]; // gap >> 365 days
    const dayLogs = bleedDates.map((date) => log(date, "menstrual", { flow: "medium" }));
    const p = profile({ birthYear: 1970 }, { menopauseSelfDeclared: true });
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    expect(ruleIds(messages)).toEqual(["PMB-01"]);
  });

  it("G7 (adolescent) routes CYC-01/02 to CYC-04 rather than firing them directly", () => {
    const firstStart = addDays(TODAY, -(19 * 4));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(5).fill(5),
      cycleLengths: new Array(4).fill(19),
    });
    const p = profile({ menarcheYear: 2025 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
    expect(ruleIds(messages)).toContain("CYC-04");
  });
});

// ============================================================================
// DUR-01i / DUR-02
// ============================================================================

describe("DUR-01i / DUR-02 — prolonged menses", () => {
  function withEpisodeLengths(lengths: number[]) {
    const firstStart = addDays(TODAY, -(lengths.length * 30));
    return buildHistory({
      firstStart,
      periodLengths: lengths,
      cycleLengths: new Array(lengths.length - 1).fill(30),
    });
  }

  it("does not fire DUR-01i at exactly 7 days", () => {
    const { dayLogs, episodes, cycles } = withEpisodeLengths([5, 5, 5, 7]);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("DUR-01i");
  });

  it("fires DUR-01i (informational) at 8 days for the most recent period", () => {
    const { dayLogs, episodes, cycles } = withEpisodeLengths([5, 5, 5, 8]);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const dur01i = messages.find((m) => m.ruleId === "DUR-01i");
    expect(dur01i).toBeDefined();
    expect(dur01i?.severity).toBe("informational");
    expect(dur01i?.message).toContain("8");
  });

  it("does not fire DUR-02 at exactly 8 days", () => {
    const { dayLogs, episodes, cycles } = withEpisodeLengths([5, 8, 8, 8]);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("DUR-02");
  });

  it("fires DUR-02 (discuss_with_clinician) when >=2 of the last 3 periods exceed 8 days", () => {
    const { dayLogs, episodes, cycles } = withEpisodeLengths([5, 9, 9, 9]);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const dur02 = messages.find((m) => m.ruleId === "DUR-02");
    expect(dur02).toBeDefined();
    expect(dur02?.severity).toBe("discuss_with_clinician");
  });

  it("needs >=3 complete episodes with explicit boundaries (G1) before firing", () => {
    const { dayLogs, episodes, cycles } = withEpisodeLengths([9, 9]);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("DUR-01i");
    expect(ruleIds(messages)).not.toContain("DUR-02");
  });

  it("does not credit an episode with an inferred (not explicit) end boundary", () => {
    const { dayLogs, episodes, cycles } = withEpisodeLengths([9, 9, 9, 9]);
    const inferred = episodes.map((e, i) => (i === episodes.length - 1 ? { ...e, endInferred: true } : e));
    const messages = computeHealthMessages(input({ dayLogs, episodes: inferred, cycles }));
    expect(ruleIds(messages)).not.toContain("DUR-01i");
  });
});

// ============================================================================
// HMB-01 .. HMB-05
// ============================================================================

describe("HMB-01 — fast product changes", () => {
  function withFastChange(fastestProductChangeHours: DayLog["fastestProductChangeHours"], productChanges: number) {
    return buildHistory({
      firstStart: addDays(TODAY, -30),
      periodLengths: [5],
      cycleLengths: [],
      dayLogFor: ({ dayIndexInPeriod }) =>
        dayIndexInPeriod === 1 ? { fastestProductChangeHours, productChanges } : {},
    });
  }

  it("does not fire just under the 2-consecutive-hour span (1 hour with only 2 changes)", () => {
    const { dayLogs, episodes, cycles } = withFastChange(1, 2); // span = (2-1)*1 = 1h
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("HMB-01");
  });

  it("fires HMB-01 at exactly a 2-hour span with a <=2-hour pace", () => {
    const { dayLogs, episodes, cycles } = withFastChange(2, 2); // span = (2-1)*2 = 2h
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const hmb01 = messages.find((m) => m.ruleId === "HMB-01");
    expect(hmb01).toBeDefined();
    expect(hmb01?.severity).toBe("discuss_with_clinician");
  });

  it("does not fire when the pace is slower than every 1-2 hours", () => {
    const { dayLogs, episodes, cycles } = withFastChange(4, 3); // pace too slow
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("HMB-01");
  });
});

describe("HMB-02 — qualifying clots", () => {
  function withClotsIn(periodsWithClots: number, totalPeriods: number) {
    return buildHistory({
      firstStart: addDays(TODAY, -(totalPeriods * 30)),
      periodLengths: new Array(totalPeriods).fill(5),
      cycleLengths: new Array(totalPeriods - 1).fill(30),
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) =>
        dayIndexInPeriod === 1 && periodIndex >= totalPeriods - periodsWithClots
          ? { clots: "ge_2_5cm" as const }
          : {},
    });
  }

  it("does not fire with only 1 of the last 3 periods showing qualifying clots", () => {
    const { dayLogs, episodes, cycles } = withClotsIn(1, 4);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("HMB-02");
  });

  it("fires HMB-02 with 2 of the last 3 periods showing qualifying clots", () => {
    const { dayLogs, episodes, cycles } = withClotsIn(2, 4);
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const hmb02 = messages.find((m) => m.ruleId === "HMB-02");
    expect(hmb02).toBeDefined();
    expect(hmb02?.message).toContain("2");
  });

  it("small clots do not count", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ dayIndexInPeriod }) => (dayIndexInPeriod === 1 ? { clots: "small" as const } : {}),
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("HMB-02");
  });
});

describe("HMB-03 — double protection / night change / leak-through", () => {
  it("fires with the joined reason phrase when >=2 of the last 3 periods qualify", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) => {
        if (dayIndexInPeriod !== 1) return {};
        if (periodIndex === 2) return { nightChange: true };
        if (periodIndex === 3) return { doubleProtection: true };
        return {};
      },
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const hmb03 = messages.find((m) => m.ruleId === "HMB-03");
    expect(hmb03).toBeDefined();
    expect(hmb03?.severity).toBe("informational");
    expect(hmb03?.message).toContain("changing overnight");
    expect(hmb03?.message).toContain("needing two products at once");
  });

  it("does not fire with only 1 of the last 3 periods qualifying", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) =>
        dayIndexInPeriod === 1 && periodIndex === 3 ? { leakThrough: true } : {},
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("HMB-03");
  });
});

describe("HMB-04 — heavy bleeding + fatigue/breathlessness across consecutive cycles", () => {
  it("fires when the last 3 periods were all heavy and fatigue was logged", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) => {
        if (dayIndexInPeriod !== 1) return {};
        if (periodIndex >= 1) return { clots: "ge_2_5cm" as const, symptoms: ["fatigue"] as const };
        return {};
      },
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).toContain("HMB-04");
  });

  it("does not fire without fatigue or breathlessness logged, even if all 3 periods were heavy", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) =>
        dayIndexInPeriod === 1 && periodIndex >= 1 ? { clots: "ge_2_5cm" as const } : {},
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("HMB-04");
  });
});

describe("HMB-05 — heavy every period since menarche", () => {
  it("fires when >=80% of >=5 qualifying periods were heavy and gynAge >= 1", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(6 * 30)),
      periodLengths: new Array(6).fill(5),
      cycleLengths: new Array(5).fill(30),
      dayLogFor: ({ dayIndexInPeriod }) => (dayIndexInPeriod === 1 ? { clots: "ge_2_5cm" as const } : {}),
    });
    const p = profile({ menarcheYear: 2020 });
    // The same "every period had qualifying clots" data that satisfies HMB-05 also
    // satisfies HMB-02's own last-3-periods criterion (the windows overlap by
    // construction), and HMB-02 (discuss_with_clinician) outranks HMB-05
    // (informational) for G9's one-non-urgent-message cap. Dismiss the higher-priority
    // rules so this test isolates HMB-05's own trigger logic rather than G9's ranking,
    // which is exercised separately in the "G9 — rate limit" tests below.
    const state: HealthAwarenessState = {
      dismissals: {
        "HMB-01": { dismissedOn: TODAY },
        "HMB-02": { dismissedOn: TODAY },
        "HMB-03": { dismissedOn: TODAY },
        "HMB-04": { dismissedOn: TODAY },
      },
      nonUrgentShownThisCycle: null,
    };
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p, state }));
    expect(ruleIds(messages)).toContain("HMB-05");
  });

  it("does not fire when gynAge < 1", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(6 * 30)),
      periodLengths: new Array(6).fill(5),
      cycleLengths: new Array(5).fill(30),
      dayLogFor: ({ dayIndexInPeriod }) => (dayIndexInPeriod === 1 ? { clots: "ge_2_5cm" as const } : {}),
    });
    const p = profile({ menarcheYear: 2026 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("HMB-05");
  });
});

// ============================================================================
// URG-01 — the red-flag combination. Full path, every guard.
// ============================================================================

describe("URG-01 — red-flag combination", () => {
  function urgentInput(symptom: UrgentSystemicSymptom | null, overrides: Partial<HealthAwarenessInput> = {}) {
    const dayLogs = [log("2026-07-20", "menstrual", { fastestProductChangeHours: 1, productChanges: 4, flow: "very_heavy" })];
    return input({
      dayLogs,
      urgentSymptomsByDate: symptom ? { ["2026-07-20" as CivilDate]: [symptom] } : {},
      ...overrides,
    });
  }

  it("does not fire on the bleeding criterion alone, with no ticked symptom", () => {
    const messages = computeHealthMessages(urgentInput(null));
    expect(ruleIds(messages)).not.toContain("URG-01");
  });

  it.each<UrgentSystemicSymptom>([
    "chest_pain",
    "shortness_of_breath",
    "lightheaded_or_dizzy",
    "feeling_faint",
  ])("fires on the bleeding criterion plus just ONE ticked symptom: %s (deliberate deviation from ACOG's literal 'and')", (symptom) => {
    const messages = computeHealthMessages(urgentInput(symptom));
    const urg01 = messages.find((m) => m.ruleId === "URG-01");
    expect(urg01).toBeDefined();
    expect(urg01?.severity).toBe("seek_urgent_care");
    expect(urg01?.dismissible).toBe(false);
    expect(urg01?.message).toMatch(/ACOG advises/);
  });

  it("does not fire when the bleeding pace is slower than every hour", () => {
    const dayLogs = [log("2026-07-20", "menstrual", { fastestProductChangeHours: 2, productChanges: 4 })];
    const messages = computeHealthMessages(
      input({ dayLogs, urgentSymptomsByDate: { ["2026-07-20" as CivilDate]: ["chest_pain"] } }),
    );
    expect(ruleIds(messages)).not.toContain("URG-01");
  });

  it("does not fire on a >2h span from ticks alone without the matching product-change log", () => {
    const dayLogs = [log("2026-07-20", "menstrual", {})]; // no fastestProductChangeHours/productChanges
    const messages = computeHealthMessages(
      input({ dayLogs, urgentSymptomsByDate: { ["2026-07-20" as CivilDate]: ["chest_pain"] } }),
    );
    expect(ruleIds(messages)).not.toContain("URG-01");
  });

  it("survives G2 (pregnant)", () => {
    const messages = computeHealthMessages(
      urgentInput("chest_pain", { profile: profile({}, { pregnant: true }) }),
    );
    expect(ruleIds(messages)).toContain("URG-01");
  });

  it("survives G6 (postmenopause) — fires alongside PMB-01, not suppressed by it", () => {
    const p = profile({ birthYear: 1970 }, { menopauseSelfDeclared: true });
    const messages = computeHealthMessages(urgentInput("chest_pain", { profile: p }));
    expect(ruleIds(messages)).toContain("URG-01");
  });

  it("survives G8 — fires even when previously dismissed", () => {
    const state: HealthAwarenessState = {
      dismissals: { "URG-01": { dismissedOn: addDays(TODAY, -1) } },
      nonUrgentShownThisCycle: null,
    };
    const messages = computeHealthMessages(urgentInput("chest_pain", { state }));
    expect(ruleIds(messages)).toContain("URG-01");
  });

  it("survives G9 — fires even when the per-cycle non-urgent budget is already exhausted", () => {
    const state: HealthAwarenessState = {
      dismissals: {},
      nonUrgentShownThisCycle: { cycleStartDate: TODAY, count: 2 },
    };
    const messages = computeHealthMessages(urgentInput("chest_pain", { state }));
    expect(ruleIds(messages)).toContain("URG-01");
  });

  it("survives settings.healthAwarenessEnabled = false", () => {
    const p = profile({ settings: { ...DEFAULT_SETTINGS, healthAwarenessEnabled: false } });
    const messages = computeHealthMessages(urgentInput("chest_pain", { profile: p }));
    expect(messages).toEqual([expect.objectContaining({ ruleId: "URG-01" })]);
  });

  it("is exactly the rule set NEVER_SUPPRESSED_RULES documents, alongside URG-02 and PMB-01", () => {
    expect(NEVER_SUPPRESSED_RULES.has("URG-01")).toBe(true);
    expect(NEVER_SUPPRESSED_RULES.has("URG-02")).toBe(true);
    expect(NEVER_SUPPRESSED_RULES.has("PMB-01")).toBe(true);
    expect(NEVER_SUPPRESSED_RULES.has("CYC-01")).toBe(false);
  });
});

// ============================================================================
// URG-02 — NHS urgent pain rule, locale-gated
// ============================================================================

describe("URG-02 — severe pain unrelieved by painkillers", () => {
  it("does not fire on severe pain alone (painkillers not tried / did help)", () => {
    const dayLogs = [log("2026-07-20", "menstrual", { pain: { severity: "severe" } })];
    const messages = computeHealthMessages(input({ dayLogs }));
    expect(ruleIds(messages)).not.toContain("URG-02");
  });

  it("does not fire on 'moderate' pain even with painkillers not helping", () => {
    const dayLogs = [
      log("2026-07-20", "menstrual", { pain: { severity: "moderate", painkillerDidNotHelp: true } }),
    ];
    const messages = computeHealthMessages(input({ dayLogs }));
    expect(ruleIds(messages)).not.toContain("URG-02");
  });

  it("fires as discuss_with_clinician in en-US", () => {
    const dayLogs = [
      log("2026-07-20", "menstrual", { pain: { severity: "severe", painkillerDidNotHelp: true } }),
    ];
    const messages = computeHealthMessages(input({ dayLogs }));
    const urg02 = messages.find((m) => m.ruleId === "URG-02");
    expect(urg02).toBeDefined();
    expect(urg02?.severity).toBe("discuss_with_clinician");
    expect(urg02?.dismissible).toBe(false);
  });

  it("fires as seek_urgent_care in en-GB", () => {
    const dayLogs = [
      log("2026-07-20", "menstrual", { pain: { severity: "severe", painkillerDidNotHelp: true } }),
    ];
    const p = profile({ settings: { ...DEFAULT_SETTINGS, locale: "en-GB" } });
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    const urg02 = messages.find((m) => m.ruleId === "URG-02");
    expect(urg02?.severity).toBe("seek_urgent_care");
  });

  it("ignores G8 — fires again even when previously dismissed", () => {
    const dayLogs = [
      log("2026-07-20", "menstrual", { pain: { severity: "severe", painkillerDidNotHelp: true } }),
    ];
    const state: HealthAwarenessState = {
      dismissals: { "URG-02": { dismissedOn: addDays(TODAY, -1) } },
      nonUrgentShownThisCycle: null,
    };
    const messages = computeHealthMessages(input({ dayLogs, state }));
    expect(ruleIds(messages)).toContain("URG-02");
  });
});

// ============================================================================
// DYS-01 / DYS-02
// ============================================================================

describe("DYS-01 / DYS-02 — dysmenorrhea", () => {
  it("fires DYS-01 when >=2 of the last 3 periods have >=2 interference days", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) =>
        periodIndex >= 2 && dayIndexInPeriod <= 1 ? { pain: { severity: "severe", interferedWith: ["work_or_school"] } } : {},
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    const dys01 = messages.find((m) => m.ruleId === "DYS-01");
    expect(dys01).toBeDefined();
    expect(dys01?.severity).toBe("discuss_with_clinician");
  });

  it("does not fire DYS-01 with only 1 interference day per period", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
      dayLogFor: ({ periodIndex, dayIndexInPeriod }) =>
        periodIndex >= 2 && dayIndexInPeriod === 0 ? { pain: { severity: "severe", interferedWith: ["sleep"] } } : {},
    });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles }));
    expect(ruleIds(messages)).not.toContain("DYS-01");
  });

  it("fires DYS-02 when pain is logged outside the premenstrual/menstrual window in >=2 of last 3 cycles", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
    });
    // Add mid-cycle pain (well outside [start-3, end]) for the two most recent completed cycles.
    const extra = [
      log(addDays(cyclesMidpoint(cycles, 0), 0), "none", { pain: { severity: "moderate" } }),
      log(addDays(cyclesMidpoint(cycles, 1), 0), "none", { pain: { severity: "moderate" } }),
    ];
    const messages = computeHealthMessages(input({ dayLogs: [...dayLogs, ...extra], episodes, cycles }));
    expect(ruleIds(messages)).toContain("DYS-02");
  });
});

function cyclesMidpoint(cycles: Cycle[], indexFromMostRecent: number): CivilDate {
  const completed = cycles.filter((c) => c.status !== "in_progress");
  const c = completed[indexFromMostRecent];
  const span = c.nextStartDate ? diffDays(c.startDate, c.nextStartDate) : 20;
  return addDays(c.startDate, Math.floor(span / 2));
}

// ============================================================================
// IMB-01 / PCB-01
// ============================================================================

describe("IMB-01 / PCB-01", () => {
  it("does not fire IMB-01 on a single intermenstrual occurrence", () => {
    const dayLogs = [log("2026-06-01", "spotting", { bleedingContext: "intermenstrual" })];
    const messages = computeHealthMessages(input({ dayLogs }));
    expect(ruleIds(messages)).not.toContain("IMB-01");
  });

  it("fires IMB-01 with >=2 occurrences across >=2 distinct cycles", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
    });
    const extra = [
      log(cyclesMidpoint(cycles, 0), "spotting", { bleedingContext: "intermenstrual" }),
      log(cyclesMidpoint(cycles, 1), "spotting", { bleedingContext: "intermenstrual" }),
    ];
    const messages = computeHealthMessages(input({ dayLogs: [...dayLogs, ...extra], episodes, cycles }));
    expect(ruleIds(messages)).toContain("IMB-01");
  });

  it("G3 (recent hormonal method start) suppresses IMB-01 and substitutes CTX-01", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -(4 * 30)),
      periodLengths: [5, 5, 5, 5],
      cycleLengths: [30, 30, 30],
    });
    const extra = [
      log(cyclesMidpoint(cycles, 0), "spotting", { bleedingContext: "intermenstrual" }),
      log(cyclesMidpoint(cycles, 1), "spotting", { bleedingContext: "intermenstrual" }),
    ];
    const p = profile({}, { hormonalMethod: { kind: "combined_pill", startedOn: addDays(TODAY, -30) } });
    const messages = computeHealthMessages(
      input({ dayLogs: [...dayLogs, ...extra], episodes, cycles, profile: p }),
    );
    expect(ruleIds(messages)).not.toContain("IMB-01");
    expect(ruleIds(messages)).toContain("CTX-01");
  });

  it("does not fire PCB-01 on a single occurrence (OWH's 'more than once' qualifier)", () => {
    const dayLogs = [log("2026-06-01", "spotting", { bleedingContext: "postcoital" })];
    const messages = computeHealthMessages(input({ dayLogs }));
    expect(ruleIds(messages)).not.toContain("PCB-01");
  });

  it("fires PCB-01 with >=2 occurrences", () => {
    const dayLogs = [
      log("2026-06-01", "spotting", { bleedingContext: "postcoital" }),
      log("2026-05-01", "spotting", { bleedingContext: "postcoital" }),
    ];
    const messages = computeHealthMessages(input({ dayLogs }));
    expect(ruleIds(messages)).toContain("PCB-01");
  });
});

// ============================================================================
// AMEN-01 / AMEN-02
// ============================================================================

describe("AMEN-01 / AMEN-02 — amenorrhea", () => {
  it("does not fire at 89 days since the last logged period", () => {
    const dayLogs = [log(addDays(TODAY, -89), "menstrual")];
    const messages = computeHealthMessages(input({ dayLogs }));
    expect(ruleIds(messages)).not.toContain("AMEN-01");
  });

  it("fires AMEN-01 at exactly 90 days", () => {
    const dayLogs = [log(addDays(TODAY, -90), "menstrual")];
    const messages = computeHealthMessages(input({ dayLogs }));
    const amen01 = messages.find((m) => m.ruleId === "AMEN-01");
    expect(amen01).toBeDefined();
    expect(amen01?.message).toContain("90");
  });

  it("G2/G3 mandatory suppression: pregnant users never get AMEN-01", () => {
    const dayLogs = [log(addDays(TODAY, -400), "menstrual")];
    const p = profile({}, { pregnant: true });
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    expect(ruleIds(messages)).not.toContain("AMEN-01");
  });

  it("suppresses AMEN-01 permanently while an ongoing bleeding-suppressing method is active", () => {
    const dayLogs = [log(addDays(TODAY, -400), "menstrual")];
    const p = profile({}, { hormonalMethod: { kind: "hormonal_iud", startedOn: addDays(TODAY, -900) } });
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    expect(ruleIds(messages)).not.toContain("AMEN-01");
  });

  it("does not fire AMEN-02 at age 14", () => {
    const p = profile({ birthYear: 2012 }); // 14 in 2026
    const messages = computeHealthMessages(input({ profile: p }));
    expect(ruleIds(messages)).not.toContain("AMEN-02");
  });

  it("fires AMEN-02 at age 15 with no menarche recorded and no period ever logged", () => {
    const p = profile({ birthYear: 2011 }); // 15 in 2026
    const messages = computeHealthMessages(input({ profile: p }));
    const amen02 = messages.find((m) => m.ruleId === "AMEN-02");
    expect(amen02).toBeDefined();
    expect(amen02?.severity).toBe("discuss_with_clinician");
  });

  it("does not fire AMEN-02 once a period has actually been logged", () => {
    const p = profile({ birthYear: 2011 });
    const dayLogs = [log(addDays(TODAY, -10), "menstrual")];
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    expect(ruleIds(messages)).not.toContain("AMEN-02");
  });
});

// ============================================================================
// PMB-01 — postmenopausal bleeding
// ============================================================================

describe("PMB-01 — postmenopausal bleeding", () => {
  it("does not fire at a 364-day gap", () => {
    const dayLogs = [log(addDays(TODAY, -364 - 1), "menstrual"), log(addDays(TODAY, -1), "spotting")];
    const p = profile({ birthYear: 1970 });
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    expect(ruleIds(messages)).not.toContain("PMB-01");
  });

  it("fires at exactly a 365-day gap, even for spotting only", () => {
    const dayLogs = [log(addDays(TODAY, -365 - 1), "menstrual"), log(addDays(TODAY, -1), "spotting")];
    const p = profile({ birthYear: 1970 });
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    const pmb01 = messages.find((m) => m.ruleId === "PMB-01");
    expect(pmb01).toBeDefined();
    expect(pmb01?.dismissible).toBe(false);
  });

  it("requires age >=45 or self-declared menopause", () => {
    const dayLogs = [log(addDays(TODAY, -365 - 1), "menstrual"), log(addDays(TODAY, -1), "spotting")];
    const p = profile({ birthYear: 1996 }); // ~30
    const messages = computeHealthMessages(input({ dayLogs, profile: p }));
    expect(ruleIds(messages)).not.toContain("PMB-01");
  });

  it("ignores G8 — fires again even when previously dismissed", () => {
    const dayLogs = [log(addDays(TODAY, -365 - 1), "menstrual"), log(addDays(TODAY, -1), "spotting")];
    const p = profile({ birthYear: 1970 });
    const state: HealthAwarenessState = {
      dismissals: { "PMB-01": { dismissedOn: addDays(TODAY, -1) } },
      nonUrgentShownThisCycle: null,
    };
    const messages = computeHealthMessages(input({ dayLogs, profile: p, state }));
    expect(ruleIds(messages)).toContain("PMB-01");
  });

  it("ignores G9 — fires even when the per-cycle non-urgent budget is already spent", () => {
    const dayLogs = [log(addDays(TODAY, -365 - 1), "menstrual"), log(addDays(TODAY, -1), "spotting")];
    const p = profile({ birthYear: 1970 });
    const state: HealthAwarenessState = {
      dismissals: {},
      nonUrgentShownThisCycle: { cycleStartDate: TODAY, count: 2 },
    };
    const messages = computeHealthMessages(input({ dayLogs, profile: p, state }));
    expect(ruleIds(messages)).toContain("PMB-01");
  });
});

// ============================================================================
// PERI-01
// ============================================================================

describe("PERI-01 — perimenopause variability", () => {
  it("fires from self-declaration alone with a qualifying gap, even with <6 cycles", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -90),
      periodLengths: [5, 5],
      cycleLengths: [70], // >= 60-day gap
    });
    const p = profile({}, { perimenopauseSelfDeclared: true });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).toContain("PERI-01");
  });

  it("does not fire from age >=45 alone without 6 cycles or a self-declaration", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -90),
      periodLengths: [5, 5],
      cycleLengths: [70],
    });
    const p = profile({ birthYear: 1976 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("PERI-01");
  });

  it("G2 suppresses PERI-01", () => {
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart: addDays(TODAY, -90),
      periodLengths: [5, 5],
      cycleLengths: [70],
    });
    const p = profile({}, { perimenopauseSelfDeclared: true, pregnant: true });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(ruleIds(messages)).not.toContain("PERI-01");
  });
});

// ============================================================================
// G8 snooze/dismiss
// ============================================================================

describe("G8 — snooze/dismiss", () => {
  it("suppresses a dismissible rule for 89 days after dismissal", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const state: HealthAwarenessState = {
      dismissals: { "CYC-01": { dismissedOn: addDays(TODAY, -89) } },
      nonUrgentShownThisCycle: null,
    };
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, state }));
    expect(ruleIds(messages)).not.toContain("CYC-01");
  });

  it("lets the rule fire again once 90 days have passed since dismissal", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const state: HealthAwarenessState = {
      dismissals: { "CYC-01": { dismissedOn: addDays(TODAY, -90) } },
      nonUrgentShownThisCycle: null,
    };
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, state }));
    expect(ruleIds(messages)).toContain("CYC-01");
  });
});

// ============================================================================
// G9 — rate limit
// ============================================================================

describe("G9 — rate limit", () => {
  it("returns at most one non-urgent message even when several rules qualify simultaneously", () => {
    // Short AND highly variable cycles -> CYC-01 and CYC-03 both qualify.
    const firstStart = addDays(TODAY, -(19 * 5 + 10));
    const { dayLogs, episodes, cycles } = buildHistory({
      firstStart,
      periodLengths: new Array(7).fill(5),
      cycleLengths: [19, 19, 19, 19, 10, 19],
    });
    const p = profile({ birthYear: 1996 });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    const nonUrgent = messages.filter((m) => m.severity !== "seek_urgent_care" && m.ruleId !== "PMB-01");
    expect(nonUrgent.length).toBeLessThanOrEqual(1);
  });

  it("returns nothing non-urgent once the per-cycle budget (2) is already spent", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const cycleKey = cycles.find((c) => c.status === "ok" && c.index === 0)?.startDate ?? cycles[0].startDate;
    const currentCycleStart = cycles.find((c) => c.status === "in_progress")?.startDate ?? cycleKey;
    const state: HealthAwarenessState = {
      dismissals: {},
      nonUrgentShownThisCycle: { cycleStartDate: currentCycleStart, count: 2 },
    };
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, state }));
    expect(messages).toEqual([]);
  });

  it("budget resets for a different cycle than the one recorded in state", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const state: HealthAwarenessState = {
      dismissals: {},
      nonUrgentShownThisCycle: { cycleStartDate: d("2000-01-01"), count: 2 },
    };
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, state }));
    expect(ruleIds(messages)).toContain("CYC-01");
  });
});

// ============================================================================
// settings.healthAwarenessEnabled
// ============================================================================

describe("settings.healthAwarenessEnabled = false", () => {
  it("suppresses ordinary rules but not the never-suppressed trio", () => {
    const { dayLogs, episodes, cycles } = sixCyclesOf(19);
    const p = profile({ settings: { ...DEFAULT_SETTINGS, healthAwarenessEnabled: false } });
    const messages = computeHealthMessages(input({ dayLogs, episodes, cycles, profile: p }));
    expect(messages).toEqual([]);
  });
});
