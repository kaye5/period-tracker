import { describe, expect, it } from "vitest";
import { parseCivil, type CivilDate } from "@/lib/date/civil";
import type { Cycle, DayLog, Settings } from "@/lib/domain/types";
import { computeEverything } from "@/lib/engine";
import { CALIBRATION_NEUTRAL } from "@/lib/engine/performance";
import { FUTURE_DATE, NO_OPEN_PERIOD, planWrite, type WriteContext } from "./writePlan";

const d = (s: string) => parseCivil(s);
const TODAY = d("2026-11-16");

function log(date: CivilDate, extra: Partial<DayLog> = {}): DayLog {
  return { date, bleeding: "none", pain: { severity: "none" }, symptoms: [], loggedAt: date, ...extra };
}

const SETTINGS = { tierCSymptomsEnabled: false } as Settings;

/** Cycles from the real engine, so `quickPeriodStatus` sees what the app sees. */
function cyclesOf(dayLogs: DayLog[]): Cycle[] {
  return computeEverything({
    dayLogs,
    profile: {
      birthYear: 1995,
      state: {
        pregnant: false,
        breastfeeding: false,
        perimenopauseSelfDeclared: false,
        menopauseSelfDeclared: false,
        knownIrregular: false,
        preferNotToSay: false,
      },
      settings: SETTINGS,
    },
    today: TODAY,
    decisions: { excludedCycles: {}, skipPrompts: {} },
    calibration: CALIBRATION_NEUTRAL,
  }).cycles;
}

function ctx(dayLogs: DayLog[] = [], settings: Settings = SETTINGS): WriteContext {
  return {
    today: TODAY,
    logsByDate: new Map(dayLogs.map((l) => [l.date, l])),
    cycles: cyclesOf(dayLogs),
    settings,
  };
}

function ok(plan: ReturnType<typeof planWrite>) {
  if (!plan.ok) throw new Error(`expected a plan, got: ${plan.error}`);
  return plan;
}

describe("planWrite — dates", () => {
  it("defaults to today", () => {
    expect(ok(planWrite(ctx(), { tool: "log_period_start" })).date).toBe(TODAY);
  });

  it("refuses a future date and an invalid one", () => {
    expect(planWrite(ctx(), { tool: "log_mood", moods: ["calm"], date: "2026-11-17" })).toEqual({
      ok: false,
      error: FUTURE_DATE,
    });
    expect(planWrite(ctx(), { tool: "log_mood", moods: ["calm"], date: "2026-02-30" }).ok).toBe(false);
  });

  it("accepts a past date", () => {
    expect(ok(planWrite(ctx(), { tool: "log_spotting", date: "2026-11-10" })).date).toBe("2026-11-10");
  });
});

describe("planWrite — period", () => {
  it("log_period_start makes a period start day, same as Today's button", () => {
    const plan = ok(planWrite(ctx(), { tool: "log_period_start" }));
    expect(plan.dayLog).toEqual({
      date: TODAY,
      bleeding: "menstrual",
      pain: { severity: "none" },
      symptoms: [],
      loggedAt: TODAY,
      nothingToReport: undefined,
      periodBoundary: "start",
    });
    expect(plan.changed).toBe(true);
  });

  it("log_period_day sets flow when given and keeps existing fields", () => {
    const existing = log(TODAY, { mood: ["calm"], symptoms: ["cramps"], notes: "n", loggedAt: d("2026-11-15") });
    const plan = ok(planWrite(ctx([existing]), { tool: "log_period_day", flow: "heavy" }));
    expect(plan.dayLog).toMatchObject({
      bleeding: "menstrual",
      flow: "heavy",
      mood: ["calm"],
      symptoms: ["cramps"],
      notes: "n",
      loggedAt: "2026-11-15",
    });
  });

  it("log_period_end without a date ends today when today is a period day", () => {
    const logs = [log(d("2026-11-14"), { bleeding: "menstrual", periodBoundary: "start" }), log(TODAY, { bleeding: "menstrual" })];
    const plan = ok(planWrite(ctx(logs), { tool: "log_period_end" }));
    expect(plan.date).toBe(TODAY);
    expect(plan.dayLog).toMatchObject({ bleeding: "menstrual", periodBoundary: "end" });
  });

  it("log_period_end without a date ends the last recorded day of the open period", () => {
    const logs = [
      log(d("2026-11-13"), { bleeding: "menstrual", periodBoundary: "start" }),
      log(d("2026-11-14"), { bleeding: "menstrual", flow: "light" }),
    ];
    const plan = ok(planWrite(ctx(logs), { tool: "log_period_end" }));
    expect(plan.date).toBe("2026-11-14");
    expect(plan.dayLog).toMatchObject({ bleeding: "menstrual", flow: "light", periodBoundary: "end" });
  });

  it("log_period_end without a date and no open period is refused", () => {
    expect(planWrite(ctx(), { tool: "log_period_end" })).toEqual({ ok: false, error: NO_OPEN_PERIOD });
  });

  it("log_period_end with a date marks that day", () => {
    const plan = ok(planWrite(ctx(), { tool: "log_period_end", date: "2026-11-12" }));
    expect(plan.dayLog).toMatchObject({ date: "2026-11-12", bleeding: "menstrual", periodBoundary: "end" });
  });
});

describe("planWrite — spotting", () => {
  it("turns a period day into spotting and says so", () => {
    const existing = log(TODAY, { bleeding: "menstrual", flow: "heavy", periodBoundary: "start", mood: ["sad"] });
    const plan = ok(planWrite(ctx([existing]), { tool: "log_spotting" }));
    expect(plan.dayLog).toMatchObject({ bleeding: "spotting", flow: undefined, periodBoundary: undefined, mood: ["sad"] });
    expect(plan.changedFromPeriod).toBe(true);
  });

  it("does not claim a change from period on a plain day", () => {
    expect(ok(planWrite(ctx(), { tool: "log_spotting" })).changedFromPeriod).toBe(false);
  });
});

describe("planWrite — mood and symptoms", () => {
  it("adds moods, and adding them again changes nothing (no toggle)", () => {
    const first = ok(planWrite(ctx(), { tool: "log_mood", moods: ["calm", "happy"] }));
    expect(first.dayLog.mood).toEqual(["calm", "happy"]);
    expect(first.changed).toBe(true);
    const second = ok(planWrite(ctx([first.dayLog]), { tool: "log_mood", moods: ["calm", "happy"] }));
    expect(second.dayLog.mood).toEqual(["calm", "happy"]);
    expect(second.changed).toBe(false);
  });

  it("removes only the named moods", () => {
    const existing = log(TODAY, { mood: ["calm", "sad"], symptoms: ["acne"] });
    const plan = ok(planWrite(ctx([existing]), { tool: "log_mood", moods: ["sad"], mode: "remove" }));
    expect(plan.dayLog).toMatchObject({ mood: ["calm"], symptoms: ["acne"] });
  });

  it("removing from a day with no log changes nothing", () => {
    const plan = ok(planWrite(ctx(), { tool: "log_symptoms", symptoms: ["cramps"], mode: "remove" }));
    expect(plan.changed).toBe(false);
  });

  it("adds symptoms and keeps existing fields", () => {
    const existing = log(TODAY, { bleeding: "menstrual", flow: "medium", symptoms: ["acne"] });
    const plan = ok(planWrite(ctx([existing]), { tool: "log_symptoms", symptoms: ["cramps", "headache"] }));
    expect(plan.dayLog).toMatchObject({ bleeding: "menstrual", flow: "medium", symptoms: ["acne", "cramps", "headache"] });
  });

  it("refuses Tier C symptoms unless enabled, naming them", () => {
    const refused = planWrite(ctx(), { tool: "log_symptoms", symptoms: ["cramps", "sleep_change", "libido_change"] });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/sleep changes, libido changes/);
    const enabled = { ...SETTINGS, tierCSymptomsEnabled: true };
    expect(ok(planWrite(ctx([], enabled), { tool: "log_symptoms", symptoms: ["sleep_change"] })).dayLog.symptoms).toEqual([
      "sleep_change",
    ]);
  });
});

describe("planWrite — nothing to report", () => {
  it("records a true negative on an empty day", () => {
    const plan = ok(planWrite(ctx(), { tool: "log_nothing_to_report" }));
    expect(plan.dayLog).toMatchObject({ nothingToReport: true, bleeding: "none", symptoms: [] });
  });

  it("refuses when the day already has data", () => {
    const plan = planWrite(ctx([log(TODAY, { mood: ["calm"] })]), { tool: "log_nothing_to_report" });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toMatch(/log_mood/);
  });

  it("allows an existing empty log, and is a no-op on a nothing-to-report day", () => {
    expect(ok(planWrite(ctx([log(TODAY)]), { tool: "log_nothing_to_report" })).changed).toBe(true);
    const already = log(TODAY, { nothingToReport: true });
    expect(ok(planWrite(ctx([already]), { tool: "log_nothing_to_report" })).changed).toBe(false);
  });
});

