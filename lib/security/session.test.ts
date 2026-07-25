import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  SESSION_TTL_MS,
  verifySessionToken,
} from "@/lib/security/session";
import { newSessionSecret } from "@/lib/security/pin";

// A fixed instant so these tests never touch the real clock (the module takes `now`
// explicitly for exactly this reason).
const NOW = 1_700_000_000_000;

describe("createSessionToken / verifySessionToken", () => {
  it("verifies a fresh token signed with the same secret", () => {
    const secret = newSessionSecret();
    const token = createSessionToken(secret, NOW);
    expect(verifySessionToken(token, secret, NOW)).toBe(true);
    // Still valid just before expiry...
    expect(verifySessionToken(token, secret, NOW + SESSION_TTL_MS - 1)).toBe(true);
  });

  it("rejects an expired token", () => {
    const secret = newSessionSecret();
    const token = createSessionToken(secret, NOW);
    expect(verifySessionToken(token, secret, NOW + SESSION_TTL_MS + 1)).toBe(false);
  });

  it("rejects a token signed with a different secret (e.g. after PIN removal rotates it)", () => {
    const token = createSessionToken(newSessionSecret(), NOW);
    expect(verifySessionToken(token, newSessionSecret(), NOW)).toBe(false);
  });

  it("rejects a tampered payload or signature", () => {
    const secret = newSessionSecret();
    const token = createSessionToken(secret, NOW);
    const [payload, sig] = token.split(".");
    expect(verifySessionToken(`${payload}x.${sig}`, secret, NOW)).toBe(false);
    expect(verifySessionToken(`${payload}.${sig}00`, secret, NOW)).toBe(false);
    expect(verifySessionToken(`${payload}.deadbeef`, secret, NOW)).toBe(false);
  });

  it("rejects missing or malformed tokens without throwing", () => {
    const secret = newSessionSecret();
    expect(verifySessionToken(null, secret, NOW)).toBe(false);
    expect(verifySessionToken(undefined, secret, NOW)).toBe(false);
    expect(verifySessionToken("", secret, NOW)).toBe(false);
    expect(verifySessionToken("no-dot-here", secret, NOW)).toBe(false);
    expect(verifySessionToken(".sig", secret, NOW)).toBe(false);
    expect(verifySessionToken(createSessionToken(secret, NOW), null, NOW)).toBe(false);
  });
});
