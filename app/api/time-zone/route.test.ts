import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUnlock = vi.fn();
const setUserTimeZone = vi.fn();
vi.mock("@/lib/security/guard", () => ({ requireApiUnlock: () => requireApiUnlock() }));
vi.mock("@/lib/repo/profile", () => ({
  setUserTimeZone: (tz: string) => setUserTimeZone(tz),
}));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/time-zone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  requireApiUnlock.mockReset().mockResolvedValue(null);
  setUserTimeZone.mockReset().mockResolvedValue(true);
});

describe("POST /api/time-zone", () => {
  it.each([{}, { timeZone: "Not/AZone" }, { timeZone: 5 }, "not json"])(
    "rejects %j with 400 and sets no cookie",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(setUserTimeZone).not.toHaveBeenCalled();
    },
  );

  it("canonicalises, sets the tz cookie and stores the zone when unlocked", async () => {
    const res = await post({ timeZone: "asia/bangkok" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timeZone: "Asia/Bangkok", stored: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^tz=Asia%2FBangkok;|^tz=Asia\/Bangkok;/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=31536000/);
    expect(cookie.toLowerCase()).toMatch(/samesite=lax/);
    expect(cookie).not.toMatch(/HttpOnly/i);
    expect(setUserTimeZone).toHaveBeenCalledWith("Asia/Bangkok");
  });

  it("still sets the cookie but does not store the zone when locked", async () => {
    requireApiUnlock.mockResolvedValue(NextResponse.json({ error: "Locked" }, { status: 401 }));
    const res = await post({ timeZone: "Europe/Berlin" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timeZone: "Europe/Berlin", stored: false });
    expect(res.headers.get("set-cookie")).toMatch(/^tz=Europe/);
    expect(setUserTimeZone).not.toHaveBeenCalled();
  });
});
