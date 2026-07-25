import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import { fromRows, toRows, type DayLogRow } from "@/lib/repo/dayLogs.mapping";

function makeMinimalLog(overrides: Partial<DayLog> = {}): DayLog {
  return {
    date: parseCivil("2026-03-10"),
    bleeding: "menstrual",
    flow: "medium",
    pain: { severity: "mild" },
    symptoms: [],
    loggedAt: parseCivil("2026-03-10"),
    ...overrides,
  };
}

function makeFullyPopulatedLog(overrides: Partial<DayLog> = {}): DayLog {
  return {
    date: parseCivil("2026-04-02"),
    bleeding: "menstrual",
    flow: "heavy",
    bleedingContext: "period",
    periodBoundary: "start",
    clots: "small",
    productChanges: 5,
    fastestProductChangeHours: 2,
    doubleProtection: true,
    nightChange: false,
    leakThrough: true,
    pain: {
      severity: "severe",
      sites: ["lower_abdomen", "back"],
      interferedWith: ["work_or_school", "sleep"],
      painkillerDidNotHelp: true,
    },
    symptoms: ["cramps", "headache", "fatigue"],
    nothingToReport: false,
    mood: ["irritable", "low"],
    notes: "rough day",
    fertility: {
      cervicalMucus: "egg_white",
      ovulationPain: true,
      bbtCelsius: 36.72,
      opkResult: "positive",
    },
    loggedAt: parseCivil("2026-04-03"),
    ...overrides,
  };
}

/** Reconstructs the `{ symptoms, moods, painSites, interference }` shape `fromRows`
 * expects, from a `toRows` result — the two functions' natural round trip. */
function roundTrip(log: DayLog): DayLog {
  const { row, symptoms, moods, painSites, interference } = toRows(log);
  return fromRows(row, { symptoms, moods, painSites, interference });
}

describe("lib/repo/dayLogs.mapping", () => {
  describe("toRows", () => {
    it("validates and rejects an invalid DayLog before producing any rows", () => {
      const bad = { ...makeMinimalLog(), bleeding: "not-a-real-value" } as unknown as DayLog;
      expect(() => toRows(bad)).toThrow();
    });

    it("carries date and loggedAt through as plain YYYY-MM-DD strings, not Date objects", () => {
      const { row } = toRows(makeFullyPopulatedLog());
      expect(row.date).toBe("2026-04-02");
      expect(row.loggedAt).toBe("2026-04-03");
      expect(typeof row.date).toBe("string");
      expect(typeof row.loggedAt).toBe("string");
    });

    it("maps a minimal log's absent optional fields to null on the row, not undefined", () => {
      const { row } = toRows(makeMinimalLog());
      expect(row.bleedingContext).toBeNull();
      expect(row.periodBoundary).toBeNull();
      expect(row.clots).toBeNull();
      expect(row.productChanges).toBeNull();
      expect(row.fastestProductChangeHours).toBeNull();
      expect(row.doubleProtection).toBeNull();
      expect(row.nightChange).toBeNull();
      expect(row.leakThrough).toBeNull();
      expect(row.painkillerDidNotHelp).toBeNull();
      expect(row.nothingToReport).toBeNull();
      expect(row.notes).toBeNull();
      expect(row.fertilityCervicalMucus).toBeNull();
      expect(row.fertilityOvulationPain).toBeNull();
      expect(row.fertilityBbtCelsius).toBeNull();
      expect(row.fertilityOpkResult).toBeNull();
    });

    it("splits the four set-valued fields into their own arrays, empty when absent", () => {
      const { symptoms, moods, painSites, interference } = toRows(makeMinimalLog());
      expect(symptoms).toEqual([]);
      expect(moods).toEqual([]);
      expect(painSites).toEqual([]);
      expect(interference).toEqual([]);
    });

    it("carries a fully populated log's four set-valued fields through intact", () => {
      const { symptoms, moods, painSites, interference } = toRows(makeFullyPopulatedLog());
      expect(symptoms).toEqual(["cramps", "headache", "fatigue"]);
      expect(moods).toEqual(["irritable", "low"]);
      expect(painSites).toEqual(["lower_abdomen", "back"]);
      expect(interference).toEqual(["work_or_school", "sleep"]);
    });

    it("stringifies fastestProductChangeHours and bbtCelsius for the decimal columns", () => {
      const { row } = toRows(makeFullyPopulatedLog());
      expect(row.fastestProductChangeHours).toBe("2");
      expect(row.fertilityBbtCelsius).toBe("36.72");
    });

    it("preserves a real `false` optional boolean as false, not null", () => {
      const { row } = toRows(makeFullyPopulatedLog({ nightChange: false, nothingToReport: false }));
      expect(row.nightChange).toBe(false);
      expect(row.nothingToReport).toBe(false);
    });
  });

  describe("fromRows", () => {
    it("maps null row columns to undefined optional fields, never false", () => {
      const { row } = toRows(makeMinimalLog());
      const log = fromRows(row, { symptoms: [], moods: [], painSites: [], interference: [] });
      expect(log.doubleProtection).toBeUndefined();
      expect(log.nightChange).toBeUndefined();
      expect(log.leakThrough).toBeUndefined();
      expect(log.pain.painkillerDidNotHelp).toBeUndefined();
      expect(log.nothingToReport).toBeUndefined();
      expect(log.doubleProtection).not.toBe(false);
      expect(log.nightChange).not.toBe(false);
    });

    it("round-trips a real `false` optional boolean as false, not undefined", () => {
      const log = roundTrip(makeFullyPopulatedLog({ nightChange: false, nothingToReport: false }));
      expect(log.nightChange).toBe(false);
      expect(log.nothingToReport).toBe(false);
    });

    it("omits pain.sites/interferedWith and mood (undefined, not []) when there are no child rows", () => {
      const { row } = toRows(makeMinimalLog());
      const log = fromRows(row, { symptoms: [], moods: [], painSites: [], interference: [] });
      expect(log.pain.sites).toBeUndefined();
      expect(log.pain.interferedWith).toBeUndefined();
      expect(log.mood).toBeUndefined();
    });

    it("always returns symptoms as an array (required field), even when empty", () => {
      const { row } = toRows(makeMinimalLog());
      const log = fromRows(row, { symptoms: [], moods: [], painSites: [], interference: [] });
      expect(log.symptoms).toEqual([]);
    });

    it("reconstructs fertility as undefined when every fertility column is null", () => {
      const { row } = toRows(makeMinimalLog());
      const log = fromRows(row, { symptoms: [], moods: [], painSites: [], interference: [] });
      expect(log.fertility).toBeUndefined();
    });

    it("reconstructs fertility when exactly one fertility column is non-null", () => {
      const { row } = toRows(makeMinimalLog({ fertility: { ovulationPain: true } }));
      const log = fromRows(row, { symptoms: [], moods: [], painSites: [], interference: [] });
      expect(log.fertility).toEqual({ ovulationPain: true });
    });

    it("parses fastestProductChangeHours and bbtCelsius back to numbers", () => {
      const row: DayLogRow = {
        ...toRows(makeMinimalLog()).row,
        fastestProductChangeHours: "0.5",
        fertilityBbtCelsius: "36.50",
        fertilityOpkResult: "negative",
      };
      const log = fromRows(row, { symptoms: [], moods: [], painSites: [], interference: [] });
      expect(log.fastestProductChangeHours).toBe(0.5);
      expect(typeof log.fastestProductChangeHours).toBe("number");
      expect(log.fertility?.bbtCelsius).toBe(36.5);
      expect(typeof log.fertility?.bbtCelsius).toBe("number");
    });

    it("returns date and loggedAt as YYYY-MM-DD strings", () => {
      const log = roundTrip(makeFullyPopulatedLog());
      expect(log.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(log.loggedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("round trip (toRows then fromRows)", () => {
    it("round-trips a minimal DayLog exactly", () => {
      const log = makeMinimalLog();
      expect(roundTrip(log)).toEqual(log);
    });

    it("round-trips a fully populated DayLog exactly", () => {
      const log = makeFullyPopulatedLog();
      expect(roundTrip(log)).toEqual(log);
    });

    it("round-trips distinct dates for `date` vs `loggedAt` (back-entry detection, S17)", () => {
      const log = makeMinimalLog({ date: parseCivil("2026-03-10"), loggedAt: parseCivil("2026-03-15") });
      const result = roundTrip(log);
      expect(result.date).toBe("2026-03-10");
      expect(result.loggedAt).toBe("2026-03-15");
    });

    it("round-trips notes, including absence", () => {
      expect(roundTrip(makeMinimalLog({ notes: "back entry from memory" })).notes).toBe(
        "back entry from memory",
      );
      expect(roundTrip(makeMinimalLog({ notes: undefined })).notes).toBeUndefined();
    });

    it("collapses an explicitly empty set-valued field to undefined/[] on the way back out — a documented lossy boundary, not a bug", () => {
      // The relational schema has no on-disk way to distinguish "explicitly logged as
      // empty" from "never touched": both are zero rows in the child table.
      const log = makeMinimalLog({ pain: { severity: "mild", sites: [], interferedWith: [] }, mood: [] });
      const result = roundTrip(log);
      expect(result.pain.sites).toBeUndefined();
      expect(result.pain.interferedWith).toBeUndefined();
      expect(result.mood).toBeUndefined();
      // symptoms is required, so it stays [] rather than becoming undefined.
      expect(result.symptoms).toEqual([]);
    });

    it("round-trips every SymptomId, MoodId, PainSite and Interference value used together", () => {
      const log = makeMinimalLog({
        symptoms: [
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
        ],
        mood: ["calm", "happy", "energetic", "irritable", "sad", "anxious", "sensitive", "low"],
        pain: {
          severity: "moderate",
          sites: ["lower_abdomen", "back", "legs", "pelvis", "head", "other"],
          interferedWith: ["work_or_school", "sleep", "exercise", "social", "household"],
        },
      });
      expect(roundTrip(log)).toEqual(log);
    });

    it("rejects an invalid reconstructed row at the read boundary", () => {
      const { row } = toRows(makeMinimalLog());
      const badRow: DayLogRow = { ...row, bleeding: "not-a-real-value" as DayLogRow["bleeding"] };
      expect(() => fromRows(badRow, { symptoms: [], moods: [], painSites: [], interference: [] })).toThrow();
    });
  });
});
