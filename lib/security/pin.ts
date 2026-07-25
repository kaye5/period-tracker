/**
 * PIN hashing + validation for the app's optional 6-digit screen lock.
 *
 * Server-only: this module imports node:crypto and must never be pulled into a client
 * bundle. It is only imported by route handlers (app/api/security/**) and the server-side
 * guard (lib/security/guard.ts).
 *
 * This is a UI screen lock, not encryption. A 6-digit PIN is low-entropy (one million
 * combinations); the throttling in app/api/security/unlock/route.ts is what makes it a
 * meaningful barrier. scrypt with a per-PIN random salt is used so a stored hash can't be
 * reversed with a precomputed table, but nothing here protects the database itself
 * (docs/PRIVACY.md).
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Exactly six ASCII digits. */
export const PIN_PATTERN = /^\d{6}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

const KEY_LENGTH = 32;

/** Hashes a 6-digit PIN into a self-describing "scrypt$<saltHex>$<hashHex>" string.
 * Throws on a malformed PIN so a bad value can never be silently stored. */
export function hashPin(pin: string): string {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 6 digits");
  }
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verification of a candidate PIN against a stored hash. Returns false for
 * any malformed input or unrecognised hash format rather than throwing. */
export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || !isValidPin(pin)) return false;
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length || KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A fresh random hex key for HMAC-signing session cookies (lib/security/session.ts). */
export function newSessionSecret(): string {
  return randomBytes(32).toString("hex");
}
