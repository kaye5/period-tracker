import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CivilDate } from "@/lib/date/civil";
import type { DayLog, Profile } from "@/lib/domain/types";
import { DEFAULT_PROFILE } from "@/lib/repo/profile";
import { DEFAULT_USER_DECISIONS } from "@/lib/repo/decisions";
import { DEFAULT_CALIBRATION_STATE } from "@/lib/repo/calibration";

const getProfile = vi.fn<() => Promise<Profile | null>>();
const listAllDayLogs = vi.fn<() => Promise<DayLog[]>>();
vi.mock("@/lib/repo/profile", async (orig) => ({
  ...(await orig<object>()),
  getProfile: () => getProfile(),
}));
vi.mock("@/lib/repo/dayLogs", () => ({ listAllDayLogs: () => listAllDayLogs() }));
vi.mock("@/lib/repo/decisions", async (orig) => ({
  ...(await orig<object>()),
  getUserDecisions: async () => DEFAULT_USER_DECISIONS,
  listHealthMessageDecisions: async () => [],
}));
vi.mock("@/lib/repo/calibration", async (orig) => ({
  ...(await orig<object>()),
  getCalibrationState: async () => DEFAULT_CALIBRATION_STATE,
}));

const { loadCycleData } = await import("./load");

const log = (date: string): DayLog => ({
  date: date as CivilDate,
  bleeding: "menstrual",
  pain: { severity: "none" },
  symptoms: [],
  loggedAt: date as CivilDate,
});

beforeEach(() => {
  // 2026-11-16T03:00Z: still the 15th in New York, already the 16th in Tokyo.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 10, 16, 3));
  getProfile.mockReset().mockResolvedValue(DEFAULT_PROFILE);
  listAllDayLogs.mockReset().mockResolvedValue([log("2026-11-01"), log("2026-11-02")]);
});
afterEach(() => vi.useRealTimers());

describe("loadCycleData", () => {
  it("computes today in the given zone, not the host's", async () => {
    expect((await loadCycleData("America/New_York")).today).toBe("2026-11-15");
    expect((await loadCycleData("Asia/Tokyo")).today).toBe("2026-11-16");
  });

  it("returns logs, the by-date lookup, engine output and calendar inputs", async () => {
    const data = await loadCycleData("UTC");
    expect(data.timeZone).toBe("UTC");
    expect(data.dayLogs).toHaveLength(2);
    expect(data.logsByDate.get("2026-11-02" as CivilDate)?.date).toBe("2026-11-02");
    expect(data.output).not.toBeNull();
    expect(data.calendar).toMatchObject({ dayLogs: data.dayLogs, weekStartsOn: 0 });
  });

  it("starts the week on Monday for en-GB and falls back to the reported period length", async () => {
    getProfile.mockResolvedValue({
      ...DEFAULT_PROFILE,
      reportedTypicalPeriodDays: 6,
      settings: { ...DEFAULT_PROFILE.settings, locale: "en-GB" },
    });
    listAllDayLogs.mockResolvedValue([]);
    const { calendar } = await loadCycleData("UTC");
    expect(calendar).toMatchObject({ weekStartsOn: 1, typicalPeriodDays: 6 });
  });

  it("returns null output and calendar (no redirect) when there is no profile", async () => {
    getProfile.mockResolvedValue(null);
    const data = await loadCycleData("UTC");
    expect(data).toMatchObject({ profile: null, output: null, calendar: null });
    expect(data.dayLogs).toHaveLength(2);
  });
});
