/**
 * lib/repo/decisions.ts's actual read/write behavior (getUserDecisions,
 * recordSkipPromptAnswer, excludeCycle, setHealthMessageDecision, deleteAllDecisions,
 * ...) now runs real Drizzle/mysql2 queries against three tables and is exercised by the
 * integration suite (lib/repo/__integration__/*.itest.ts, DB-MIGRATION.md §4) — not here.
 * This file covers what's pure and doesn't need a database: the DEFAULT_USER_DECISIONS
 * constant and the healthMessageDecisionSchema validation boundary. The row <-> domain
 * round-trip logic that used to be tested here via FakeCollection now lives in
 * decisions.mapping.test.ts (DB-MIGRATION.md §4.1: "this is the primary deterministic
 * coverage and replaces the old FakeCollection tests").
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_USER_DECISIONS, healthMessageDecisionSchema } from "@/lib/repo/decisions";

describe("lib/repo/decisions — DEFAULT_USER_DECISIONS", () => {
  it("is empty on both maps before anything has been recorded", () => {
    expect(DEFAULT_USER_DECISIONS).toEqual({ excludedCycles: {}, skipPrompts: {} });
  });
});

describe("lib/repo/decisions — healthMessageDecisionSchema", () => {
  it("accepts a fully-populated decision", () => {
    expect(() =>
      healthMessageDecisionSchema.parse({
        ruleId: "CYC-02",
        dismissed: true,
        snoozedUntil: "2026-02-01",
        decidedOn: "2026-01-15",
      }),
    ).not.toThrow();
  });

  it("accepts snoozedUntil: null (a real, distinct state from 'not yet decided')", () => {
    const parsed = healthMessageDecisionSchema.parse({
      ruleId: "URG-01",
      dismissed: false,
      snoozedUntil: null,
      decidedOn: "2026-01-01",
    });
    expect(parsed.snoozedUntil).toBeNull();
  });

  it("rejects a decision missing decidedOn", () => {
    expect(() =>
      healthMessageDecisionSchema.parse({
        ruleId: "CYC-01",
        dismissed: false,
        snoozedUntil: null,
      }),
    ).toThrow();
  });

  it("rejects a non-civil-date snoozedUntil", () => {
    expect(() =>
      healthMessageDecisionSchema.parse({
        ruleId: "CYC-01",
        dismissed: false,
        snoozedUntil: "2026-02-30", // not a real calendar date
        decidedOn: "2026-01-01",
      }),
    ).toThrow();
  });

  it("rejects dismissed being a non-boolean", () => {
    expect(() =>
      healthMessageDecisionSchema.parse({
        ruleId: "CYC-01",
        dismissed: "yes",
        snoozedUntil: null,
        decidedOn: "2026-01-01",
      }),
    ).toThrow();
  });
});
