import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import { DEFAULT_USER_DECISIONS } from "@/lib/repo/decisions";
import {
  excludedCyclesFromRows,
  fromExcludedCycleRow,
  fromHealthMessageDecisionRow,
  fromSkipPromptRow,
  healthMessageDecisionSchema,
  skipPromptsFromRows,
  toExcludedCycleRow,
  toHealthMessageDecisionRow,
  toSkipPromptRow,
  userDecisionsFromRows,
  type HealthMessageDecision,
} from "@/lib/repo/decisions.mapping";

describe("lib/repo/decisions.mapping — excluded_cycles", () => {
  it("round-trips a single row", () => {
    const row = toExcludedCycleRow(parseCivil("2026-01-01"), {
      reason: "duplicate log entry",
      decidedOn: parseCivil("2026-01-05"),
    });
    expect(row).toEqual({
      cycleStartDate: "2026-01-01",
      reason: "duplicate log entry",
      decidedOn: "2026-01-05",
    });
    expect(fromExcludedCycleRow(row)).toEqual({
      cycleStartDate: "2026-01-01",
      reason: "duplicate log entry",
      decidedOn: "2026-01-05",
    });
  });

  it("assembles a keyed map from multiple rows, keyed by cycleStartDate", () => {
    const rows = [
      toExcludedCycleRow(parseCivil("2025-01-01"), {
        reason: "user judged this cycle an outlier",
        decidedOn: parseCivil("2025-06-01"),
      }),
      toExcludedCycleRow(parseCivil("2026-01-01"), {
        reason: "duplicate log entry",
        decidedOn: parseCivil("2026-01-05"),
      }),
    ];
    expect(excludedCyclesFromRows(rows)).toEqual({
      "2025-01-01": { reason: "user judged this cycle an outlier", decidedOn: "2025-06-01" },
      "2026-01-01": { reason: "duplicate log entry", decidedOn: "2026-01-05" },
    });
  });

  it("an empty row set reproduces DEFAULT_USER_DECISIONS.excludedCycles ({})", () => {
    expect(excludedCyclesFromRows([])).toEqual(DEFAULT_USER_DECISIONS.excludedCycles);
  });
});

describe("lib/repo/decisions.mapping — skip_prompt_decisions", () => {
  it("round-trips a row with inferredStartDate present", () => {
    const row = toSkipPromptRow(parseCivil("2026-02-01"), {
      confirmed: true,
      inferredStartDate: parseCivil("2026-02-15"),
      decidedOn: parseCivil("2026-03-01"),
    });
    expect(row).toEqual({
      gapStartDate: "2026-02-01",
      confirmed: true,
      inferredStartDate: "2026-02-15",
      decidedOn: "2026-03-01",
    });
    expect(fromSkipPromptRow(row)).toEqual({
      gapStartDate: "2026-02-01",
      confirmed: true,
      inferredStartDate: "2026-02-15",
      decidedOn: "2026-03-01",
    });
  });

  it("maps a SQL null inferredStartDate to undefined, never false/empty-string", () => {
    const row = toSkipPromptRow(parseCivil("2026-04-01"), {
      confirmed: false,
      decidedOn: parseCivil("2026-04-02"),
    });
    expect(row.inferredStartDate).toBeNull();
    const back = fromSkipPromptRow(row);
    expect(back.inferredStartDate).toBeUndefined();
    expect(back.confirmed).toBe(false);
  });

  it("assembles a keyed map from multiple rows, keyed by gapStartDate", () => {
    const rows = [
      toSkipPromptRow(parseCivil("2026-02-01"), {
        confirmed: true,
        inferredStartDate: parseCivil("2026-02-15"),
        decidedOn: parseCivil("2026-03-01"),
      }),
      toSkipPromptRow(parseCivil("2026-05-01"), {
        confirmed: false,
        decidedOn: parseCivil("2026-05-02"),
      }),
    ];
    expect(skipPromptsFromRows(rows)).toEqual({
      "2026-02-01": {
        confirmed: true,
        inferredStartDate: "2026-02-15",
        decidedOn: "2026-03-01",
      },
      "2026-05-01": { confirmed: false, inferredStartDate: undefined, decidedOn: "2026-05-02" },
    });
  });

  it("an empty row set reproduces DEFAULT_USER_DECISIONS.skipPrompts ({})", () => {
    expect(skipPromptsFromRows([])).toEqual(DEFAULT_USER_DECISIONS.skipPrompts);
  });
});

describe("lib/repo/decisions.mapping — userDecisionsFromRows (combined aggregate)", () => {
  it("reproduces DEFAULT_USER_DECISIONS when both tables are empty", () => {
    expect(userDecisionsFromRows({ excludedCycleRows: [], skipPromptRows: [] })).toEqual(
      DEFAULT_USER_DECISIONS,
    );
  });

  it("joins both tables into the exact UserDecisions shape", () => {
    const excludedCycleRows = [
      toExcludedCycleRow(parseCivil("2026-01-01"), {
        reason: "reason",
        decidedOn: parseCivil("2026-01-05"),
      }),
    ];
    const skipPromptRows = [
      toSkipPromptRow(parseCivil("2026-02-01"), {
        confirmed: true,
        inferredStartDate: parseCivil("2026-02-15"),
        decidedOn: parseCivil("2026-03-01"),
      }),
    ];
    expect(userDecisionsFromRows({ excludedCycleRows, skipPromptRows })).toEqual({
      excludedCycles: {
        "2026-01-01": { reason: "reason", decidedOn: "2026-01-05" },
      },
      skipPrompts: {
        "2026-02-01": {
          confirmed: true,
          inferredStartDate: "2026-02-15",
          decidedOn: "2026-03-01",
        },
      },
    });
  });
});

describe("lib/repo/decisions.mapping — health_message_decisions", () => {
  const FULLY_POPULATED: HealthMessageDecision = {
    ruleId: "CYC-02",
    dismissed: true,
    snoozedUntil: "2026-02-01" as HealthMessageDecision["snoozedUntil"],
    decidedOn: parseCivil("2026-01-15"),
  };

  it("round-trips every field of healthMessageDecisionSchema", () => {
    const row = toHealthMessageDecisionRow(FULLY_POPULATED);
    expect(row).toEqual({
      ruleId: "CYC-02",
      dismissed: true,
      snoozedUntil: "2026-02-01",
      decidedOn: "2026-01-15",
    });
    expect(fromHealthMessageDecisionRow(row)).toEqual(FULLY_POPULATED);
  });

  it("maps a SQL null snoozedUntil to null (a real value in this schema, not undefined)", () => {
    const minimal: HealthMessageDecision = {
      ruleId: "URG-01",
      dismissed: false,
      snoozedUntil: null,
      decidedOn: parseCivil("2026-01-01"),
    };
    const row = toHealthMessageDecisionRow(minimal);
    expect(row.snoozedUntil).toBeNull();
    expect(fromHealthMessageDecisionRow(row)).toEqual(minimal);
  });

  it("rejects a malformed date at the mapping boundary", () => {
    expect(() =>
      healthMessageDecisionSchema.parse({
        ruleId: "CYC-01",
        dismissed: false,
        snoozedUntil: null,
        decidedOn: "not-a-date",
      }),
    ).toThrow();
  });
});
