import { describe, expect, it } from "vitest";
import {
  addDays,
  compare,
  diffDays,
  isValid,
  max,
  min,
  monthGrid,
  parseCivil,
  rangeInclusive,
  toCivil,
  todayInZone,
  type CivilDate,
} from "./civil";

function weekday(date: CivilDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

describe("isValid", () => {
  it("accepts well-formed real calendar dates", () => {
    expect(isValid("2026-07-22")).toBe(true);
    expect(isValid("2000-01-01")).toBe(true);
    expect(isValid("2028-02-29")).toBe(true); // 2028 is a leap year
  });

  it("rejects malformed strings", () => {
    expect(isValid("2026-7-22")).toBe(false);
    expect(isValid("2026/07/22")).toBe(false);
    expect(isValid("26-07-22")).toBe(false);
    expect(isValid("not-a-date")).toBe(false);
    expect(isValid("")).toBe(false);
  });

  it("rejects out-of-range month/day and non-existent dates", () => {
    expect(isValid("2026-13-01")).toBe(false);
    expect(isValid("2026-00-01")).toBe(false);
    expect(isValid("2026-02-30")).toBe(false); // Feb never has 30 days
    expect(isValid("2027-02-29")).toBe(false); // 2027 is not a leap year
    expect(isValid("2026-04-31")).toBe(false); // April has 30 days
  });
});

describe("parseCivil / toCivil", () => {
  it("round-trips", () => {
    expect(parseCivil("2026-07-22")).toBe("2026-07-22");
    expect(toCivil(2026, 7, 22)).toBe("2026-07-22");
    expect(toCivil(2026, 1, 5)).toBe("2026-01-05");
  });

  it("throws on invalid input", () => {
    expect(() => parseCivil("2026-02-30")).toThrow();
    expect(() => toCivil(2026, 2, 30)).toThrow();
  });
});

describe("compare / min / max", () => {
  it("orders dates chronologically", () => {
    expect(compare(toCivil(2026, 1, 1), toCivil(2026, 1, 2))).toBe(-1);
    expect(compare(toCivil(2026, 1, 2), toCivil(2026, 1, 1))).toBe(1);
    expect(compare(toCivil(2026, 1, 1), toCivil(2026, 1, 1))).toBe(0);
    // year/month boundaries
    expect(compare(toCivil(2025, 12, 31), toCivil(2026, 1, 1))).toBe(-1);
  });

  it("min/max pick the right end", () => {
    const a = toCivil(2026, 3, 1);
    const b = toCivil(2026, 1, 15);
    const c = toCivil(2026, 6, 30);
    expect(min(a, b, c)).toBe(b);
    expect(max(a, b, c)).toBe(c);
  });
});

describe("addDays / diffDays — basic arithmetic", () => {
  it("adds and subtracts within a month", () => {
    expect(addDays(toCivil(2026, 7, 22), 1)).toBe("2026-07-23");
    expect(addDays(toCivil(2026, 7, 22), -1)).toBe("2026-07-21");
    expect(addDays(toCivil(2026, 7, 22), 0)).toBe("2026-07-22");
  });

  it("crosses a year boundary", () => {
    expect(addDays(toCivil(2025, 12, 31), 1)).toBe("2026-01-01");
    expect(diffDays(toCivil(2025, 12, 31), toCivil(2026, 1, 1))).toBe(1);
  });

  it("handles a leap day correctly", () => {
    expect(addDays(toCivil(2028, 2, 28), 1)).toBe("2028-02-29");
    expect(addDays(toCivil(2028, 2, 29), 1)).toBe("2028-03-01");
    expect(diffDays(toCivil(2028, 2, 28), toCivil(2028, 3, 1))).toBe(2);
    // Non-leap year: Feb 28 -> Mar 1 is only a 1-day gap.
    expect(addDays(toCivil(2027, 2, 28), 1)).toBe("2027-03-01");
    expect(diffDays(toCivil(2027, 2, 28), toCivil(2027, 3, 1))).toBe(1);
  });

  it("diffDays is the exact inverse of addDays", () => {
    expect(diffDays(toCivil(2026, 7, 22), toCivil(2026, 7, 22))).toBe(0);
    expect(diffDays(toCivil(2026, 7, 22), toCivil(2026, 7, 15))).toBe(-7);
  });
});

describe("addDays / diffDays — property round-trip across DST boundaries, both hemispheres", () => {
  // These dates are chosen to straddle real DST transitions (America/New_York spring-
  // forward/fall-back, Australia/Sydney's inverted southern-hemisphere equivalents), plus
  // a year boundary and a leap day. Because CivilDate arithmetic is pinned to UTC noon
  // (see civil.ts header), it must be completely insensitive to any of this — that
  // insensitivity is exactly the property under test.
  const probeDates: CivilDate[] = [
    toCivil(2026, 3, 7), // day before US spring-forward (2026-03-08)
    toCivil(2026, 3, 8),
    toCivil(2026, 3, 9),
    toCivil(2026, 11, 1), // US fall-back day
    toCivil(2026, 11, 2),
    toCivil(2026, 4, 4), // day before Sydney fall-back (2026-04-05)
    toCivil(2026, 4, 5),
    toCivil(2026, 4, 6),
    toCivil(2026, 10, 3), // day before Sydney spring-forward (2026-10-04)
    toCivil(2026, 10, 4),
    toCivil(2026, 10, 5),
    toCivil(2025, 12, 31), // year boundary
    toCivil(2026, 1, 1),
    toCivil(2028, 2, 28), // leap day
    toCivil(2028, 2, 29),
  ];
  const deltas = [-400, -30, -7, -1, 0, 1, 7, 30, 400];

  it("addDays(d, diffDays(d, e)) === e for every probe pair", () => {
    for (const d of probeDates) {
      for (const e of probeDates) {
        expect(addDays(d, diffDays(d, e))).toBe(e);
      }
    }
  });

  it("diffDays(d, addDays(d, n)) === n for every probe date and delta", () => {
    for (const d of probeDates) {
      for (const n of deltas) {
        expect(diffDays(d, addDays(d, n))).toBe(n);
      }
    }
  });
});

describe("todayInZone", () => {
  it("a user in UTC+13 logging at 00:30 local gets the correct (later) civil date, not the UTC date", () => {
    // Pacific/Tongatapu is a fixed UTC+13 zone (no DST), so this isolates the offset
    // behaviour from any DST complication.
    // 2026-07-23T00:30:00 in UTC+13 == 2026-07-22T11:30:00Z.
    const epochMs = Date.UTC(2026, 6, 22, 11, 30, 0);
    expect(todayInZone("Pacific/Tongatapu", epochMs)).toBe("2026-07-23");
    // The naive (wrong) approach of reading the UTC calendar date would give the 22nd.
    expect(todayInZone("UTC", epochMs)).toBe("2026-07-22");
  });

  it("a user just west of the date line (UTC-11) at 23:30 gets the earlier civil date", () => {
    // 2026-07-22T23:30:00 in UTC-11 == 2026-07-23T10:30:00Z.
    const epochMs = Date.UTC(2026, 6, 23, 10, 30, 0);
    expect(todayInZone("Pacific/Midway", epochMs)).toBe("2026-07-22");
    expect(todayInZone("UTC", epochMs)).toBe("2026-07-23");
  });

  it("resolves the correct date across the America/New_York spring-forward transition (2026-03-08)", () => {
    // 01:30 EST (UTC-5), just before the 2am skip to 3am EDT.
    expect(todayInZone("America/New_York", Date.UTC(2026, 2, 8, 6, 30))).toBe(
      "2026-03-08",
    );
    // 03:30 EDT (UTC-4), just after the skip — still the same calendar day.
    expect(todayInZone("America/New_York", Date.UTC(2026, 2, 8, 7, 30))).toBe(
      "2026-03-08",
    );
  });

  it("resolves the correct date across the America/New_York fall-back transition (2026-11-01)", () => {
    // 01:30 EDT (UTC-4), the first time this wall-clock hour occurs.
    expect(
      todayInZone("America/New_York", Date.UTC(2026, 10, 1, 5, 30)),
    ).toBe("2026-11-01");
    // 01:30 EST (UTC-5), the repeated hour after fall-back.
    expect(
      todayInZone("America/New_York", Date.UTC(2026, 10, 1, 6, 30)),
    ).toBe("2026-11-01");
  });

  it("resolves the correct date across the Australia/Sydney spring-forward transition (2026-10-04)", () => {
    // 01:30 AEST (UTC+10), just before the 2am skip to 3am AEDT.
    expect(
      todayInZone("Australia/Sydney", Date.UTC(2026, 9, 3, 15, 30)),
    ).toBe("2026-10-04");
    // 03:30 AEDT (UTC+11), just after the skip — same calendar day.
    expect(
      todayInZone("Australia/Sydney", Date.UTC(2026, 9, 3, 16, 30)),
    ).toBe("2026-10-04");
  });

  it("resolves the correct date across the Australia/Sydney fall-back transition (2026-04-05)", () => {
    // 02:30 AEDT (UTC+11), the first time this wall-clock hour occurs.
    expect(
      todayInZone("Australia/Sydney", Date.UTC(2026, 3, 4, 15, 30)),
    ).toBe("2026-04-05");
    // 02:30 AEST (UTC+10), the repeated hour after fall-back.
    expect(
      todayInZone("Australia/Sydney", Date.UTC(2026, 3, 4, 16, 30)),
    ).toBe("2026-04-05");
  });
});

describe("rangeInclusive", () => {
  it("includes both endpoints", () => {
    const r = rangeInclusive(toCivil(2026, 1, 29), toCivil(2026, 2, 2));
    expect(r).toEqual(["2026-01-29", "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("returns a single-element array when start === end", () => {
    expect(rangeInclusive(toCivil(2026, 1, 1), toCivil(2026, 1, 1))).toEqual([
      "2026-01-01",
    ]);
  });

  it("returns an empty array when end precedes start", () => {
    expect(rangeInclusive(toCivil(2026, 1, 2), toCivil(2026, 1, 1))).toEqual(
      [],
    );
  });
});

describe("monthGrid", () => {
  it("produces full 7-day weeks that fully cover the month, Sunday-start", () => {
    const grid = monthGrid(2026, 7, 0);
    for (const week of grid) {
      expect(week).toHaveLength(7);
      expect(weekday(week[0])).toBe(0); // Sunday
    }
    const flat = grid.flat();
    expect(flat).toContain("2026-07-01");
    expect(flat).toContain("2026-07-31");
  });

  it("produces full 7-day weeks that fully cover the month, Monday-start", () => {
    const grid = monthGrid(2026, 7, 1);
    for (const week of grid) {
      expect(week).toHaveLength(7);
      expect(weekday(week[0])).toBe(1); // Monday
    }
    const flat = grid.flat();
    expect(flat).toContain("2026-07-01");
    expect(flat).toContain("2026-07-31");
  });

  it("handles February in a leap year", () => {
    const grid = monthGrid(2028, 2, 1);
    const flat = grid.flat();
    expect(flat).toContain("2028-02-01");
    expect(flat).toContain("2028-02-29");
  });

  it("weeks are contiguous and in order", () => {
    const grid = monthGrid(2026, 12, 0);
    const flat = grid.flat();
    for (let i = 1; i < flat.length; i++) {
      expect(diffDays(flat[i - 1], flat[i])).toBe(1);
    }
  });
});
