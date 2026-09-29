/**
 * lib/repo/profile.ts's actual read/write behavior (getProfile, upsertProfile, ...) now
 * runs real Drizzle/mysql2 queries and is exercised by the integration suite
 * (lib/repo/__integration__/*.itest.ts, DB-MIGRATION.md §4) against real MySQL — not
 * here. This file covers everything about profile.ts that's pure and doesn't need a
 * database: the DEFAULT_PROFILE constant itself. The round-trip logic that used to be
 * tested here via FakeCollection now lives in profile.mapping.test.ts
 * (DB-MIGRATION.md §4.1: "this is the primary deterministic coverage and replaces the
 * old FakeCollection tests").
 */
import { describe, expect, it } from "vitest";
import {
  CYCLE_LENGTH_BOUNDS,
  PERIOD_DURATION_BOUNDS,
  profileSchema,
} from "@/lib/domain/schema";
import { DEFAULT_PROFILE } from "@/lib/repo/profile";

describe("lib/repo/profile — DEFAULT_PROFILE", () => {
  it("keeps every opt-in setting off and health awareness on, matching SPEC.md's defaults", () => {
    expect(DEFAULT_PROFILE.settings.fertilityEnabled).toBe(false);
    expect(DEFAULT_PROFILE.settings.tierCSymptomsEnabled).toBe(false);
    expect(DEFAULT_PROFILE.settings.healthAwarenessEnabled).toBe(true);
    expect(DEFAULT_PROFILE.settings.notifications.privateWording).toBe(true);
  });

  it("declares no life-stage facts and no optional scalars before onboarding runs", () => {
    expect(DEFAULT_PROFILE.birthYear).toBeUndefined();
    expect(DEFAULT_PROFILE.menarcheYear).toBeUndefined();
    expect(DEFAULT_PROFILE.reportedTypicalCycleLength).toBeUndefined();
    expect(DEFAULT_PROFILE.reportedRegularity).toBeUndefined();
    expect(DEFAULT_PROFILE.state.hormonalMethod).toBeUndefined();
    expect(DEFAULT_PROFILE.state.pregnant).toBe(false);
    expect(DEFAULT_PROFILE.state.preferNotToSay).toBe(false);
  });

  it("is itself a valid Profile per profileSchema", () => {
    expect(() => profileSchema.parse(DEFAULT_PROFILE)).not.toThrow();
  });
});

describe("profileSchema — self-reported number bounds", () => {
  const withPeriodDays = (n: number) => ({ ...DEFAULT_PROFILE, reportedTypicalPeriodDays: n });
  const withCycleLength = (n: number) => ({ ...DEFAULT_PROFILE, reportedTypicalCycleLength: n });

  it("accepts a value on each bound", () => {
    expect(() => profileSchema.parse(withPeriodDays(PERIOD_DURATION_BOUNDS.min))).not.toThrow();
    expect(() => profileSchema.parse(withPeriodDays(PERIOD_DURATION_BOUNDS.max))).not.toThrow();
    expect(() => profileSchema.parse(withCycleLength(CYCLE_LENGTH_BOUNDS.min))).not.toThrow();
    expect(() => profileSchema.parse(withCycleLength(CYCLE_LENGTH_BOUNDS.max))).not.toThrow();
  });

  it("rejects an out-of-range or non-integer period length at the write boundary", () => {
    // PUT /api/profile parses the body with this schema. Before it was bounded, the
    // settings form's number input could save 45 or 90 — and
    // components/calendar/dayIndicators.ts paints "period expected to continue" days from
    // that number, so an unbounded value marked most of the month as an expected period.
    expect(() => profileSchema.parse(withPeriodDays(PERIOD_DURATION_BOUNDS.max + 1))).toThrow();
    expect(() => profileSchema.parse(withPeriodDays(90))).toThrow();
    expect(() => profileSchema.parse(withPeriodDays(0))).toThrow();
    expect(() => profileSchema.parse(withPeriodDays(5.5))).toThrow();
  });

  it("rejects an out-of-range cycle length at the write boundary", () => {
    expect(() => profileSchema.parse(withCycleLength(CYCLE_LENGTH_BOUNDS.min - 1))).toThrow();
    expect(() => profileSchema.parse(withCycleLength(CYCLE_LENGTH_BOUNDS.max + 1))).toThrow();
  });
});
