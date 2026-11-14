import { describe, expect, it } from "vitest";
import {
  canonicalTimeZone,
  isValidTimeZone,
  resolveTimeZone,
  timeZoneCookieMatches,
} from "./userTimeZone";

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

describe("canonicalTimeZone", () => {
  it("maps a case-variant ID to its canonical name", () => {
    expect(canonicalTimeZone("asia/bangkok")).toBe("Asia/Bangkok");
  });

  it("leaves a canonical ID unchanged", () => {
    expect(canonicalTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
  });
});

describe("timeZoneCookieMatches", () => {
  it("matches the URL-encoded cookie the route sets", () => {
    expect(timeZoneCookieMatches("Asia%2FBangkok", "Asia/Bangkok")).toBe(true);
  });

  it("matches aliases the server canonicalised differently", () => {
    // Node's ICU stores Asia/Kolkata as Asia/Calcutta; without this every load would re-POST.
    const cookie = encodeURIComponent(canonicalTimeZone("Asia/Kolkata"));
    expect(timeZoneCookieMatches(cookie, "Asia/Kolkata")).toBe(true);
  });

  it.each([undefined, "", "Europe%2FBerlin", "Not%2FAZone", "%E0%A4%A"])(
    "does not match %j",
    (cookie) => {
      expect(timeZoneCookieMatches(cookie, "Asia/Bangkok")).toBe(false);
    },
  );
});
