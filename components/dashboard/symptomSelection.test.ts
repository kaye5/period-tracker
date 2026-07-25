import { describe, expect, it } from "vitest";
import type { SymptomFrequency } from "@/lib/engine";
import { selectTopSymptoms } from "./symptomSelection";

function freq(overrides: Partial<SymptomFrequency>): SymptomFrequency {
  return {
    symptom: "cramps",
    occurrences: 0,
    cyclesWithOccurrence: 0,
    knownDays: 0,
    cyclesConsidered: 0,
    ...overrides,
  };
}

describe("selectTopSymptoms", () => {
  it("drops symptoms with zero known days", () => {
    const result = selectTopSymptoms([
      freq({ symptom: "cramps", occurrences: 3, knownDays: 10 }),
      freq({ symptom: "acne", occurrences: 0, knownDays: 0 }),
    ]);
    expect(result.map((r) => r.symptom)).toEqual(["cramps"]);
  });

  it("sorts by occurrences descending", () => {
    const result = selectTopSymptoms([
      freq({ symptom: "headache", occurrences: 2, knownDays: 10 }),
      freq({ symptom: "cramps", occurrences: 5, knownDays: 10 }),
      freq({ symptom: "bloating", occurrences: 3, knownDays: 10 }),
    ]);
    expect(result.map((r) => r.symptom)).toEqual(["cramps", "bloating", "headache"]);
  });

  it("breaks ties by symptom id for a stable order", () => {
    const result = selectTopSymptoms([
      freq({ symptom: "headache", occurrences: 4, knownDays: 10 }),
      freq({ symptom: "acne", occurrences: 4, knownDays: 10 }),
    ]);
    expect(result.map((r) => r.symptom)).toEqual(["acne", "headache"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      freq({ symptom: "cramps", occurrences: 10 - i, knownDays: 10 }),
    );
    expect(selectTopSymptoms(many, 3)).toHaveLength(3);
  });

  it("defaults to a limit of 6", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      freq({ symptom: (["cramps", "acne", "bloating", "headache", "fatigue", "cravings", "gi_change", "irritability", "low_mood", "anxiety"] as const)[i], occurrences: 10 - i, knownDays: 10 }),
    );
    expect(selectTopSymptoms(many)).toHaveLength(6);
  });

  it("returns an empty array when given no frequencies", () => {
    expect(selectTopSymptoms([])).toEqual([]);
  });
});
