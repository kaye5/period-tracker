/**
 * Real round-trip test for the "permanent delete" flow (app/api/delete-all/route.ts's
 * job, exercised here directly through the repo layer): after seeding every table and
 * calling every repo's `deleteAll*`/`delete*` hard-delete function, every single table
 * this schema defines — including every day-log child table and the calibration coverage
 * child table — must be empty. This is the strongest form of docs/DB-MIGRATION.md's
 * "delete endpoint must actually drop the data, not soft-delete it" requirement: it
 * checks the raw tables via Drizzle directly, not just what the repo functions report
 * back, so a repo function that under-counts or misses a child table cannot pass silently.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { sql } from "drizzle-orm";
import { deleteAllDayLogs, upsertDayLog } from "@/lib/repo/dayLogs";
import { deleteProfile, upsertProfile, DEFAULT_PROFILE } from "@/lib/repo/profile";
import { deleteAllDecisions, excludeCycle, recordSkipPromptAnswer, setHealthMessageDecision } from "@/lib/repo/decisions";
import { deleteAllPredictions, issuePrediction } from "@/lib/repo/predictions";
import { deleteCalibrationState, updateCalibrationState } from "@/lib/repo/calibration";
import { parseCivil } from "@/lib/date/civil";
import * as schema from "@/lib/db/schema";
import { closeDb, describeIfDb, ensureMigrationsApplied, getTestDb, itIfDb, truncateAll } from "@/lib/repo/testUtils";

const ALL_TABLES = [
  schema.dayLogs,
  schema.dayLogSymptoms,
  schema.dayLogMoods,
  schema.dayLogPainSites,
  schema.dayLogPainInterference,
  schema.profile,
  schema.predictions,
  schema.excludedCycles,
  schema.skipPromptDecisions,
  schema.healthMessageDecisions,
  schema.calibration,
  schema.calibrationCoverage,
] as const;

describeIfDb("permanent-delete flow (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("every table is empty after the full delete-all sequence runs", async () => {
    // Seed every table, including every day-log child table (symptoms/moods/pain
    // sites/interference) and the coverage child table.
    const date = parseCivil("2026-05-01");
    await upsertDayLog({
      date,
      bleeding: "menstrual",
      flow: "heavy",
      pain: { severity: "severe", sites: ["back", "legs"], interferedWith: ["sleep", "work_or_school"] },
      symptoms: ["cramps", "bloating"],
      mood: ["irritable", "low"],
      loggedAt: date,
    });
    await upsertProfile({
      ...DEFAULT_PROFILE,
      birthYear: 1990,
      state: { ...DEFAULT_PROFILE.state, hormonalMethod: { kind: "patch", startedOn: date } },
    });
    await excludeCycle(parseCivil("2026-01-01"), "reason", parseCivil("2026-01-05"));
    await recordSkipPromptAnswer(parseCivil("2026-02-01"), { confirmed: true, inferredStartDate: parseCivil("2026-02-10") }, parseCivil("2026-02-15"));
    await setHealthMessageDecision("CYC-01", { dismissed: true }, parseCivil("2026-03-01"));
    await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: parseCivil("2026-01-29"),
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });
    await updateCalibrationState({ cumulativeAdjustment: 1.2, recentCoverage: [true, false, true] });

    // Sanity check: every table actually has at least one row before we delete.
    for (const table of ALL_TABLES) {
      const rows = await getTestDb().select().from(table as never);
      expect(rows.length, `expected seeded rows in a table before delete-all`).toBeGreaterThan(0);
    }

    // The permanent-delete sequence.
    await deleteAllDayLogs();
    await deleteProfile();
    await deleteAllDecisions();
    await deleteAllPredictions();
    await deleteCalibrationState();

    for (const table of ALL_TABLES) {
      const rows = await getTestDb().select().from(table as never);
      expect(rows, `table should be empty after the full delete-all sequence`).toEqual([]);
    }

    // Belt-and-suspenders on the raw row counts too, via a direct count query per table.
    for (const table of ALL_TABLES) {
      const [{ count }] = await getTestDb()
        .select({ count: sql<number>`count(*)` })
        .from(table as never);
      expect(Number(count)).toBe(0);
    }
  });
});
