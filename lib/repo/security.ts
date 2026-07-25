/**
 * `security` — a single row (`id = 1`) holding the optional 6-digit screen-lock PIN
 * (docs/DB-MIGRATION.md §3.9). Unlike the other repos this exposes no domain type: its
 * columns (a scrypt PIN hash, the cookie-signing secret, and throttling counters) are
 * server-internal and must never reach a client, so there is no `lib/domain/types.ts`
 * shape and no Zod schema for them — the row is used only by the server-side guard
 * (lib/security/guard.ts) and the app/api/security/** route handlers.
 *
 * Thin Drizzle wrapper, same shape as the other singleton repos (profile, calibration).
 */
import { eq } from "drizzle-orm";
import { getDb, security, type Db } from "@/lib/db";

/** The fixed id of the single security row (docs/DB-MIGRATION.md §3.9). */
export const SECURITY_ID = 1;

export type SecurityRow = typeof security.$inferSelect;

/** The current security row, or null before a PIN has ever been configured. */
export async function getSecurity(tx?: Db): Promise<SecurityRow | null> {
  const db = tx ?? getDb();
  const [row] = await db.select().from(security).where(eq(security.id, SECURITY_ID)).limit(1);
  return row ?? null;
}

/** Sets (or replaces) the PIN hash and signing secret, clearing any throttling state.
 * Upserts the singleton row. */
export async function setPin(pinHash: string, sessionSecret: string, tx?: Db): Promise<void> {
  const db = tx ?? getDb();
  const values = {
    id: SECURITY_ID,
    pinHash,
    sessionSecret,
    failedAttempts: 0,
    lockedUntil: null,
  };
  await db
    .insert(security)
    .values(values)
    .onDuplicateKeyUpdate({
      set: { pinHash, sessionSecret, failedAttempts: 0, lockedUntil: null },
    });
}

/** Turns the lock off: clears the PIN hash and rotates the signing secret so every
 * outstanding unlock session is invalidated. */
export async function clearPin(newSessionSecret: string, tx?: Db): Promise<void> {
  const db = tx ?? getDb();
  await db
    .insert(security)
    .values({
      id: SECURITY_ID,
      pinHash: null,
      sessionSecret: newSessionSecret,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .onDuplicateKeyUpdate({
      set: { pinHash: null, sessionSecret: newSessionSecret, failedAttempts: 0, lockedUntil: null },
    });
}

/** Persists the brute-force throttling counters after an unlock attempt. */
export async function setThrottle(
  failedAttempts: number,
  lockedUntil: number | null,
  tx?: Db,
): Promise<void> {
  const db = tx ?? getDb();
  await db.update(security).set({ failedAttempts, lockedUntil }).where(eq(security.id, SECURITY_ID));
}

/** Hard delete — part of the "permanent delete" flow (app/api/delete-all). Removing the
 * row turns the lock off entirely. */
export async function deleteSecurity(tx?: Db): Promise<boolean> {
  const db = tx ?? getDb();
  const [result] = await db.delete(security).where(eq(security.id, SECURITY_ID));
  return (result.affectedRows ?? 0) === 1;
}
