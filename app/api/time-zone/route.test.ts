import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireApiUnlock = vi.fn();
const getTimeZoneSetting = vi.fn();
const setUserTimeZone = vi.fn();
vi.mock("@/lib/security/guard", () => ({ requireApiUnlock: () => requireApiUnlock() }));
vi.mock("@/lib/repo/profile", () => ({
  getTimeZoneSetting: () => getTimeZoneSetting(),
  setUserTimeZone: (...args: unknown[]) => setUserTimeZone(...args),
}));

const { GET, POST, PUT } = await import("./route");

function post(body: unknown, method: "POST" | "PUT" = "POST") {
  return (method === "POST" ? POST : PUT)(
    new Request("http://localhost/api/time-zone", {
      method,
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  requireApiUnlock.mockReset().mockResolvedValue(null);
  getTimeZoneSetting.mockReset().mockResolvedValue({ timeZone: "Europe/Berlin", manual: false });
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

  it("canonicalises, stores the zone and sets the tz cookie when unlocked with a profile", async () => {
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

  it("neither stores the zone nor sets the cookie when locked", async () => {
    requireApiUnlock.mockResolvedValue(NextResponse.json({ error: "Locked" }, { status: 401 }));
    const res = await post({ timeZone: "Europe/Berlin" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timeZone: "Europe/Berlin", stored: false });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(setUserTimeZone).not.toHaveBeenCalled();
  });

  it("neither stores the zone nor sets the cookie before onboarding (no profile)", async () => {
    getTimeZoneSetting.mockResolvedValue(null);
    const res = await post({ timeZone: "Europe/Berlin" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timeZone: "Europe/Berlin", stored: false });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(setUserTimeZone).not.toHaveBeenCalled();
  });

  it("keeps a zone picked by hand: stores nothing and points the cookies at it", async () => {
    getTimeZoneSetting.mockResolvedValue({ timeZone: "Asia/Tokyo", manual: true });
    const res = await post({ timeZone: "Europe/Berlin" });
    expect(await res.json()).toEqual({ timeZone: "Asia/Tokyo", stored: false, manual: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/tz=Asia%2FTokyo|tz=Asia\/Tokyo/);
    expect(cookie).toMatch(/tz_manual=1;.*Max-Age=86400/);
    expect(setUserTimeZone).not.toHaveBeenCalled();
  });

  it("clears the manual cookie when it stores the browser's zone", async () => {
    const res = await post({ timeZone: "Europe/Berlin" });
    expect(res.headers.get("set-cookie")).toMatch(/tz_manual=;/);
  });
});

describe("GET /api/time-zone", () => {
  it("returns the stored setting", async () => {
    expect(await (await GET()).json()).toEqual({ timeZone: "Europe/Berlin", manual: false });
  });

  it("returns an empty setting before onboarding", async () => {
    getTimeZoneSetting.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ timeZone: null, manual: false });
  });

  it("is refused while locked", async () => {
    requireApiUnlock.mockResolvedValue(NextResponse.json({ error: "Locked" }, { status: 401 }));
    expect((await GET()).status).toBe(401);
    expect(getTimeZoneSetting).not.toHaveBeenCalled();
  });
});

describe("PUT /api/time-zone", () => {
  it("pins a zone by hand and sets both cookies", async () => {
    const res = await post({ timeZone: "asia/tokyo", manual: true }, "PUT");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timeZone: "Asia/Tokyo", manual: true });
    expect(setUserTimeZone).toHaveBeenCalledWith("Asia/Tokyo", true);
    expect(res.headers.get("set-cookie")).toMatch(/tz_manual=1;/);
  });

  it("goes back to automatic and clears the manual cookie", async () => {
    const res = await post({ timeZone: "Europe/Berlin", manual: false }, "PUT");
    expect(await res.json()).toEqual({ timeZone: "Europe/Berlin", manual: false });
    expect(setUserTimeZone).toHaveBeenCalledWith("Europe/Berlin", false);
    expect(res.headers.get("set-cookie")).toMatch(/tz_manual=;/);
  });

  it.each([{ timeZone: "Not/AZone", manual: true }, { timeZone: "Asia/Tokyo" }, { timeZone: "Asia/Tokyo", manual: "yes" }])(
    "rejects %j with 400",
    async (body) => {
      expect((await post(body, "PUT")).status).toBe(400);
      expect(setUserTimeZone).not.toHaveBeenCalled();
    },
  );

  it("409s before onboarding (no profile row)", async () => {
    setUserTimeZone.mockResolvedValue(false);
    const res = await post({ timeZone: "Asia/Tokyo", manual: true }, "PUT");
    expect(res.status).toBe(409);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("is refused while locked", async () => {
    requireApiUnlock.mockResolvedValue(NextResponse.json({ error: "Locked" }, { status: 401 }));
    expect((await post({ timeZone: "Asia/Tokyo", manual: true }, "PUT")).status).toBe(401);
    expect(setUserTimeZone).not.toHaveBeenCalled();
  });
});
