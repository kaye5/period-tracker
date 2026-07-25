import { describe, expect, it } from "vitest";
import type { CivilDate } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import {
  EMPTY_FORM_STATE,
  buildDayLogPayload,
  initialFormState,
  mergeSymptomGroup,
  nothingToReportPayload,
  patchFertilityField,
  toggleMember,
} from "./dayLogFormState";

const DATE = "2026-07-23" as CivilDate;
const TODAY = "2026-07-23" as CivilDate;
const YESTERDAY = "2026-07-22" as CivilDate;

describe("initialFormState", () => {
  it("returns the blank slate for a day with no existing log", () => {
    expect(initialFormState(null)).toEqual(EMPTY_FORM_STATE);
    expect(initialFormState(undefined)).toEqual(EMPTY_FORM_STATE);
  });

  it("round-trips every field of an existing DayLog without dropping any of them", () => {
    const existing: DayLog = {
      date: DATE,
      bleeding: "menstrual",
      flow: "heavy",
      bleedingContext: "period",
      periodBoundary: "start",
      clots: "ge_2_5cm",
      productChanges: 5,
      fastestProductChangeHours: 1,
      doubleProtection: true,
      nightChange: true,
      leakThrough: false,
      pain: {
        severity: "severe",
        sites: ["lower_abdomen", "back"],
        interferedWith: ["work_or_school"],
        painkillerDidNotHelp: true,
      },
      symptoms: ["cramps", "bloating"],
      nothingToReport: false,
      mood: ["irritable"],
      notes: "felt awful",
      fertility: { cervicalMucus: "egg_white", ovulationPain: true },
      loggedAt: YESTERDAY,
    };

    const state = initialFormState(existing);

    expect(state.bleeding).toBe("menstrual");
    expect(state.flow).toBe("heavy");
    expect(state.bleedingContext).toBe("period");
    expect(state.periodBoundary).toBe("start");
    expect(state.clots).toBe("ge_2_5cm");
    expect(state.productChanges).toBe(5);
    expect(state.fastestProductChangeHours).toBe(1);
    expect(state.doubleProtection).toBe(true);
    expect(state.nightChange).toBe(true);
    expect(state.leakThrough).toBe(false);
    expect(state.painSeverity).toBe("severe");
    expect(state.painSites).toEqual(["lower_abdomen", "back"]);
    expect(state.interferedWith).toEqual(["work_or_school"]);
    expect(state.painkillerDidNotHelp).toBe(true);
    expect(state.symptoms).toEqual(["cramps", "bloating"]);
    expect(state.mood).toEqual(["irritable"]);
    expect(state.notes).toBe("felt awful");
    expect(state.fertility).toEqual({ cervicalMucus: "egg_white", ovulationPain: true });
  });

  it("defaults optional booleans to false and optional arrays to empty, never undefined", () => {
    const minimal: DayLog = {
      date: DATE,
      bleeding: "none",
      pain: { severity: "none" },
      symptoms: [],
      loggedAt: DATE,
    };
    const state = initialFormState(minimal);
    expect(state.doubleProtection).toBe(false);
    expect(state.nightChange).toBe(false);
    expect(state.leakThrough).toBe(false);
    expect(state.painSites).toEqual([]);
    expect(state.interferedWith).toEqual([]);
    expect(state.mood).toEqual([]);
    expect(state.notes).toBe("");
    expect(state.fertility).toEqual({});
  });
});

describe("buildDayLogPayload", () => {
  it("uses `today` as loggedAt for a brand-new entry", () => {
    const payload = buildDayLogPayload(DATE, TODAY, EMPTY_FORM_STATE, false);
    expect(payload.loggedAt).toBe(TODAY);
    expect(payload.date).toBe(DATE);
  });

  it("preserves the original loggedAt when editing an existing entry (back-entry signal survives an edit)", () => {
    const payload = buildDayLogPayload(DATE, TODAY, EMPTY_FORM_STATE, false, YESTERDAY);
    expect(payload.loggedAt).toBe(YESTERDAY);
  });

  it("omits every optional field the form has no value for, rather than sending nulls", () => {
    const payload = buildDayLogPayload(DATE, TODAY, EMPTY_FORM_STATE, false);
    expect(payload).not.toHaveProperty("flow");
    expect(payload).not.toHaveProperty("bleedingContext");
    expect(payload).not.toHaveProperty("periodBoundary");
    expect(payload).not.toHaveProperty("clots");
    expect(payload).not.toHaveProperty("productChanges");
    expect(payload).not.toHaveProperty("fastestProductChangeHours");
    expect(payload).not.toHaveProperty("doubleProtection");
    expect(payload).not.toHaveProperty("nightChange");
    expect(payload).not.toHaveProperty("leakThrough");
    expect(payload).not.toHaveProperty("mood");
    expect(payload).not.toHaveProperty("notes");
    expect(payload).not.toHaveProperty("fertility");
    expect(payload.pain.sites).toBeUndefined();
    expect(payload.pain.interferedWith).toBeUndefined();
    expect(payload.pain.painkillerDidNotHelp).toBeUndefined();
  });

  it("never includes fertility data when fertility is disabled, even if the draft has some", () => {
    const state = { ...EMPTY_FORM_STATE, fertility: { ovulationPain: true } };
    const payload = buildDayLogPayload(DATE, TODAY, state, false);
    expect(payload).not.toHaveProperty("fertility");
  });

  it("includes fertility data when enabled and the draft has some", () => {
    const state = { ...EMPTY_FORM_STATE, fertility: { ovulationPain: true } };
    const payload = buildDayLogPayload(DATE, TODAY, state, true);
    expect(payload.fertility).toEqual({ ovulationPain: true });
  });

  it("builds a complete, save-ready period entry from just the bleeding kind — the quick-log path", () => {
    // This is the exact state the 3-tap quick-log flow produces: tap "Period today"
    // (sets bleeding), tap Save. No flow level, no other field required.
    const state = { ...EMPTY_FORM_STATE, bleeding: "menstrual" as const };
    const payload = buildDayLogPayload(DATE, TODAY, state, false);
    expect(payload.bleeding).toBe("menstrual");
    expect(payload.pain.severity).toBe("none");
    expect(payload.symptoms).toEqual([]);
    expect(payload).not.toHaveProperty("flow");
  });
});

describe("nothingToReportPayload", () => {
  it("always encodes exactly the true-negative shape, regardless of what else is going on", () => {
    const payload = nothingToReportPayload(DATE, TODAY);
    expect(payload).toEqual({
      date: DATE,
      bleeding: "none",
      pain: { severity: "none" },
      symptoms: [],
      nothingToReport: true,
      loggedAt: TODAY,
    });
  });

  it("preserves the original loggedAt when overwriting an existing entry", () => {
    const payload = nothingToReportPayload(DATE, TODAY, YESTERDAY);
    expect(payload.loggedAt).toBe(YESTERDAY);
  });
});

describe("toggleMember", () => {
  it("adds a missing member and removes a present one", () => {
    expect(toggleMember(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleMember(["a", "b"], "a")).toEqual(["b"]);
  });

  it("never mutates the input array", () => {
    const input = ["a"];
    toggleMember(input, "b");
    expect(input).toEqual(["a"]);
  });
});

describe("mergeSymptomGroup", () => {
  it("replaces only the given group's members, leaving symptoms from other groups intact", () => {
    const current: ("cramps" | "irritability" | "bloating")[] = ["cramps", "irritability"];
    const result = mergeSymptomGroup(current, ["cramps", "bloating"], ["bloating"]);
    // "cramps" (in the physical group but deselected) is gone, "irritability" (a
    // different group entirely) survives untouched, "bloating" (newly selected) appears.
    expect(result.sort()).toEqual(["bloating", "irritability"].sort());
  });
});

describe("patchFertilityField", () => {
  it("sets a field", () => {
    expect(patchFertilityField({}, "ovulationPain", true)).toEqual({ ovulationPain: true });
  });

  it("removes the key entirely when set to undefined, rather than leaving it present-but-undefined", () => {
    const result = patchFertilityField({ ovulationPain: true, bbtCelsius: 36.5 }, "ovulationPain", undefined);
    expect(result).toEqual({ bbtCelsius: 36.5 });
    expect(Object.keys(result)).not.toContain("ovulationPain");
  });

  it("does not mutate the input object", () => {
    const input = { ovulationPain: true };
    patchFertilityField(input, "ovulationPain", undefined);
    expect(input).toEqual({ ovulationPain: true });
  });
});
