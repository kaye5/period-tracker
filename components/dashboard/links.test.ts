import { describe, expect, it } from "vitest";
import type { CivilDate } from "@/lib/date/civil";
import { historyHref } from "./links";

const d = (s: string) => s as CivilDate;

describe("historyHref", () => {
  it("links to plain /history with no dates", () => {
    expect(historyHref([])).toBe("/history");
  });

  it("sorts dates chronologically and joins them into the query string", () => {
    expect(historyHref([d("2026-07-29"), d("2026-07-26"), d("2026-07-27")])).toBe(
      "/history?dates=2026-07-26%2C2026-07-27%2C2026-07-29",
    );
  });
});
