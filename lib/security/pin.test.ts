import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, newSessionSecret, verifyPin } from "@/lib/security/pin";

describe("isValidPin", () => {
  it("accepts exactly six digits", () => {
    expect(isValidPin("000000")).toBe(true);
    expect(isValidPin("135790")).toBe(true);
  });

  it("rejects anything that is not exactly six digits", () => {
    for (const bad of ["", "12345", "1234567", "12a456", "12 456", " 123456", "123456 "]) {
      expect(isValidPin(bad)).toBe(false);
    }
  });
});

describe("hashPin / verifyPin", () => {
  it("produces a self-describing scrypt hash that round-trips", () => {
    const stored = hashPin("135790");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored.split("$")).toHaveLength(3);
    expect(verifyPin("135790", stored)).toBe(true);
  });

  it("uses a random salt so the same PIN hashes differently each time", () => {
    expect(hashPin("135790")).not.toBe(hashPin("135790"));
  });

  it("rejects the wrong PIN", () => {
    const stored = hashPin("135790");
    expect(verifyPin("135791", stored)).toBe(false);
    expect(verifyPin("000000", stored)).toBe(false);
  });

  it("throws when asked to hash a malformed PIN", () => {
    expect(() => hashPin("12345")).toThrow();
    expect(() => hashPin("abcdef")).toThrow();
  });

  it("returns false (never throws) for malformed input or hash", () => {
    const stored = hashPin("135790");
    expect(verifyPin("12345", stored)).toBe(false); // bad candidate
    expect(verifyPin("135790", null)).toBe(false);
    expect(verifyPin("135790", "")).toBe(false);
    expect(verifyPin("135790", "bcrypt$deadbeef$cafe")).toBe(false); // unknown algo
    expect(verifyPin("135790", "scrypt$only-two-parts")).toBe(false);
  });
});

describe("newSessionSecret", () => {
  it("is 64 hex chars and unique per call", () => {
    const a = newSessionSecret();
    const b = newSessionSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});
