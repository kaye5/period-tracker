import { describe, expect, it } from "vitest";
import { addDays, parseCivil, rangeInclusive, type CivilDate } from "@/lib/date/civil";
import type { DayLog, Profile } from "@/lib/domain/types";
import { classifyCycleDay, computeEverything, computeMoodsByCycleDay, MIN_CYCLES_TO_SHOW_ANYTHING } from "@/lib/engine";
import { CALIBRATION_NEUTRAL } from "@/lib/engine/performance";
import { CONFIDENCE_LABELS } from "@/lib/copy/general";
import { buildPatternData, PATTERN_NOTE } from "./patterns";

const d = (s: string) => parseCivil(s);

const PROFILE: Profile = {
  birthYear: 1995,
  state: {
    pregnant: false,
    breastfeeding: false,
    perimenopauseSelfDeclared: false,
    menopauseSelfDeclared: false,
    knownIrregular: false,
    preferNotToSay: false,
  },
  settings: {
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
  },
};

function log(date: CivilDate, extra: Partial<DayLog> = {}): DayLog {
  return { date, bleeding: "none", pain: { severity: "none" }, symptoms: [], loggedAt: date, ...extra };
}

function period(start: CivilDate, days = 5): DayLog[] {
  return Array.from({ length: days }, (_, i) =>
    log(addDays(start, i), {
      bleeding: "menstrual",
      flow: "medium",
      periodBoundary: i === 0 ? "start" : i === days - 1 ? "end" : undefined,
      // Days 1–3 of every period: "low" mood. Gives the menstrual window mood points.
      ...(i < 3 ? { mood: ["low" as const] } : {}),
    }),
  );
}

/** Five completed 28-day cycles from 2026-05-01; the sixth period starts 2026-09-18. */
const STARTS = [0, 28, 56, 84, 112, 140].map((n) => addDays(d("2026-05-01"), n));

/** Irritability at −2 in every completed cycle; −7 is nothing-to-report in the first two. */
const SYMPTOM_LOGS = STARTS.slice(1).flatMap((s, i) => [
  log(addDays(s, -2), { symptoms: ["irritability"] }),
  ...(i < 2 ? [log(addDays(s, -7), { nothingToReport: true })] : []),
]);

/** Mood −3: "irritable" in cycles 1–3; cycle 4 logs nothing-to-report only (not mood-known). */
const MOOD_LOGS = STARTS.slice(1).flatMap((s, i) =>
  i < 3 ? [log(addDays(s, -3), { mood: ["irritable"] })] : i === 3 ? [log(addDays(s, -3), { nothingToReport: true })] : [],
);

const HISTORY = [...STARTS.flatMap((s) => period(s)), ...SYMPTOM_LOGS, ...MOOD_LOGS];

function engine(dayLogs: DayLog[], today: CivilDate) {
  return computeEverything({
    dayLogs,
    profile: PROFILE,
    today,
    decisions: { excludedCycles: {}, skipPrompts: {} },
    calibration: CALIBRATION_NEUTRAL,
  });
}

const MID_CYCLE = addDays(STARTS[5], 9);

function withRange(dayLogs: DayLog[], today: CivilDate, low: string | null, high: string | null) {
  const output = engine(dayLogs, today);
  output.prediction = { ...output.prediction, low: low === null ? null : d(low), high: high === null ? null : d(high) };
  return output;
}

const find = (out: ReturnType<typeof buildPatternData>, item: string, window: string) =>
  out.patterns.find((p) => p.item === item && p.window === window);

describe("buildPatternData", () => {
  it("projects backward offsets onto the next-period range and forward offsets with o − 1", () => {
    const output = withRange(HISTORY, MID_CYCLE, "2026-12-02", "2026-12-09");
    const out = buildPatternData({ output, dayLogs: HISTORY, today: MID_CYCLE });

    const premenstrual = find(out, "irritability", "premenstrual");
    expect(premenstrual?.kind).toBe("symptom");
    expect(premenstrual?.label).toBe("Irritability");
    const m7 = premenstrual?.days.find((x) => x.offset === -7);
    expect(m7?.upcoming).toEqual({ from: "2026-11-25", to: "2026-12-02" });

    const menstrual = find(out, "low", "menstrual");
    expect(menstrual?.kind).toBe("mood");
    expect(menstrual?.label).toBe("Low");
    const p1 = menstrual?.days.find((x) => x.offset === 1);
    expect(p1).toEqual({ offset: 1, logged: 5, knownDays: 5, cycles: 5, upcoming: { from: "2026-12-02", to: "2026-12-09" } });

    expect(out.nextPeriod).toEqual({ from: "2026-12-02", to: "2026-12-09", confidence: CONFIDENCE_LABELS[output.prediction.confidence] });
    expect(out.currentPeriod).toBeNull();
    expect(out.basedOnCycles).toBe(5);
    expect(out.minimumCyclesForPatterns).toBe(MIN_CYCLES_TO_SHOW_ANYTHING);
    expect(out.note).toBe(
      "Counts from the user's own logs, not a medical prediction. Dates are ranges because the next period date is an estimate.",
    );
    expect(out.note).toBe(PATTERN_NOTE);
  });

  it("omits upcoming when there is no next-period range", () => {
    const output = withRange(HISTORY, MID_CYCLE, null, null);
    const out = buildPatternData({ output, dayLogs: HISTORY, today: MID_CYCLE });
    expect(out.nextPeriod).toBeNull();
    expect(out.patterns.length).toBeGreaterThan(0);
    for (const p of out.patterns) for (const day of p.days) expect(day).not.toHaveProperty("upcoming");
  });

  it("gives an exact currentPeriod date only for an ongoing period, today or later", () => {
    const start = STARTS[5];
    const today = addDays(start, 1); // period day 2, still open
    // Open the last period: drop days 3–5 (incl. the "end" boundary) so it is ongoing on day 2.
    const ongoing = HISTORY.filter((l) => !(l.date >= addDays(start, 2) && l.date <= addDays(start, 4)));
    const output = withRange(ongoing, today, "2026-10-14", "2026-10-20");
    const out = buildPatternData({ output, dayLogs: ongoing, today });
    expect(out.currentPeriod).toEqual({ startDate: start });

    const days = find(out, "low", "menstrual")?.days ?? [];
    expect(days.find((x) => x.offset === 1)).not.toHaveProperty("currentPeriod"); // day 1 is yesterday
    expect(days.find((x) => x.offset === 1)?.upcoming).toEqual({ from: "2026-10-14", to: "2026-10-20" });
    expect(days.find((x) => x.offset === 2)?.currentPeriod).toBe(today);
    expect(days.find((x) => x.offset === 3)?.currentPeriod).toBe(addDays(start, 2));
    expect(days.find((x) => x.offset === 3)?.upcoming).toEqual({ from: "2026-10-16", to: "2026-10-22" });
    // Backward offsets never get an exact date.
    for (const p of out.patterns) if (p.window === "premenstrual" || p.window === "mid_luteal") {
      for (const x of p.days) expect(x).not.toHaveProperty("currentPeriod");
    }

    // Not ongoing (mid-cycle): no exact dates anywhere.
    const closed = buildPatternData({ output: engine(HISTORY, MID_CYCLE), dayLogs: HISTORY, today: MID_CYCLE });
    expect(closed.currentPeriod).toBeNull();
    expect(JSON.stringify(closed)).not.toContain('"currentPeriod":"');
  });

  it("filters by items, and by minKnownDays", () => {
    const output = engine(HISTORY, MID_CYCLE);
    const out = buildPatternData({ output, dayLogs: HISTORY, today: MID_CYCLE, items: ["irritability", "irritable"] });
    expect(new Set(out.patterns.map((p) => p.item))).toEqual(new Set(["irritability", "irritable"]));

    const strict = buildPatternData({ output, dayLogs: HISTORY, today: MID_CYCLE, items: ["irritability"], minKnownDays: 3 });
    const offsets = strict.patterns.flatMap((p) => p.days.map((x) => x.offset));
    expect(offsets).toEqual([-2]); // −7 has only 2 known days
    expect(strict.patterns.every((p) => p.days.length > 0)).toBe(true);
  });

  it("symptom counts equal the engine's points, and cycles equals distinct contributing cycles", () => {
    const output = engine(HISTORY, MID_CYCLE);
    const out = buildPatternData({ output, dayLogs: HISTORY, today: MID_CYCLE });
    const flat = (kind: string) =>
      out.patterns
        .filter((p) => p.kind === kind)
        .flatMap((p) => p.days.map((x) => ({ item: p.item, window: p.window, offset: x.offset, occurrences: x.logged, knownDays: x.knownDays })));

    expect(flat("symptom")).toEqual(
      output.stats.symptomsByCycleDay.map(({ symptom, ...rest }) => ({ item: symptom, ...rest })),
    );
    expect(flat("mood")).toEqual(
      computeMoodsByCycleDay(output.cycles, HISTORY).map(({ mood, ...rest }) => ({ item: mood, ...rest })),
    );

    // Independent walk: distinct completed cycles with a symptom-known day at each (window, offset).
    const byDate = new Map(HISTORY.map((l) => [l.date, l]));
    const cyclesAt = new Map<string, Set<CivilDate>>();
    for (const c of output.cycles) {
      if (c.nextStartDate === null) continue;
      for (const date of rangeInclusive(c.startDate, addDays(c.nextStartDate, -1))) {
        const l = byDate.get(date);
        const k = l && classifyCycleDay(c, date, l.bleeding !== "none");
        if (!k || (!l.symptoms.includes("irritability") && !l.nothingToReport)) continue;
        const key = `${k.label}|${k.offset}`;
        cyclesAt.set(key, (cyclesAt.get(key) ?? new Set()).add(c.startDate));
      }
    }
    const irritability = out.patterns.filter((p) => p.item === "irritability");
    for (const p of irritability) for (const x of p.days) expect(x.cycles).toBe(cyclesAt.get(`${p.window}|${x.offset}`)?.size);
    expect(find(out, "irritability", "premenstrual")?.days.find((x) => x.offset === -2)?.cycles).toBe(5);
  });

  it("counts a day as mood-known only when a mood was logged (nothing-to-report does not count)", () => {
    const out = buildPatternData({ output: engine(HISTORY, MID_CYCLE), dayLogs: HISTORY, today: MID_CYCLE, items: ["irritable"] });
    const m3 = find(out, "irritable", "premenstrual")?.days.find((x) => x.offset === -3);
    // Cycles 1–3 logged "irritable"; cycle 4's nothing-to-report day is not mood-known.
    expect(m3).toMatchObject({ logged: 3, knownDays: 3, cycles: 3 });
  });
});
