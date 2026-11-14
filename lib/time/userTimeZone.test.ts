import { describe, expect, it } from "vitest";
import { isValidTimeZone, resolveTimeZone } from "./userTimeZone";

const INVALID: unknown[] = ["", "Not/AZone", 123, null, undefined, "A".repeat(65)];

describe("isValidTimeZone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Bangkok")).toBe(true);
  });

  it.each(INVALID)("rejects %j without throwing", (tz) => {
    expect(isValidTimeZone(tz)).toBe(false);
  });
});

describe("resolveTimeZone", () => {
  it("prefers input, then cookie, then profile", () => {
    const all = { input: "Asia/Bangkok", cookie: "Europe/Berlin", profile: "America/New_York" };
    expect(resolveTimeZone(all)).toEqual({ timeZone: "Asia/Bangkok", source: "input" });
    expect(resolveTimeZone({ ...all, input: undefined })).toEqual({
      timeZone: "Europe/Berlin",
      source: "cookie",
    });
    expect(resolveTimeZone({ profile: "America/New_York" })).toEqual({
      timeZone: "America/New_York",
      source: "profile",
    });
  });

  it.each(INVALID)("skips the invalid candidate %j", (bad) => {
    expect(resolveTimeZone({ input: bad, cookie: "Europe/Berlin" }).source).toBe("cookie");
    expect(resolveTimeZone({ cookie: bad, profile: "Asia/Bangkok" }).source).toBe("profile");
    expect(resolveTimeZone({ input: bad, cookie: bad, profile: bad })).toEqual({
      timeZone: "UTC",
      source: "fallback_utc",
    });
  });

  it("falls back to UTC, flagged, when nothing is given", () => {
    expect(resolveTimeZone({})).toEqual({ timeZone: "UTC", source: "fallback_utc" });
  });
});
