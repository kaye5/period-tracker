/**
 * Drizzle test-DB helper (DEC-011, supersedes the in-memory Mongo `FakeCollection` this
 * file used to export). Every `lib/repo/*.ts` function's optional trailing parameter is
 * now `tx?: Db` (docs/DB-MIGRATION.md's "the seam"), so repo/integration tests exercise
 * the real relational round-trip against a live MySQL instead of an in-memory fake — the
 * mapping-fidelity coverage that used to live here moves to each repo's
 * `*.mapping.test.ts` (pure functions, no database at all).
 *
 * This module connects to `process.env.DATABASE_URL` via the shared `lib/db/client.ts`
 * pool (the integration tests call repo functions bare, so they necessarily hit whatever
 * `getDb()` is pointed at — there is exactly one connection module in this codebase).
 *
 * DESTRUCTIVE — READ THIS. `truncateAll` empties EVERY table. Because the tests use the
 * app's own connection, running them against your real `DATABASE_URL` would wipe your
 * data (this is exactly how the dev database got emptied once). Two guardrails prevent
 * that now:
 *   1. `truncateAll` refuses to run unless the target database name ends in `_test`
 *      (or `ALLOW_DESTRUCTIVE_TESTS=1` is set) — so it can never wipe `period_tracker`.
 *   2. `pnpm test:integration` points `DATABASE_URL` at the dedicated `period_tracker_test`
 *      database (created by scripts/mysql-init / docker-compose). Always run the
 *      integration suite that way, never against the app database.
 *
 * `describeIfDb`/`itIfDb` guard every test that needs a live database: when
 * `DATABASE_URL` is unset they become `describe.skip`/`it.skip`, so plain `pnpm test`
 * (no Docker, no env) stays green everywhere, per docs/DB-MIGRATION.md §4.2. Only
 * `lib/repo/__integration__/*.itest.ts` uses them; unit tests for pure mapping functions
 * need no database and therefore no guard at all.
 */
import { describe, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb, closeDb, type Db } from "@/lib/db/client";

/** True iff a live database is configured for this process. Every other export in this
 * file is meaningless without it — check this first if you need to branch instead of
 * using `describeIfDb`/`itIfDb` (e.g. inside a single `it`). */
export const hasDb: boolean = Boolean(process.env.DATABASE_URL);

/** The database name from `DATABASE_URL` (e.g. `period_tracker_test`), or "" if unset. */
function currentDatabaseName(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).pathname.replace(/^\//, "").split("?")[0];
  } catch {
    return "";
  }
}

/**
 * Throws unless the configured database is safe to wipe. The integration suite is
 * destructive (`truncateAll` empties every table), and because the tests use the app's
 * own `getDb()` connection, an accidental run against the real `DATABASE_URL` would
 * delete real data. A run is allowed only when the database name ends in `_test`, or when
 * `ALLOW_DESTRUCTIVE_TESTS=1` is set as a deliberate override. Call this before any
 * destructive test operation.
 */
export function assertDestructiveTestsAllowed(): void {
  const name = currentDatabaseName();
  const allowed = name.endsWith("_test") || process.env.ALLOW_DESTRUCTIVE_TESTS === "1";
  if (!allowed) {
    throw new Error(
      `Refusing to run destructive integration tests against database "${name || "(unset)"}": ` +
        `they wipe every table. Run \`pnpm test:integration\` (which points DATABASE_URL at ` +
        `period_tracker_test), or set ALLOW_DESTRUCTIVE_TESTS=1 to override deliberately.`,
    );
  }
}

/** `describe.skip` when `DATABASE_URL` is unset, `describe` otherwise. Use to wrap every
 * `describe` block in an `.itest.ts` file. */
export const describeIfDb = hasDb ? describe : describe.skip;

/** `it.skip` when `DATABASE_URL` is unset, `it` otherwise. Use for any bare `it` outside
 * a `describeIfDb` block (rare — prefer wrapping the whole `describe`). */
export const itIfDb = hasDb ? it : it.skip;

/**
 * Every table this schema defines, in FK-safe delete order (children before the parents
 * they reference) — used only as a fallback path; the primary path below disables FK
 * checks for the whole truncate and so does not actually depend on this order, but it is
 * kept correct anyway in case a caller ever truncates with checks left on.
 */
const TABLES_CHILD_TO_PARENT = [
  "day_log_symptoms",
  "day_log_moods",
  "day_log_pain_sites",
  "day_log_pain_interference",
  "day_logs",
  "calibration_coverage",
  "calibration",
  "predictions",
  "excluded_cycles",
  "skip_prompt_decisions",
  "health_message_decisions",
  "profile",
] as const;

/**
 * Hands back the shared Drizzle handle (`lib/db/client.ts`'s cached pool) — the same
 * handle production code gets from `getDb()`, re-exported here under a test-oriented
 * name so call sites in `__integration__/*.itest.ts` read as "the test database" without
 * implying a second, separate connection exists.
 */
export function getTestDb(): Db {
  return getDb();
}

/**
 * Applies every pending migration in `./drizzle` (generated by `drizzle-kit generate` —
 * see docs/DB-MIGRATION.md §1) against whatever `DATABASE_URL` points at. Idempotent:
 * drizzle's migrator tracks applied migrations in `__drizzle_migrations` and no-ops for
 * ones already applied, so this is safe to call at the top of every integration test
 * file (or once in a global setup) without worrying about call order across files.
 */
export async function ensureMigrationsApplied(db: Db = getTestDb()): Promise<void> {
  await migrate(db, { migrationsFolder: "./drizzle" });
}

/**
 * Empties every table between tests. Disables FK checks for the duration so the actual
 * `TRUNCATE` order never matters (belt-and-suspenders for the same reason
 * docs/DB-MIGRATION.md §3.2 has repos delete child rows explicitly: some TiDB configs
 * don't enforce FK cascade the same way MySQL does) — this only runs against MySQL in
 * tests, but keeping the same "don't rely on cascade" posture here avoids a second set
 * of assumptions to maintain.
 */
export async function truncateAll(db: Db = getTestDb()): Promise<void> {
  assertDestructiveTestsAllowed();
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  try {
    for (const table of TABLES_CHILD_TO_PARENT) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
    }
  } finally {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  }
}

/** Re-exported so `__integration__/*.itest.ts` files need only import from this module,
 * not reach into `lib/db/client.ts` directly, when they want to close the pool in an
 * `afterAll` (vitest processes normally exit fine without this, but a long-running watch
 * session benefits from not leaking connections across repeated runs). */
export { closeDb };
export type { Db };
