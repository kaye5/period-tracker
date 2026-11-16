import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { DayLog, MoodId } from "@/lib/domain/types";

const TODAY = parseCivil("2026-11-16");
const withMoods = (mood: MoodId[]): DayLog => ({ date: TODAY, bleeding: "none", pain: { severity: "none" }, symptoms: [], mood, loggedAt: TODAY });

/** A one-day fake repo: the saved log and its version (updated_at, epoch ms). */
let saved: DayLog | null;
let version: number | null;
const save = (log: DayLog) => {
  saved = log;
  version = (version ?? 0) + 1;
};

const upsertDayLogIfUnchanged = vi.fn(async (log: DayLog, expected: number | null) => {
  if (version !== expected) return { ok: false as const };
  save(log);
  return { ok: true as const, dayLog: log };
});

vi.mock("@/lib/repo/dayLogs", () => ({
  listDayLogUpdatedAt: async () => new Map(saved ? [[TODAY, version]] : []),
  getDayLogUpdatedAt: async () => version,
  upsertDayLogIfUnchanged: (log: DayLog, expected: number | null) => upsertDayLogIfUnchanged(log, expected),
}));
vi.mock("@/lib/repo/profile", () => ({ getUserTimeZone: async () => "UTC" }));
const loadCycleData = vi.fn(async () => ({
  profile: { settings: { tierCSymptomsEnabled: false } },
  output: { cycles: [] },
  today: TODAY,
  logsByDate: new Map(saved ? [[TODAY, saved]] : []),
}));
vi.mock("@/lib/cycleView/load", () => ({ loadCycleData: () => loadCycleData() }));
vi.mock("@/lib/mcp/present", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  presentToday: () => ({}),
}));

const { runWriteTool, WRITE_CONFLICT, WRITE_FAILED } = await import("./write");

const moodsOf = (log: DayLog | null) => [...(log?.mood ?? [])].sort();
const logMood = (moods: MoodId[]) => runWriteTool(undefined, { tool: "log_mood", moods });
const text = (r: Awaited<ReturnType<typeof runWriteTool>>) => (r.content[0] as { text: string }).text;

beforeEach(() => {
  saved = null;
  version = null;
  upsertDayLogIfUnchanged.mockClear();
  loadCycleData.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runWriteTool concurrency", () => {
  it("re-plans on a conflicting save and keeps both changes", async () => {
    // Another tool's save lands between this call's load and its save.
    upsertDayLogIfUnchanged.mockImplementationOnce(async () => {
      save(withMoods(["calm"]));
      return { ok: false };
    });
    const result = await logMood(["happy"]);
    expect(result).not.toHaveProperty("isError");
    expect(upsertDayLogIfUnchanged).toHaveBeenCalledTimes(2);
    expect(moodsOf(saved)).toEqual(["calm", "happy"]);
  });

  it.each([
    ["deadlock", { code: "ER_LOCK_DEADLOCK" }],
    ["duplicate key wrapped by Drizzle", Object.assign(new Error("Failed query: insert … params: …"), { cause: { code: "ER_DUP_ENTRY" } })],
  ])("treats a %s from a racing insert as a retry", async (_, error) => {
    upsertDayLogIfUnchanged.mockRejectedValueOnce(error);
    const result = await logMood(["happy"]);
    expect(result).not.toHaveProperty("isError");
    expect(moodsOf(saved)).toEqual(["happy"]);
  });

  it("gives up after 3 attempts with a plain-language conflict error", async () => {
    for (let i = 0; i < 3; i++) upsertDayLogIfUnchanged.mockResolvedValueOnce({ ok: false });
    expect(await logMood(["happy"])).toEqual({ isError: true, content: [{ type: "text", text: WRITE_CONFLICT }] });
    expect(upsertDayLogIfUnchanged).toHaveBeenCalledTimes(3);
    expect(saved).toBeNull();
  });

  it("does not save when nothing changes", async () => {
    save(withMoods(["happy"]));
    const result = await logMood(["happy"]);
    expect(result).not.toHaveProperty("isError");
    expect(upsertDayLogIfUnchanged).not.toHaveBeenCalled();
  });
});

describe("runWriteTool unexpected errors", () => {
  it.each([
    ["the load", () => loadCycleData.mockRejectedValueOnce(new Error("connect ECONNREFUSED SELECT * FROM day_logs"))],
    ["the save", () => upsertDayLogIfUnchanged.mockRejectedValueOnce(new Error("Failed query: insert into day_logs params: 2026-11-16"))],
  ])("turns an error in %s into a plain message, logged server-side only", async (_, arrange) => {
    arrange();
    const result = await logMood(["happy"]);
    expect(result).toEqual({ isError: true, content: [{ type: "text", text: WRITE_FAILED }] });
    expect(text(result)).not.toMatch(/ECONNREFUSED|Failed query|day_logs/);
    expect(console.error).toHaveBeenCalledOnce();
  });
});
