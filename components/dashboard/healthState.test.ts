import { describe, expect, it } from "vitest";
import type { CivilDate } from "@/lib/date/civil";
import type { HealthMessageDecision } from "@/lib/repo/decisions";
import { buildHealthAwarenessState } from "./healthState";

function decision(overrides: Partial<HealthMessageDecision>): HealthMessageDecision {
  return {
    ruleId: "CTX-01",
    dismissed: false,
    snoozedUntil: null,
    decidedOn: "2026-07-01" as CivilDate,
    ...overrides,
  };
}

describe("buildHealthAwarenessState", () => {
  it("returns an empty state with no decisions", () => {
    expect(buildHealthAwarenessState([])).toEqual({
      dismissals: {},
      nonUrgentShownThisCycle: null,
    });
  });

  it("includes only dismissed decisions, keyed by ruleId", () => {
    const state = buildHealthAwarenessState([
      decision({ ruleId: "DYS-01", dismissed: true, decidedOn: "2026-07-10" as CivilDate }),
      decision({ ruleId: "IMB-01", dismissed: false }),
    ]);
    expect(state.dismissals).toEqual({
      "DYS-01": { dismissedOn: "2026-07-10" },
    });
  });

  it("never populates nonUrgentShownThisCycle — no repo route persists it yet", () => {
    const state = buildHealthAwarenessState([
      decision({ ruleId: "DYS-01", dismissed: true }),
    ]);
    expect(state.nonUrgentShownThisCycle).toBeNull();
  });

  it("ignores dismissed:false and dismissed:true mixed across multiple rules correctly", () => {
    const state = buildHealthAwarenessState([
      decision({ ruleId: "AMEN-01", dismissed: true, decidedOn: "2026-06-01" as CivilDate }),
      decision({ ruleId: "AMEN-02", dismissed: true, decidedOn: "2026-06-02" as CivilDate }),
      decision({ ruleId: "PERI-01", dismissed: false }),
    ]);
    expect(Object.keys(state.dismissals).sort()).toEqual(["AMEN-01", "AMEN-02"]);
  });
});
