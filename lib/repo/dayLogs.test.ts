/**
 * Unit coverage for the parts of lib/repo/dayLogs.ts that don't require a live database.
 * Field-fidelity logic (the interesting, exhaustively-tested part) lives in
 * lib/repo/dayLogs.mapping.ts / dayLogs.mapping.test.ts — see docs/DB-MIGRATION.md §4.1.
 * Real Drizzle-against-MySQL behavior (upsert-then-read, transactional replace of child
 * rows, range filtering, delete counts) is covered by the integration suite
 * (lib/repo/__integration__/**), which is a separate agent's responsibility and skips
 * when `DATABASE_URL` is unset.
 */
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { parseCivil } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import { deleteAllDayLogs, deleteDayLog, upsertDayLog } from "@/lib/repo/dayLogs";
import type { Db } from "@/lib/db";

function makeLog(overrides: Partial<DayLog> = {}): DayLog {
  return {
    date: parseCivil("2026-03-10"),
    bleeding: "menstrual",
    flow: "medium",
    pain: { severity: "mild" },
    symptoms: [],
    loggedAt: parseCivil("2026-03-10"),
    ...overrides,
  };
}

describe("lib/repo/dayLogs", () => {
  it("rejects an invalid DayLog at the write boundary before touching the database", async () => {
    // No `tx` is passed and DATABASE_URL is unset in the test environment, so this can
    // only pass without throwing a *connection* error if validation genuinely happens
    // before any database access is attempted — i.e. upsertDayLog validates via
    // dayLogs.mapping's toRows() first.
    const bad = { ...makeLog(), bleeding: "not-a-real-value" } as unknown as DayLog;
    let error: unknown;
    try {
      await upsertDayLog(bad);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    // Confirms the failure really is zod validation, not a side effect of the test
    // environment happening to have (or lack) DATABASE_URL configured.
    expect((error as Error).message).not.toMatch(/DATABASE_URL/);
  });
});

/**
 * Regression guard for the hard-delete paths (reviewer finding: the delete flows relied
 * solely on FK `ON DELETE CASCADE`, so on a TiDB config that doesn't enforce FK cascade
 * the "permanent delete" left orphan symptom/mood/pain rows). docs/DB-MIGRATION.md §3.2
 * mandates deleting the four child tables explicitly inside the write transaction,
 * belt-and-suspenders, exactly as `upsertDayLog` already does.
 *
 * These run with NO database: a fake `Db` records every `delete(table)` call and whether
 * it happened inside a `transaction(...)`. This asserts the SQL the repo *issues*, which
 * is precisely what a non-FK-enforcing engine depends on — the failure the reviewer
 * described is invisible to a MySQL-with-FK integration run but caught here.
 */
interface DeleteCall {
  table: string;
  scoped: boolean;
  inTransaction: boolean;
}

function makeRecordingDb(affectedByTable: Record<string, number>) {
  const deletes: DeleteCall[] = [];
  let transactionCount = 0;

  const makeDelete = (inTransaction: boolean) => (table: unknown) => {
    const name = getTableName(table as never);
    const call: DeleteCall = { table: name, scoped: false, inTransaction };
    deletes.push(call);
    const rows = [{ affectedRows: affectedByTable[name] ?? 0 }];
    // Thenable so `await t.delete(table)` (delete-all, no WHERE) resolves directly, while
    // `.where(...)` (scoped delete) marks the call scoped and resolves the same rows.
    return {
      // Real Drizzle passes a condition here; the extra arg is harmlessly ignored.
      where() {
        call.scoped = true;
        return Promise.resolve(rows);
      },
      then<T>(resolve: (value: typeof rows) => T) {
        return Promise.resolve(rows).then(resolve);
      },
    };
  };

  const tx = { delete: makeDelete(true) };
  const db = {
    delete: makeDelete(false),
    transaction<T>(cb: (t: typeof tx) => Promise<T>): Promise<T> {
      transactionCount += 1;
      return cb(tx);
    },
  };

  return { db: db as unknown as Db, deletes, transactionCount: () => transactionCount };
}

const CHILD_TABLES = ["day_log_symptoms", "day_log_moods", "day_log_pain_sites", "day_log_pain_interference"];

describe("lib/repo/dayLogs hard-delete cascades children explicitly (DB-MIGRATION §3.2)", () => {
  it("deleteDayLog deletes all four child tables (scoped) and the parent inside one transaction", async () => {
    const rec = makeRecordingDb({ day_logs: 1 });
    const removed = await deleteDayLog(parseCivil("2026-03-10"), rec.db);

    expect(removed).toBe(true);
    expect(rec.transactionCount()).toBe(1);
    // Every delete happened inside the transaction.
    expect(rec.deletes.every((d) => d.inTransaction)).toBe(true);
    // All four child tables plus the parent were deleted, each scoped by date.
    const deletedTables = rec.deletes.map((d) => d.table);
    for (const child of CHILD_TABLES) {
      expect(deletedTables).toContain(child);
    }
    expect(deletedTables).toContain("day_logs");
    expect(rec.deletes.every((d) => d.scoped)).toBe(true);
  });

  it("deleteDayLog returns false when the parent row did not exist", async () => {
    const rec = makeRecordingDb({ day_logs: 0 });
    expect(await deleteDayLog(parseCivil("2026-03-10"), rec.db)).toBe(false);
  });

  it("deleteAllDayLogs empties all four child tables (unscoped) and the parent inside one transaction", async () => {
    const rec = makeRecordingDb({ day_logs: 7 });
    const count = await deleteAllDayLogs(rec.db);

    expect(count).toBe(7);
    expect(rec.transactionCount()).toBe(1);
    expect(rec.deletes.every((d) => d.inTransaction)).toBe(true);
    const deletedTables = rec.deletes.map((d) => d.table);
    for (const child of CHILD_TABLES) {
      expect(deletedTables).toContain(child);
    }
    expect(deletedTables).toContain("day_logs");
    // Delete-all is unscoped: no WHERE clause on any table.
    expect(rec.deletes.every((d) => !d.scoped)).toBe(true);
  });
});
