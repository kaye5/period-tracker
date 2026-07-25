import { describe, expect, it } from "vitest";
import { SYMPTOM_PANEL, SYMPTOM_PANEL_TIER_C } from "@/lib/engine/constants";
import { emotionalSymptomIds, physicalSymptomIds, visibleSymptomGroups } from "./symptomPanel";

describe("symptomPanel", () => {
  it("physical + emotional together cover exactly SYMPTOM_PANEL, with no overlap and nothing extra", () => {
    const combined = [...physicalSymptomIds(), ...emotionalSymptomIds()].sort();
    expect(combined).toEqual([...SYMPTOM_PANEL].sort());
    const asSet = new Set(combined);
    expect(asSet.size).toBe(combined.length); // no id appears in both groups
  });

  it("hides tier C entirely when disabled", () => {
    const groups = visibleSymptomGroups(false);
    expect(groups.tierC).toEqual([]);
    expect(groups.physical).toEqual(physicalSymptomIds());
    expect(groups.emotional).toEqual(emotionalSymptomIds());
  });

  it("exposes exactly SYMPTOM_PANEL_TIER_C when enabled", () => {
    const groups = visibleSymptomGroups(true);
    expect(groups.tierC.sort()).toEqual([...SYMPTOM_PANEL_TIER_C].sort());
  });
});
