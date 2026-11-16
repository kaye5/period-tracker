import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repo/profile", () => ({ getUserTimeZone: async () => "UTC" }));
vi.mock("@/lib/cycleView/load", () => ({
  loadCycleData: async () => {
    throw new Error("Failed query: select * from day_logs params: 2026-11-16");
  },
}));

const { runReadTool, READ_FAILED } = await import("./read");

describe("runReadTool", () => {
  it("turns an unexpected error into a plain message, logged server-side only", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runReadTool(undefined, () => ({}));
    expect(result).toEqual({ isError: true, content: [{ type: "text", text: READ_FAILED }] });
    expect(error).toHaveBeenCalledOnce();
  });
});
