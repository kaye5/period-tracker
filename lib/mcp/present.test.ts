import { describe, expect, it } from "vitest";
import { addDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import type { DayLog, HealthMessage, Profile } from "@/lib/domain/types";
import { computeEverything } from "@/lib/engine";
import { CALIBRATION_NEUTRAL } from "@/lib/engine/performance";
import { CONFIDENCE_LABELS, FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import { INSIGHT_DISCLAIMER } from "@/lib/copy/insights";
import {
  historyRangeError,
  NEXT_PERIOD_NOTE,
  presentCycleStats,
  presentFertileWindow,
  presentHealthNotes,
  presentHistory,
  presentInsights,
  presentNextPeriod,
  presentPeriodLength,
  presentToday,
  type CycleView,
} from "./present";
import { civilDate, timeZone } from "./schemas";

const d = (s: string) => parseCivil(s);

function profileOf(overrides: { fertilityEnabled?: boolean; reportedTypicalPeriodDays?: number } = {}): Profile {
  return {
    birthYear: 1995,
    ...(overrides.reportedTypicalPeriodDays !== undefined
      ? { reportedTypicalPeriodDays: overrides.reportedTypicalPeriodDays }
      : {}),
    state: {
      pregnant: false,
      breastfeeding: false,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: false,
    },
    settings: {
      fertilityEnabled: overrides.fertilityEnabled ?? false,
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
    },
  };
}

function log(date: CivilDate, extra: Partial<DayLog> = {}): DayLog {
  return { date, bleeding: "none", pain: { severity: "none" }, symptoms: [], loggedAt: date, ...extra };
}

function period(start: CivilDate, days = 5): DayLog[] {
  return Array.from({ length: days }, (_, i) =>
    log(addDays(start, i), {
      bleeding: "menstrual",
      flow: "medium",
      periodBoundary: i === 0 ? "start" : i === days - 1 ? "end" : undefined,
    }),
  );
}

/** Five 28-day cycles from 2026-05-01; the last period starts 2026-09-18. */
const STARTS = [0, 28, 56, 84, 112, 140].map((n) => addDays(d("2026-05-01"), n));
const HISTORY = STARTS.flatMap((s) => period(s));

function view(dayLogs: DayLog[], today: CivilDate, profile = profileOf()): CycleView {
  const output = computeEverything({
    dayLogs,
    profile,
    today,
    decisions: { excludedCycles: {}, skipPrompts: {} },
    calibration: CALIBRATION_NEUTRAL,
  });
  const typicalPeriodDays =
    output.stats.periodDuration !== null
      ? Math.round(output.stats.periodDuration.center)
      : (profile.reportedTypicalPeriodDays ?? null);
  return {
    profile,
    today,
    dayLogs,
    logsByDate: new Map(dayLogs.map((l) => [l.date, l])),
    output,
    calendar: { dayLogs, fertilityEnabled: profile.settings.fertilityEnabled, weekStartsOn: 0, typicalPeriodDays },
  };
}

const MID_CYCLE = addDays(STARTS[5], 9); // cycle day 10

describe("presentNextPeriod", () => {
  it("returns the engine's range, confidence and basis — never the centre date", () => {
    const v = view(HISTORY, MID_CYCLE);
    const p = v.output.prediction;
    const out = presentNextPeriod(v);
    expect(out.range).toEqual({ from: p.low, to: p.high });
    expect(out.confidence).toEqual({ label: CONFIDENCE_LABELS[p.confidence], reason: p.confidenceReason });
    expect(out.basedOnCycles).toBe(p.basis.usableCycles);
    expect(out.predictionKind).toBe(p.kind);
    expect(out.note).toBe("This is an estimate. Always present it as a range, never a single date.");
    expect(out.note).toBe(NEXT_PERIOD_NOTE);
    expect(p.center).not.toBeNull();
    expect(p.center).not.toBe(p.low);
    expect(p.center).not.toBe(p.high);
    expect(JSON.stringify(out)).not.toContain(p.center as string);
    expect(out).not.toHaveProperty("center");
  });

  it("counts days until the range, and overdue days only after it", () => {
    const v = view(HISTORY, MID_CYCLE);
    v.output.prediction = { ...v.output.prediction, low: d("2026-10-10"), high: d("2026-10-16") };
    expect(presentNextPeriod({ ...v, today: d("2026-10-07") })).toMatchObject({ daysUntilRange: 3, overdueByDays: null });
    expect(presentNextPeriod({ ...v, today: d("2026-10-10") })).toMatchObject({ daysUntilRange: null, overdueByDays: null });
    expect(presentNextPeriod({ ...v, today: d("2026-10-16") })).toMatchObject({ daysUntilRange: null, overdueByDays: null });
    expect(presentNextPeriod({ ...v, today: d("2026-10-18") })).toMatchObject({ daysUntilRange: null, overdueByDays: 2 });
  });

  it("returns a null range when the engine cannot estimate", () => {
    const out = presentNextPeriod(view([], MID_CYCLE));
    expect(out.range).toBeNull();
    expect(out.daysUntilRange).toBeNull();
    expect(out.overdueByDays).toBeNull();
    expect(out.predictionKind).toBe("none");
  });
});

describe("presentToday", () => {
  it("gives the cycle day, no phase with fertility off, and today's log", () => {
    const today = MID_CYCLE;
    const logs = [...HISTORY, log(today, { mood: ["calm"], symptoms: ["headache"] })];
    const out = presentToday(view(logs, today));
    expect(out).toEqual({
      date: today,
      cycleDay: 10,
      phase: null,
      periodToday: false,
      ongoingPeriod: null,
      loggedToday: { bleeding: "none", flow: null, moods: ["calm"], symptoms: ["headache"], nothingToReport: false },
    });
  });

  it("labels the phase as an estimate when fertility is on (menstrual is not)", () => {
    const fertile = presentToday(view(HISTORY, MID_CYCLE, profileOf({ fertilityEnabled: true })));
    expect(fertile.phase).toMatchObject({ name: "follicular", label: "Follicular", estimated: true });

    const onPeriod = presentToday(view(HISTORY, addDays(STARTS[5], 1), profileOf({ fertilityEnabled: true })));
    expect(onPeriod.phase).toEqual({ name: "menstrual", label: "Menstrual", estimated: false });
  });

  it("reports an ongoing period when today is a period day, and when it was yesterday", () => {
    const start = addDays(STARTS[5], 28);
    const logs = [...HISTORY, ...period(start, 2).map((l) => ({ ...l, periodBoundary: l.date === start ? ("start" as const) : undefined }))];
    const day2 = addDays(start, 1);
    const onDay2 = presentToday(view(logs, day2));
    expect(onDay2.periodToday).toBe(true);
    expect(onDay2.ongoingPeriod).toEqual({ startDate: start, lastRecordedDay: day2 });

    const onDay3 = presentToday(view(logs, addDays(start, 2)));
    expect(onDay3.periodToday).toBe(false);
    expect(onDay3.loggedToday).toBeNull();
    expect(onDay3.ongoingPeriod).toEqual({ startDate: start, lastRecordedDay: day2 });
  });

  it("has no cycle day before any period", () => {
    expect(presentToday(view([], MID_CYCLE)).cycleDay).toBeNull();
  });
});

describe("presentPeriodLength", () => {
  it("uses recorded durations and the expected continuation of an ongoing period", () => {
    const start = addDays(STARTS[5], 28);
    const logs = [...HISTORY, log(start, { bleeding: "menstrual", periodBoundary: "start" }), log(addDays(start, 1), { bleeding: "menstrual" })];
    const out = presentPeriodLength(view(logs, addDays(start, 1)));
    expect(out.typicalDuration).toEqual({ low: 5, high: 5, basedOnPeriods: 6, source: "recorded" });
    expect(out.current).toEqual({
      startDate: start,
      lastRecordedDay: addDays(start, 1),
      daysSoFar: 2,
      expectedToContinueThrough: { from: addDays(start, 2), to: addDays(start, 4) },
    });
  });

  it("falls back to the onboarding answer, flagged self-reported", () => {
    const start = d("2026-11-10");
    const out = presentPeriodLength(
      view([log(start, { bleeding: "menstrual", periodBoundary: "start" })], start, profileOf({ reportedTypicalPeriodDays: 4 })),
    );
    expect(out.typicalDuration).toEqual({ low: 4, high: 4, basedOnPeriods: 0, source: "self_reported" });
    expect(out.current?.expectedToContinueThrough).toEqual({ from: d("2026-11-11"), to: d("2026-11-13") });
  });

  it("is null with neither, and no current period between periods", () => {
    expect(presentPeriodLength(view([], MID_CYCLE))).toEqual({ typicalDuration: null, current: null });
    expect(presentPeriodLength(view(HISTORY, MID_CYCLE)).current).toBeNull();
  });
});

describe("presentCycleStats", () => {
  it("gives the typical length, the engine's variability sentence and the count", () => {
    const v = view(HISTORY, MID_CYCLE);
    expect(presentCycleStats(v)).toEqual({
      typicalCycleLength: { low: 28, high: 28, basedOnCycles: 5 },
      variability: v.output.stats.variabilityHeadline,
      completedCycles: 5,
    });
  });
});

describe("presentFertileWindow", () => {
  it("says the feature is off when disabled", () => {
    expect(presentFertileWindow(view(HISTORY, MID_CYCLE))).toEqual({
      enabled: false,
      message: "Fertility features are off in Settings.",
    });
  });

  it("returns ranges plus the disclaimer verbatim when enabled", () => {
    const v = view(HISTORY, MID_CYCLE, profileOf({ fertilityEnabled: true }));
    const f = v.output.fertility!;
    expect(presentFertileWindow(v)).toEqual({
      enabled: true,
      fertileWindow: { from: f.fertileLow, to: f.fertileHigh },
      ovulation: { from: f.ovulationLow, to: f.ovulationHigh },
      confidenceNote: f.confidenceNote,
      disclaimer: FERTILITY_DISCLAIMER,
    });
  });
});

describe("presentInsights", () => {
  it("passes the engine's insights through with the disclaimer verbatim", () => {
    const v = view(HISTORY, MID_CYCLE);
    expect(presentInsights(v)).toEqual({ insights: v.output.insights, disclaimer: INSIGHT_DISCLAIMER });
  });
});

describe("presentHealthNotes", () => {
  it("lists seek_urgent_care messages first, verbatim", () => {
    const v = view(HISTORY, MID_CYCLE);
    const msg = (ruleId: string, severity: HealthMessage["severity"]): HealthMessage => ({
      ruleId,
      severity,
      message: `${ruleId} message`,
      sourceName: "Source",
      sourceUrl: "https://example.org",
      sourceThreshold: "why",
      dismissible: severity !== "seek_urgent_care",
    });
    v.output.healthMessages = [msg("CYC-01", "informational"), msg("URG-01", "seek_urgent_care"), msg("HMB-01", "discuss_with_clinician")];
    expect(presentHealthNotes(v).notes.map((n) => n.ruleId)).toEqual(["URG-01", "CYC-01", "HMB-01"]);
    expect(presentHealthNotes(v).notes[0]).toEqual(v.output.healthMessages[1]);
  });
});

describe("history", () => {
  it("returns the logs inside the range, oldest first", () => {
    const v = view([...HISTORY].reverse(), MID_CYCLE);
    const out = presentHistory(v, STARTS[5], addDays(STARTS[5], 2));
    expect(out.days.map((l) => l.date)).toEqual([STARTS[5], addDays(STARTS[5], 1), addDays(STARTS[5], 2)]);
  });

  it("rejects reversed, too-long and invalid ranges", () => {
    expect(historyRangeError("2026-11-01", "2026-11-01")).toBeNull();
    expect(historyRangeError("2025-11-16", "2026-11-16")).toBeNull(); // 366 days
    expect(historyRangeError("2025-11-15", "2026-11-16")).toMatch(/at most 366 days/);
    expect(historyRangeError("2026-11-02", "2026-11-01")).toMatch(/on or after/);
    expect(historyRangeError("2026-02-30", "2026-03-01")).toMatch(/valid/);
  });
});

describe("schemas", () => {
  it("accept real dates and zones only", () => {
    expect(civilDate.safeParse("2026-02-28").success).toBe(true);
    expect(civilDate.safeParse("2026-02-30").success).toBe(false);
    expect(timeZone.safeParse("Asia/Bangkok").success).toBe(true);
    expect(timeZone.safeParse(undefined).success).toBe(true);
    expect(timeZone.safeParse("Mars/Base").success).toBe(false);
  });
});
