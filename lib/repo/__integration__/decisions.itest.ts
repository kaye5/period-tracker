/**
 * Real round-trip tests for lib/repo/decisions.ts against MySQL — the three decisions
 * tables (docs/DB-MIGRATION.md §3.5-3.7): `excluded_cycles`, `skip_prompt_decisions`,
 * `health_message_decisions`.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect } from "vitest";
import {
  DEFAULT_USER_DECISIONS,
  deleteAllDecisions,
  excludeCycle,
  getHealthMessageDecision,
  getUserDecisions,
  listHealthMessageDecisions,
  recordSkipPromptAnswer,
  setHealthMessageDecision,
  unexcludeCycle,
} from "@/lib/repo/decisions";
import { parseCivil, type CivilDate } from "@/lib/date/civil";
import { closeDb, describeIfDb, ensureMigrationsApplied, itIfDb, truncateAll } from "@/lib/repo/testUtils";

describeIfDb("lib/repo/decisions.ts (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("getUserDecisions returns the default shape before any decision is recorded", async () => {
    expect(await getUserDecisions()).toEqual(DEFAULT_USER_DECISIONS);
  });

  describe("excluded_cycles", () => {
    itIfDb("excludeCycle then unexcludeCycle round-trip through the excludedCycles map", async () => {
      const cycleStart = parseCivil("2026-02-10");
      const decidedOn = parseCivil("2026-02-14");

      const afterExclude = await excludeCycle(cycleStart, "Traveling across time zones this cycle.", decidedOn);
      expect(afterExclude.excludedCycles[cycleStart]).toEqual({
        reason: "Traveling across time zones this cycle.",
        decidedOn,
      });

      const fetched = await getUserDecisions();
      expect(fetched.excludedCycles[cycleStart]).toEqual({
        reason: "Traveling across time zones this cycle.",
        decidedOn,
      });

      const afterUnexclude = await unexcludeCycle(cycleStart);
      expect(afterUnexclude.excludedCycles[cycleStart]).toBeUndefined();
      expect(await getUserDecisions()).toEqual(DEFAULT_USER_DECISIONS);
    });

    itIfDb("multiple excluded cycles all persist independently", async () => {
      await excludeCycle(parseCivil("2026-01-01"), "reason one", parseCivil("2026-01-05"));
      await excludeCycle(parseCivil("2026-03-01"), "reason two", parseCivil("2026-03-05"));

      const fetched = await getUserDecisions();
      expect(Object.keys(fetched.excludedCycles).sort()).toEqual(["2026-01-01", "2026-03-01"]);
      expect(fetched.excludedCycles["2026-01-01" as CivilDate].reason).toBe("reason one");
      expect(fetched.excludedCycles["2026-03-01" as CivilDate].reason).toBe("reason two");
    });
  });

  describe("skip_prompt_decisions", () => {
    itIfDb("recordSkipPromptAnswer round-trips a confirmed answer with an inferred start date", async () => {
      const gapStart = parseCivil("2026-04-01");
      const inferredStart = parseCivil("2026-04-15");
      const decidedOn = parseCivil("2026-05-20");

      await recordSkipPromptAnswer(gapStart, { confirmed: true, inferredStartDate: inferredStart }, decidedOn);

      const fetched = await getUserDecisions();
      expect(fetched.skipPrompts[gapStart]).toEqual({
        confirmed: true,
        inferredStartDate: inferredStart,
        decidedOn,
      });
    });

    itIfDb("recordSkipPromptAnswer round-trips a declined answer with no inferred date", async () => {
      const gapStart = parseCivil("2026-06-01");
      const decidedOn = parseCivil("2026-06-20");

      await recordSkipPromptAnswer(gapStart, { confirmed: false }, decidedOn);

      const fetched = await getUserDecisions();
      expect(fetched.skipPrompts[gapStart].confirmed).toBe(false);
      expect(fetched.skipPrompts[gapStart].inferredStartDate).toBeUndefined();
    });
  });

  describe("health_message_decisions", () => {
    itIfDb("setHealthMessageDecision round-trips dismissed and snoozedUntil", async () => {
      const decidedOn = parseCivil("2026-07-01");
      const snoozedUntil = parseCivil("2026-08-01");

      const saved = await setHealthMessageDecision(
        "CYC-02",
        { dismissed: false, snoozedUntil },
        decidedOn,
      );
      expect(saved).toEqual({ ruleId: "CYC-02", dismissed: false, snoozedUntil, decidedOn });

      const fetched = await getHealthMessageDecision("CYC-02");
      expect(fetched).toEqual(saved);
    });

    itIfDb("setHealthMessageDecision preserves the unspecified field on a partial update", async () => {
      const firstDecidedOn = parseCivil("2026-07-01");
      await setHealthMessageDecision("URG-01", { dismissed: true }, firstDecidedOn);

      const secondDecidedOn = parseCivil("2026-07-05");
      const snoozedUntil = parseCivil("2026-07-20");
      const updated = await setHealthMessageDecision("URG-01", { snoozedUntil }, secondDecidedOn);

      expect(updated.dismissed).toBe(true);
      expect(updated.snoozedUntil).toEqual(snoozedUntil);
    });

    itIfDb("getHealthMessageDecision returns null for a rule never decided on", async () => {
      expect(await getHealthMessageDecision("PMB-01")).toBeNull();
    });

    itIfDb("listHealthMessageDecisions returns every recorded decision", async () => {
      await setHealthMessageDecision("CYC-01", { dismissed: true }, parseCivil("2026-01-01"));
      await setHealthMessageDecision("DUR-02", { dismissed: false }, parseCivil("2026-01-02"));

      const all = await listHealthMessageDecisions();
      expect(all.map((d) => d.ruleId).sort()).toEqual(["CYC-01", "DUR-02"]);
    });
  });

  itIfDb("deleteAllDecisions empties all three decisions tables at once", async () => {
    await excludeCycle(parseCivil("2026-01-01"), "reason", parseCivil("2026-01-05"));
    await recordSkipPromptAnswer(parseCivil("2026-02-01"), { confirmed: false }, parseCivil("2026-02-05"));
    await setHealthMessageDecision("CYC-01", { dismissed: true }, parseCivil("2026-03-01"));

    await deleteAllDecisions();

    expect(await getUserDecisions()).toEqual(DEFAULT_USER_DECISIONS);
    expect(await listHealthMessageDecisions()).toEqual([]);
  });
});
