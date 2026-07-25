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
import { profileSchema } from "@/lib/domain/schema";
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
