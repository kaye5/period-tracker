/**
 * Real round-trip tests for lib/repo/dayLogs.ts against MySQL — proves the relational
 * mapping (day_logs + its four child tables + the inline fertility columns) is lossless
 * for a fully-populated log, and that the simpler paths (partial log, range queries, hard
 * delete) all behave per docs/DB-MIGRATION.md §3.1-3.2.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import {
  deleteAllDayLogs,
  deleteDayLog,
  getDayLog,
  listAllDayLogs,
  listDayLogs,
  upsertDayLog,
} from "@/lib/repo/dayLogs";
import type { DayLog } from "@/lib/domain/types";
import { parseCivil } from "@/lib/date/civil";
import { closeDb, describeIfDb, ensureMigrationsApplied, itIfDb, truncateAll } from "@/lib/repo/testUtils";

/** Every symptom/mood/pain-site/interference value, so the round-trip exercises every
 * row of every child table at once, not just a sample. */
const ALL_SYMPTOMS = [
  "cramps",
  "breast_tenderness",
  "bloating",
  "headache",
  "fatigue",
  "cravings",
  "gi_change",
  "acne",
  "irritability",
  "low_mood",
  "anxiety",
  "emotional_sensitivity",
  "sleep_change",
  "exercise_change",
  "focus_change",
  "libido_change",
] as const;
const ALL_MOODS = ["calm", "happy", "energetic", "irritable", "sad", "anxious", "sensitive", "low"] as const;
const ALL_PAIN_SITES = ["lower_abdomen", "back", "legs", "pelvis", "head", "other"] as const;
const ALL_INTERFERENCE = ["work_or_school", "sleep", "exercise", "social", "household"] as const;

function fullyPopulatedDayLog(date: string): DayLog {
  return {
    date: parseCivil(date),
    bleeding: "menstrual",
    flow: "very_heavy",
    bleedingContext: "period",
    periodBoundary: "start",
    clots: "ge_2_5cm",
    productChanges: 6,
    fastestProductChangeHours: 2,
    doubleProtection: true,
    nightChange: true,
    leakThrough: true,
    pain: {
      severity: "severe",
      sites: [...ALL_PAIN_SITES],
      interferedWith: [...ALL_INTERFERENCE],
      painkillerDidNotHelp: true,
    },
    symptoms: [...ALL_SYMPTOMS],
    mood: [...ALL_MOODS],
    notes: "Unicode round-trip check: café, naïve, 日本語, emoji 🩸",
    fertility: {
      cervicalMucus: "egg_white",
      ovulationPain: true,
      bbtCelsius: 36.72,
      opkResult: "positive",
    },
    loggedAt: parseCivil(date),
  };
}

function sortedIds<T>(arr: T[]): T[] {
  return [...arr].sort();
}

describeIfDb("lib/repo/dayLogs.ts (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("round-trips a fully-populated day log, including all four child tables and fertility", async () => {
    const input = fullyPopulatedDayLog("2026-03-15");

    const upserted = await upsertDayLog(input);
    expect(upserted).toEqual(input);

    const fetched = await getDayLog(input.date);
    expect(fetched).not.toBeNull();
    expect(fetched!.date).toBe(input.date);
    expect(fetched!.bleeding).toBe(input.bleeding);
    expect(fetched!.flow).toBe(input.flow);
    expect(fetched!.bleedingContext).toBe(input.bleedingContext);
    expect(fetched!.periodBoundary).toBe(input.periodBoundary);
    expect(fetched!.clots).toBe(input.clots);
    expect(fetched!.productChanges).toBe(input.productChanges);
    expect(fetched!.fastestProductChangeHours).toBe(input.fastestProductChangeHours);
    expect(fetched!.doubleProtection).toBe(input.doubleProtection);
    expect(fetched!.nightChange).toBe(input.nightChange);
    expect(fetched!.leakThrough).toBe(input.leakThrough);
    expect(fetched!.notes).toBe(input.notes);
    expect(fetched!.loggedAt).toBe(input.loggedAt);

    expect(fetched!.pain.severity).toBe(input.pain.severity);
    expect(fetched!.pain.painkillerDidNotHelp).toBe(input.pain.painkillerDidNotHelp);
    expect(sortedIds(fetched!.pain.sites ?? [])).toEqual(sortedIds(input.pain.sites!));
    expect(sortedIds(fetched!.pain.interferedWith ?? [])).toEqual(sortedIds(input.pain.interferedWith!));

    expect(sortedIds(fetched!.symptoms)).toEqual(sortedIds(input.symptoms));
    expect(sortedIds(fetched!.mood ?? [])).toEqual(sortedIds(input.mood!));

    expect(fetched!.fertility).toBeDefined();
    expect(fetched!.fertility).toEqual(input.fertility);

    // Full deep-equal too, once set-ordering is normalized — the two checks together
    // guard against both "a field silently changed value" and "the deep-equal only
    // passed because array order happened to match this run".
    expect({
      ...fetched,
      symptoms: sortedIds(fetched!.symptoms),
      mood: sortedIds(fetched!.mood ?? []),
      pain: {
        ...fetched!.pain,
        sites: sortedIds(fetched!.pain.sites ?? []),
        interferedWith: sortedIds(fetched!.pain.interferedWith ?? []),
      },
    }).toEqual({
      ...input,
      symptoms: sortedIds(input.symptoms),
      mood: sortedIds(input.mood!),
      pain: {
        ...input.pain,
        sites: sortedIds(input.pain.sites!),
        interferedWith: sortedIds(input.pain.interferedWith!),
      },
    });
  });

  itIfDb("reconstructs fertility as undefined, not {}, when every fertility field is absent", async () => {
    const date = parseCivil("2026-03-16");
    const input: DayLog = {
      date,
      bleeding: "none",
      pain: { severity: "none" },
      symptoms: [],
      loggedAt: date,
    };
    await upsertDayLog(input);
    const fetched = await getDayLog(date);
    expect(fetched!.fertility).toBeUndefined();
  });

  itIfDb("optional booleans round-trip as undefined (never false) when never set", async () => {
    const date = parseCivil("2026-03-17");
    const input: DayLog = {
      date,
      bleeding: "spotting",
      flow: "spotting",
      pain: { severity: "none" },
      symptoms: [],
      loggedAt: date,
    };
    await upsertDayLog(input);
    const fetched = await getDayLog(date);
    expect(fetched!.doubleProtection).toBeUndefined();
    expect(fetched!.nightChange).toBeUndefined();
    expect(fetched!.leakThrough).toBeUndefined();
    expect(fetched!.nothingToReport).toBeUndefined();
    expect(fetched!.pain.painkillerDidNotHelp).toBeUndefined();
    expect(fetched!.symptoms).toEqual([]);
  });

  itIfDb("upsert fully replaces child rows (a symptom removed on re-save must not reappear)", async () => {
    const date = parseCivil("2026-03-18");
    const first: DayLog = {
      date,
      bleeding: "none",
      pain: { severity: "mild", sites: ["back", "head"] },
      symptoms: ["cramps", "bloating", "headache"],
      mood: ["calm", "low"],
      loggedAt: date,
    };
    await upsertDayLog(first);

    const second: DayLog = {
      date,
      bleeding: "none",
      pain: { severity: "none", sites: ["legs"] },
      symptoms: ["fatigue"],
      mood: [],
      loggedAt: date,
    };
    await upsertDayLog(second);

    const fetched = await getDayLog(date);
    expect(fetched!.symptoms).toEqual(["fatigue"]);
    expect(fetched!.pain.sites).toEqual(["legs"]);
    expect(fetched!.mood ?? []).toEqual([]);
  });

  itIfDb("getDayLog returns null for a date never logged", async () => {
    const result = await getDayLog(parseCivil("2026-01-01"));
    expect(result).toBeNull();
  });

  itIfDb("listDayLogs sorts chronologically and respects an inclusive date range", async () => {
    const dates = ["2026-01-05", "2026-01-01", "2026-01-10", "2026-01-15"];
    for (const d of dates) {
      const date = parseCivil(d);
      await upsertDayLog({
        date,
        bleeding: "none",
        pain: { severity: "none" },
        symptoms: [],
        loggedAt: date,
      });
    }

    const all = await listAllDayLogs();
    expect(all.map((l) => l.date)).toEqual(["2026-01-01", "2026-01-05", "2026-01-10", "2026-01-15"]);

    const ranged = await listDayLogs({ from: parseCivil("2026-01-02"), to: parseCivil("2026-01-10") });
    expect(ranged.map((l) => l.date)).toEqual(["2026-01-05", "2026-01-10"]);
  });

  itIfDb("deleteDayLog hard-deletes and cascades child rows", async () => {
    const date = parseCivil("2026-02-01");
    await upsertDayLog({
      date,
      bleeding: "menstrual",
      flow: "medium",
      pain: { severity: "mild", sites: ["back"] },
      symptoms: ["cramps"],
      mood: ["calm"],
      loggedAt: date,
    });

    const deleted = await deleteDayLog(date);
    expect(deleted).toBe(true);
    expect(await getDayLog(date)).toBeNull();

    const deletedAgain = await deleteDayLog(date);
    expect(deletedAgain).toBe(false);
  });

  itIfDb("deleteAllDayLogs empties the table and returns the count removed", async () => {
    for (const d of ["2026-04-01", "2026-04-02", "2026-04-03"]) {
      const date = parseCivil(d);
      await upsertDayLog({
        date,
        bleeding: "none",
        pain: { severity: "none" },
        symptoms: [],
        loggedAt: date,
      });
    }
    const removed = await deleteAllDayLogs();
    expect(removed).toBe(3);
    expect(await listAllDayLogs()).toEqual([]);
  });
});
