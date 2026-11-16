/**
 * `dayLogs` is the sole source of user-recorded truth (SPEC.md R2). All field-fidelity
 * logic (null<->undefined, fertility reconstruct-if-any, CivilDate pass-through, boolean
 * nullability, the four set-valued child tables) lives in the pure, exhaustively unit
 * tested `lib/repo/dayLogs.mapping.ts` — this file is a thin Drizzle wrapper around it.
 *
 * `date` is the parent table's primary key; the four child tables (symptoms, moods, pain
 * sites, pain interference) hold `DayLog`'s set-valued fields, one row per value, FK'd to
 * `day_logs.date` ON DELETE CASCADE (docs/DB-MIGRATION.md §3.2). Every write path that
 * removes a parent row (`upsertDayLog`'s replace, `deleteDayLog`, `deleteAllDayLogs`) also
 * deletes the matching child rows explicitly inside its transaction — belt-and-suspenders
 * so the delete still fully empties every table on a TiDB config that doesn't enforce the
 * FK cascade.
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { CivilDate } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import {
  dayLogMoods,
  dayLogPainInterference,
  dayLogPainSites,
  dayLogs,
  dayLogSymptoms,
  getDb,
  type Db,
} from "@/lib/db";
import { fromRows, toRows, type DayLogChildValues, type DayLogRows } from "@/lib/repo/dayLogs.mapping";

/** Groups rows of `{ date, value }` shape into a `Map<date, value[]>`, preserving
 * insertion order within each date's list. Used to assemble each child table's rows
 * (fetched once, for every date in the result set) back onto their parent day log
 * without an N+1 query per date. */
function groupByDate<Row, Value>(
  rows: Row[],
  dateOf: (row: Row) => string,
  valueOf: (row: Row) => Value,
): Map<string, Value[]> {
  const grouped = new Map<string, Value[]>();
  for (const row of rows) {
    const date = dateOf(row);
    const bucket = grouped.get(date);
    if (bucket) {
      bucket.push(valueOf(row));
    } else {
      grouped.set(date, [valueOf(row)]);
    }
  }
  return grouped;
}

/** Loads and groups all four child tables' rows for a set of dates in exactly four
 * queries total (not four-per-date), then hands back a per-date lookup. */
async function loadChildrenByDate(db: Db, dates: string[]): Promise<Map<string, DayLogChildValues>> {
  const byDate = new Map<string, DayLogChildValues>();
  if (dates.length === 0) return byDate;

  const [symptomRows, moodRows, painSiteRows, interferenceRows] = await Promise.all([
    db.select().from(dayLogSymptoms).where(inArray(dayLogSymptoms.date, dates)),
    db.select().from(dayLogMoods).where(inArray(dayLogMoods.date, dates)),
    db.select().from(dayLogPainSites).where(inArray(dayLogPainSites.date, dates)),
    db.select().from(dayLogPainInterference).where(inArray(dayLogPainInterference.date, dates)),
  ]);

  const symptomsByDate = groupByDate(symptomRows, (r) => r.date, (r) => r.symptom);
  const moodsByDate = groupByDate(moodRows, (r) => r.date, (r) => r.mood);
  const painSitesByDate = groupByDate(painSiteRows, (r) => r.date, (r) => r.site);
  const interferenceByDate = groupByDate(interferenceRows, (r) => r.date, (r) => r.interference);

  for (const date of dates) {
    byDate.set(date, {
      symptoms: symptomsByDate.get(date) ?? [],
      moods: moodsByDate.get(date) ?? [],
      painSites: painSitesByDate.get(date) ?? [],
      interference: interferenceByDate.get(date) ?? [],
    });
  }
  return byDate;
}

const emptyChildren: DayLogChildValues = { symptoms: [], moods: [], painSites: [], interference: [] };

export async function getDayLog(date: CivilDate, tx?: Db): Promise<DayLog | null> {
  const db = tx ?? getDb();
  const [row] = await db.select().from(dayLogs).where(eq(dayLogs.date, date));
  if (!row) return null;

  const children = await loadChildrenByDate(db, [date]);
  return fromRows(row, children.get(date) ?? emptyChildren);
}

/** All day logs, optionally restricted to a date range (both bounds inclusive), sorted
 * chronologically by date. */
export async function listDayLogs(
  range?: { from: CivilDate; to: CivilDate },
  tx?: Db,
): Promise<DayLog[]> {
  const db = tx ?? getDb();
  const whereClause = range ? and(gte(dayLogs.date, range.from), lte(dayLogs.date, range.to)) : undefined;
  const rows = await db.select().from(dayLogs).where(whereClause).orderBy(asc(dayLogs.date));
  if (rows.length === 0) return [];

  const children = await loadChildrenByDate(db, rows.map((row) => row.date));
  return rows.map((row) => fromRows(row, children.get(row.date) ?? emptyChildren));
}

export async function listAllDayLogs(tx?: Db): Promise<DayLog[]> {
  return listDayLogs(undefined, tx);
}

/** Insert or fully replace the log for `input.date`. There is no partial-update helper
 * on purpose: SPEC.md R7 forbids silently discarding data, and a partial-`$set`/`$set`-
 * style API invites exactly that (a caller who forgets a field ends up looking like they
 * cleared it). Callers that want a partial edit must read, merge, then call this with the
 * whole object.
 *
 * One transaction (docs/DB-MIGRATION.md §3.2): upsert the parent row, then explicitly
 * delete and reinsert this date's four child-table rows (belt-and-suspenders alongside
 * the FK `ON DELETE CASCADE` — some TiDB configs don't enforce it). `toRows` validates
 * `input` before any of this runs, so an invalid `DayLog` throws before touching the
 * database at all. */
export async function upsertDayLog(input: DayLog, tx?: Db): Promise<DayLog> {
  const rows = toRows(input);
  const db = tx ?? getDb();
  await db.transaction((t) => writeDayLogRows(t, rows));
  return fromRows(rows.row, rows);
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** `upsertDayLog`'s writes, run inside the caller's transaction `t`. */
async function writeDayLogRows(t: Tx, { row, symptoms, moods, painSites, interference }: DayLogRows): Promise<void> {
  // Save time is a UTC instant (docs/MCP-SPEC.md Part A), set on insert and update alike.
  const values = { ...row, updatedAt: new Date() };

  await t.insert(dayLogs).values(values).onDuplicateKeyUpdate({ set: values });

  await t.delete(dayLogSymptoms).where(eq(dayLogSymptoms.date, row.date));
  await t.delete(dayLogMoods).where(eq(dayLogMoods.date, row.date));
  await t.delete(dayLogPainSites).where(eq(dayLogPainSites.date, row.date));
  await t.delete(dayLogPainInterference).where(eq(dayLogPainInterference.date, row.date));

  if (symptoms.length > 0) {
    await t.insert(dayLogSymptoms).values(symptoms.map((symptom) => ({ date: row.date, symptom })));
  }
  if (moods.length > 0) {
    await t.insert(dayLogMoods).values(moods.map((mood) => ({ date: row.date, mood })));
  }
  if (painSites.length > 0) {
    await t.insert(dayLogPainSites).values(painSites.map((site) => ({ date: row.date, site })));
  }
  if (interference.length > 0) {
    await t
      .insert(dayLogPainInterference)
      .values(interference.map((value) => ({ date: row.date, interference: value })));
  }
}

/** `upsertDayLog`, but only if the row's `updated_at` is still `expectedUpdatedAt` (epoch ms;
 * null = no row, or a row saved before `updated_at` existed) — optimistic concurrency for
 * the MCP write tools, which load, merge and save the whole log. The row is read with
 * `SELECT … FOR UPDATE` (MySQL InnoDB, and TiDB's default pessimistic mode), so a concurrent
 * save either finishes first (→ `{ ok: false }`, nothing written) or waits for this one.
 * When no row exists, two racing inserts can still fail with a deadlock or duplicate-key
 * error; callers treat that like `{ ok: false }` and retry. */
export async function upsertDayLogIfUnchanged(
  input: DayLog,
  expectedUpdatedAt: number | null,
  tx?: Db,
): Promise<{ ok: true; dayLog: DayLog } | { ok: false }> {
  const rows = toRows(input);
  const db = tx ?? getDb();
  const written = await db.transaction(async (t) => {
    const [current] = await t
      .select({ updatedAt: dayLogs.updatedAt })
      .from(dayLogs)
      .where(eq(dayLogs.date, rows.row.date))
      .for("update");
    if ((current?.updatedAt?.getTime() ?? null) !== expectedUpdatedAt) return false;
    await writeDayLogRows(t, rows);
    return true;
  });
  return written ? { ok: true, dayLog: fromRows(rows.row, rows) } : { ok: false };
}

/** When the log for `date` was last saved, as epoch ms (UTC), or null if there is no log
 * or it was saved before `updated_at` existed. */
export async function getDayLogUpdatedAt(date: CivilDate, tx?: Db): Promise<number | null> {
  const db = tx ?? getDb();
  const [row] = await db.select({ updatedAt: dayLogs.updatedAt }).from(dayLogs).where(eq(dayLogs.date, date));
  return row?.updatedAt?.getTime() ?? null;
}

/** Every log's `updated_at` (epoch ms, or null if saved before it existed), by date — the
 * versions the MCP write tools pass to `upsertDayLogIfUnchanged`. */
export async function listDayLogUpdatedAt(tx?: Db): Promise<Map<CivilDate, number | null>> {
  const db = tx ?? getDb();
  const rows = await db.select({ date: dayLogs.date, updatedAt: dayLogs.updatedAt }).from(dayLogs);
  return new Map(rows.map((r) => [r.date as CivilDate, r.updatedAt?.getTime() ?? null]));
}

/** Hard delete — SPEC.md's data-layer brief: "Delete endpoint must actually drop the
 * data, not soft-delete it." Runs in one transaction that explicitly deletes this date's
 * four child-table rows alongside the parent (belt-and-suspenders next to the FK
 * `ON DELETE CASCADE` — some TiDB configs don't enforce it, docs/DB-MIGRATION.md §3.2),
 * mirroring `upsertDayLog`. Returns whether a parent row was actually removed. */
export async function deleteDayLog(date: CivilDate, tx?: Db): Promise<boolean> {
  const db = tx ?? getDb();
  return db.transaction(async (t) => {
    await t.delete(dayLogSymptoms).where(eq(dayLogSymptoms.date, date));
    await t.delete(dayLogMoods).where(eq(dayLogMoods.date, date));
    await t.delete(dayLogPainSites).where(eq(dayLogPainSites.date, date));
    await t.delete(dayLogPainInterference).where(eq(dayLogPainInterference.date, date));
    const [result] = await t.delete(dayLogs).where(eq(dayLogs.date, date));
    return result.affectedRows === 1;
  });
}

/** Hard delete of every day log — used only by the export/delete "permanent delete"
 * flow (app/api/delete-all/route.ts). Runs in one transaction that explicitly empties the
 * four child tables alongside the parent (belt-and-suspenders next to FK
 * `ON DELETE CASCADE` — some TiDB configs don't enforce it, docs/DB-MIGRATION.md §3.2),
 * so the permanent delete truly empties every day-log table even without FK cascade.
 * Returns the number of parent rows removed. */
export async function deleteAllDayLogs(tx?: Db): Promise<number> {
  const db = tx ?? getDb();
  return db.transaction(async (t) => {
    await t.delete(dayLogSymptoms);
    await t.delete(dayLogMoods);
    await t.delete(dayLogPainSites);
    await t.delete(dayLogPainInterference);
    const [result] = await t.delete(dayLogs);
    return result.affectedRows;
  });
}
