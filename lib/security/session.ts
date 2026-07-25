/**
 * Signed unlock-session cookie for the app's screen lock.
 *
 * Server-only (node:crypto). A session token proves the browser entered the correct PIN
 * recently. It is NOT a bearer of any data — just a timestamped, HMAC-signed marker:
 *
 *     <base64url(JSON payload)>.<hmac-sha256 hex>
 *
 * The signing key is the per-install `session_secret` from the `security` table
 * (lib/repo/security.ts), so a token can only be minted server-side, and rotating that
 * secret (which happens when the PIN is removed) invalidates every outstanding session.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Cookie name for the unlock session. HttpOnly + SameSite=Lax, set by the unlock route. */
export const SESSION_COOKIE = "pt_unlock";

/** How long an unlock lasts before the PIN is required again. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

interface SessionPayload {
  /** Expiry, epoch milliseconds. */
  exp: number;
}

function sign(payloadB64: string, secretHex: string): string {
  return createHmac("sha256", Buffer.from(secretHex, "hex")).update(payloadB64).digest("hex");
}

/** Mints a signed token that expires `SESSION_TTL_MS` after `now`. */
export function createSessionToken(secretHex: string, now: number): string {
  const payload: SessionPayload = { exp: now + SESSION_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secretHex)}`;
}

/** True iff `token` is well-formed, signed by `secretHex`, and not expired at `now`.
 * Signature is compared in constant time; a bad shape or bad signature returns false
 * without throwing. */
export function verifySessionToken(
  token: string | null | undefined,
  secretHex: string | null | undefined,
  now: number,
): boolean {
  if (!token || !secretHex) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(payloadB64, secretHex);
  const a = Buffer.from(providedSig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}
