import { describe, expect, it } from "vitest";
import type { Insight } from "@/lib/domain/types";
import { selectPersonalPatternInsight } from "./insightSelection";

function stubInsight(id: string): Insight {
  return {
    id,
    headline: `headline:${id}`,
    body: `body:${id}`,
    detail: `detail:${id}`,
    supportingCycles: 3,
    supportingDates: [],
    replicatedLastCycle: false,
    kind: "symptom",
  };
}

describe("selectPersonalPatternInsight", () => {
  it("returns null primary and empty secondary for an empty list", () => {
    expect(selectPersonalPatternInsight([])).toEqual({ primary: null, secondary: [] });
  });

  it("picks the first insight as primary and keeps the engine's order for the rest", () => {
    const insights = [stubInsight("a"), stubInsight("b"), stubInsight("c")];
    const result = selectPersonalPatternInsight(insights);
    expect(result.primary?.id).toBe("a");
    expect(result.secondary.map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("secondary is empty when there is exactly one insight", () => {
    const result = selectPersonalPatternInsight([stubInsight("only")]);
    expect(result.primary?.id).toBe("only");
    expect(result.secondary).toEqual([]);
  });
});
