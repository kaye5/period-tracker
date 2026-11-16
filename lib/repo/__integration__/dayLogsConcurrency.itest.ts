/**
 * Concurrent MCP writes to the same day (docs/MCP-SPEC.md "Write tools"): the conditional
 * upsert's `SELECT … FOR UPDATE` version check, and the write tools' retry on top of it,
 * against real MySQL InnoDB.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { getDayLog, getDayLogUpdatedAt, upsertDayLog, upsertDayLogIfUnchanged } from "@/lib/repo/dayLogs";
import { DEFAULT_PROFILE, upsertProfile } from "@/lib/repo/profile";
import { runWriteTool, WRITE_CONFLICT } from "@/lib/mcp/tools/write";
import type { DayLog, MoodId } from "@/lib/domain/types";
import { parseCivil, todayInZone } from "@/lib/date/civil";
import { closeDb, describeIfDb, ensureMigrationsApplied, itIfDb, truncateAll } from "@/lib/repo/testUtils";

const DATE = parseCivil("2026-11-10");

function logWithMoods(mood: MoodId[]): DayLog {
  return { date: DATE, bleeding: "none", pain: { severity: "none" }, symptoms: [], mood, loggedAt: DATE };
}

/** Errors a racing insert of a brand-new row may get instead of `{ ok: false }`. */
function isInsertRace(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } }).cause?.code;
  return code === "ER_LOCK_DEADLOCK" || code === "ER_DUP_ENTRY";
}

describeIfDb("concurrent day-log writes (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("rejects a conditional upsert whose expected version is stale, without writing", async () => {
    await upsertDayLog(logWithMoods(["calm"]));
    const loaded = await getDayLogUpdatedAt(DATE);

    expect(await upsertDayLogIfUnchanged(logWithMoods(["calm", "happy"]), loaded)).toMatchObject({ ok: true });
    expect(await upsertDayLogIfUnchanged(logWithMoods(["calm", "sad"]), loaded)).toEqual({ ok: false });
    expect((await getDayLog(DATE))?.mood).toEqual(["calm", "happy"]);
  });

  itIfDb("lets exactly one of two racing inserts of a new day through", async () => {
    const results = await Promise.allSettled([
      upsertDayLogIfUnchanged(logWithMoods(["happy"]), null),
      upsertDayLogIfUnchanged(logWithMoods(["sad"]), null),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok);
    const lost = results.filter(
      (r) => (r.status === "fulfilled" && !r.value.ok) || (r.status === "rejected" && isInsertRace(r.reason)),
    );
    expect(ok).toHaveLength(1);
    expect(lost).toHaveLength(1);
    const winner = (ok[0] as PromiseFulfilledResult<{ ok: true; dayLog: DayLog }>).value.dayLog;
    expect((await getDayLog(DATE))?.mood).toEqual(winner.mood);
  });

  itIfDb("keeps both facts when log_mood and log_symptoms run at the same time", async () => {
    await upsertProfile(DEFAULT_PROFILE);
    const today = todayInZone("UTC", Date.now());

    const results = await Promise.all([
      runWriteTool(undefined, { tool: "log_mood", moods: ["happy"] }),
      runWriteTool(undefined, { tool: "log_symptoms", symptoms: ["cramps"] }),
    ]);

    for (const r of results) expect(r).not.toHaveProperty("isError");
    const saved = await getDayLog(today);
    expect(saved?.mood).toEqual(["happy"]);
    expect(saved?.symptoms).toEqual(["cramps"]);
  });

  itIfDb("never loses a reported save when three writes race (a loser gets the conflict error)", async () => {
    await upsertProfile(DEFAULT_PROFILE);
    const today = todayInZone("UTC", Date.now());
    const moods: MoodId[] = ["happy", "calm", "sad"];

    const results = await Promise.all(moods.map((m) => runWriteTool(undefined, { tool: "log_mood", moods: [m] })));

    const saved = await getDayLog(today);
    results.forEach((r, i) => {
      if ("isError" in r) expect(r.content[0].text).toBe(WRITE_CONFLICT);
      else expect(saved?.mood).toContain(moods[i]);
    });
    expect(results.some((r) => !("isError" in r))).toBe(true);
  });
});
