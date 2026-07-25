/**
 * Drizzle/mysql2 connection module (DEC-011, the storage layer this file was migrated
 * to). Single-user app, one shared connection pool, reused across Next.js
 * hot reloads via the standard globalThis cache pattern — without it, every dev-server
 * edit would re-evaluate this module and open a fresh pool, eventually exhausting the
 * database's connection limit.
 *
 * Dialect is mysql (mysql2 driver), which is wire-compatible with TiDB — the same code
 * serves local Docker MySQL, hosted MySQL, and TiDB Cloud. The only difference is
 * `DATABASE_URL` and whether `DATABASE_SSL` is set (TiDB Cloud requires TLS).
 *
 * This file does real I/O (network connections, environment variable reads). SPEC.md
 * R3's "no I/O" rule governs lib/engine/**, lib/date/**, and lib/stat/** only — the data
 * layer is precisely where I/O is supposed to live.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql, { type Pool } from "mysql2/promise";
import * as schema from "@/lib/db/schema";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local, fill in real values, " +
        "and make sure it's loaded (Next.js does this automatically; scripts must pass " +
        "`--env-file-if-exists .env.local` explicitly — see package.json's db:* scripts).",
    );
  }
  return url;
}

function createDb(pool: Pool) {
  return drizzle(pool, { schema, mode: "default" });
}

/** The Drizzle mysql2 database handle type, parameterized by this app's schema. Also
 * usable as the type for a transaction handle (the `tx` param drizzle's
 * `db.transaction(async (tx) => ...)` callback receives) — every `lib/repo/*.ts`
 * function's optional trailing param is typed `tx?: Db`. */
export type Db = ReturnType<typeof createDb>;

interface GlobalDbCache {
  pool: Pool | null;
  db: Db | null;
}

declare global {
  var __periodTrackerDb: GlobalDbCache | undefined;
}

function cache(): GlobalDbCache {
  if (!globalThis.__periodTrackerDb) {
    globalThis.__periodTrackerDb = { pool: null, db: null };
  }
  return globalThis.__periodTrackerDb;
}

/** Returns the shared Drizzle database handle, creating the underlying mysql2 pool on
 * first call. Safe to call repeatedly — connects once per process (or once per
 * globalThis cache, which is the same thing outside hot reload). */
export function getDb(): Db {
  const c = cache();
  if (c.db) return c.db;

  const url = requireDatabaseUrl();
  const useSsl = Boolean(process.env.DATABASE_SSL);
  const pool = mysql.createPool({
    uri: url,
    // Small pool: a single-user app talking to one database has no need for a large
    // connection pool.
    connectionLimit: 10,
    ...(useSsl ? { ssl: {} } : {}),
  });
  c.pool = pool;
  c.db = createDb(pool);
  return c.db;
}

/**
 * Closes the shared pool and clears the cache. For scripts (scripts/seed.ts,
 * lib/db/migrate.ts) and tests only — Next.js route handlers must never call this,
 * since the entire point of the cache above is to keep the pool alive across requests
 * and hot reloads.
 */
export async function closeDb(): Promise<void> {
  const c = cache();
  if (c.pool) {
    await c.pool.end();
  }
  c.pool = null;
  c.db = null;
}
