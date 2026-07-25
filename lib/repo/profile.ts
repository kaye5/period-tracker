/**
 * `profile` is a single row (`id = 1` — DB-MIGRATION.md §3.3). Every read/write is
 * Zod-validated at the boundary (SPEC.md's G brief, carried forward by DB-MIGRATION.md).
 * All row <-> domain conversion lives in lib/repo/profile.mapping.ts; this file is a thin
 * Drizzle wrapper around it.
 */
import { eq } from "drizzle-orm";
import type { Profile } from "@/lib/domain/types";
import { profileSchema } from "@/lib/domain/schema";
import { getDb, type Db } from "@/lib/db";
import { profile as profileTable } from "@/lib/db/schema";
import { PROFILE_ID, fromRow, toRow, type ProfileRow } from "@/lib/repo/profile.mapping";

/**
 * The profile that exists before onboarding has ever written one. Deliberately
 * conservative — every opt-in setting SPEC.md calls out as "default false" stays false,
 * and every setting SPEC.md is silent on also defaults to the least assuming option
 * (SPEC.md's "never assume the user's goal" spirit from the U1 brief applies just as
 * much to what the data layer hands back before onboarding runs).
 */
export const DEFAULT_PROFILE: Profile = {
  state: {
    pregnant: false,
    breastfeeding: false,
    perimenopauseSelfDeclared: false,
    menopauseSelfDeclared: false,
    knownIrregular: false,
    preferNotToSay: false,
  },
  settings: {
    fertilityEnabled: false,
    tierCSymptomsEnabled: false,
    healthAwarenessEnabled: true,
    notifications: {
      periodReminder: false,
      fertileReminder: false,
      symptomReminder: false,
      medicationReminder: false,
      loggingReminder: false,
      healthAwareness: false,
      privateWording: true, // SPEC.md §3's explicit DEFAULT
    },
    locale: "en-US",
  },
};

/** Re-validates a row read back off the wire, same discipline the Mongo-backed version
 * used ("a document written by an older shape must not crash a screen"). */
function toProfile(row: ProfileRow): Profile {
  return profileSchema.parse(fromRow(row));
}

export async function getProfile(tx?: Db): Promise<Profile | null> {
  const db = tx ?? getDb();
  const rows = await db.select().from(profileTable).where(eq(profileTable.id, PROFILE_ID)).limit(1);
  const row = rows[0];
  return row ? toProfile(row) : null;
}

/** Same as `getProfile`, but returns `DEFAULT_PROFILE` instead of `null` — the shape
 * app/api/compute (and anything else that always needs *a* profile to run) wants. */
export async function getProfileOrDefault(tx?: Db): Promise<Profile> {
  const profile = await getProfile(tx);
  return profile ?? DEFAULT_PROFILE;
}

export async function upsertProfile(input: Profile, tx?: Db): Promise<Profile> {
  const db = tx ?? getDb();
  const validated = profileSchema.parse(input);
  const row = toRow(validated);
  await db.insert(profileTable).values(row).onDuplicateKeyUpdate({ set: row });
  return validated;
}

/** Hard delete — part of the "permanent delete" flow. */
export async function deleteProfile(tx?: Db): Promise<boolean> {
  const db = tx ?? getDb();
  const [result] = await db.delete(profileTable).where(eq(profileTable.id, PROFILE_ID));
  return result.affectedRows === 1;
}
