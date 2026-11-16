import { describe, expect, it } from "vitest";
import { envelope, timeContext, toolError, toolResult } from "./envelope";

// 2026-11-14T04:30:00.000Z — 11:30 in Bangkok, 23:30 the previous day in New York.
const NOW = Date.UTC(2026, 10, 14, 4, 30);

describe("timeContext", () => {
  it("states the zone, its source, the local day and now as UTC + local", () => {
    expect(timeContext({ timeZone: "Asia/Bangkok", source: "profile" }, NOW)).toEqual({
      timeZone: "Asia/Bangkok",
      timeZoneSource: "profile",
      today: "2026-11-14",
      now: { utc: "2026-11-14T04:30:00.000Z", local: "2026-11-14T11:30:00.000+07:00" },
    });
  });

  it("uses the user's local day, not the UTC day", () => {
    expect(timeContext({ timeZone: "America/New_York", source: "input" }, NOW)).toEqual({
      timeZone: "America/New_York",
      timeZoneSource: "input",
      today: "2026-11-13",
      now: { utc: "2026-11-14T04:30:00.000Z", local: "2026-11-13T23:30:00.000-05:00" },
    });
  });

  it("reports the UTC fallback as such", () => {
    expect(timeContext({ timeZone: "UTC", source: "fallback_utc" }, NOW)).toEqual({
      timeZone: "UTC",
      timeZoneSource: "fallback_utc",
      today: "2026-11-14",
      now: { utc: "2026-11-14T04:30:00.000Z", local: "2026-11-14T04:30:00.000+00:00" },
    });
  });
});

describe("envelope", () => {
  it("wraps data in the time context", () => {
    const ctx = timeContext({ timeZone: "UTC", source: "fallback_utc" }, NOW);
    expect(envelope(ctx, { a: 1 })).toEqual({ ...ctx, data: { a: 1 } });
  });
});

describe("toolResult", () => {
  it("mirrors the structured content as a JSON text block", () => {
    const obj = { today: "2026-11-14", data: { n: 1 } };
    const res = toolResult(obj);
    expect(res.structuredContent).toBe(obj);
    expect(res.content).toEqual([{ type: "text", text: JSON.stringify(obj) }]);
    expect(JSON.parse(res.content[0].text)).toEqual(obj);
  });
});

describe("toolError", () => {
  it("returns a plain-language error flagged isError", () => {
    expect(toolError("No open period")).toEqual({
      isError: true,
      content: [{ type: "text", text: "No open period" }],
    });
  });
});
