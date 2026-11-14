/**
 * Real round-trip tests for the time-zone columns (docs/MCP-SPEC.md Part A):
 * `profile.time_zone` via getUserTimeZone/setUserTimeZone, and `day_logs.updated_at`
 * via upsertDayLog/getDayLogUpdatedAt, stored as UTC (mysql2 `timezone: "Z"`).
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { sql } from "drizzle-orm";
import { DEFAULT_PROFILE, getUserTimeZone, setUserTimeZone, upsertProfile } from "@/lib/repo/profile";
import { getDayLogUpdatedAt, upsertDayLog } from "@/lib/repo/dayLogs";
import type { DayLog } from "@/lib/domain/types";
import { parseCivil } from "@/lib/date/civil";
import {
  closeDb,
  describeIfDb,
  ensureMigrationsApplied,
  getTestDb,
  itIfDb,
  truncateAll,
} from "@/lib/repo/testUtils";

function minimalLog(date: string): DayLog {
  const d = parseCivil(date);
  return { date: d, bleeding: "none", pain: { severity: "none" }, symptoms: [], loggedAt: d };
}

describeIfDb("time zone columns (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("getUserTimeZone is null and setUserTimeZone is a no-op when no profile exists", async () => {
    expect(await getUserTimeZone()).toBeNull();
    expect(await setUserTimeZone("Asia/Bangkok")).toBe(false);
    expect(await getUserTimeZone()).toBeNull();
  });

  itIfDb("round-trips the time zone, and upsertProfile leaves it untouched", async () => {
    await upsertProfile(DEFAULT_PROFILE);
    expect(await getUserTimeZone()).toBeNull();

    expect(await setUserTimeZone("Asia/Bangkok")).toBe(true);
    expect(await getUserTimeZone()).toBe("Asia/Bangkok");

    await upsertProfile(DEFAULT_PROFILE);
    expect(await getUserTimeZone()).toBe("Asia/Bangkok");
  });

  itIfDb("getDayLogUpdatedAt is null for a missing log", async () => {
    expect(await getDayLogUpdatedAt(parseCivil("2026-11-14"))).toBeNull();
  });

  itIfDb("upsertDayLog stamps updated_at with the current UTC instant", async () => {
    const date = parseCivil("2026-11-14");
    await upsertDayLog(minimalLog(date));

    const first = await getDayLogUpdatedAt(date);
    expect(first).not.toBeNull();
    expect(Math.abs(Date.now() - first!)).toBeLessThan(5_000);
    expect(await getDayLogUpdatedAt(date)).toBe(first); // stable on re-read

    // Stored as UTC on the server, independent of the host's zone.
    const [rows] = (await getTestDb().execute(
      sql`SELECT TIMESTAMPDIFF(SECOND, updated_at, UTC_TIMESTAMP(3)) AS drift FROM day_logs WHERE date = ${date}`,
    )) as unknown as [{ drift: number }[]];
    expect(Math.abs(Number(rows[0].drift))).toBeLessThan(5);

    await new Promise((r) => setTimeout(r, 10));
    await upsertDayLog(minimalLog(date));
    expect(await getDayLogUpdatedAt(date)).toBeGreaterThan(first!);
  });
});
