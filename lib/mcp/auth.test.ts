import { describe, expect, it, vi } from "vitest";
import { checkMcpAuth } from "./auth";

const TOKEN = "test-token-0123456789abcdefghijklmnopqrstuv";

function req(authorization?: string): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

describe("checkMcpAuth", () => {
  it.each([undefined, "", "   "])("returns 404 when the token is %j (endpoint off)", (token) => {
    expect(checkMcpAuth(req(`Bearer ${TOKEN}`), token)?.status).toBe(404);
  });

  it("treats a token shorter than 32 characters as unset and warns once, without the token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const short = "a".repeat(31);
    expect(checkMcpAuth(req(`Bearer ${short}`), short)?.status).toBe(404);
    expect(checkMcpAuth(req(`Bearer ${short}`), ` ${short}  `)?.status).toBe(404);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toMatch(/at least 32 characters/);
    expect(String(warn.mock.calls[0][0])).not.toContain(short);
    warn.mockRestore();
  });

  it("accepts a token of exactly 32 characters", () => {
    const token = "b".repeat(32);
    expect(checkMcpAuth(req(`Bearer ${token}`), token)).toBeNull();
  });

  it.each([undefined, "", TOKEN, `Basic ${TOKEN}`, "Bearer", "Bearer ", "Bearer wrong"])(
    "returns 401 with WWW-Authenticate for Authorization %j",
    async (authorization) => {
      const res = checkMcpAuth(req(authorization), TOKEN);
      expect(res?.status).toBe(401);
      expect(res?.headers.get("WWW-Authenticate")).toBe("Bearer");
      expect(await res?.text()).not.toContain(TOKEN);
    },
  );

  it("returns 401 for a token that is a prefix of the real one", () => {
    expect(checkMcpAuth(req(`Bearer ${TOKEN.slice(0, -1)}`), TOKEN)?.status).toBe(401);
  });

  it("returns null when the bearer token matches", () => {
    expect(checkMcpAuth(req(`Bearer ${TOKEN}`), TOKEN)).toBeNull();
  });

  it.each([`bearer ${TOKEN}`, `BEARER ${TOKEN}`, `Bearer   ${TOKEN}  `])(
    "accepts the scheme in any case and trims the presented token (%j)",
    (authorization) => {
      expect(checkMcpAuth(req(authorization), TOKEN)).toBeNull();
    },
  );

  it("trims the configured token (e.g. a trailing newline from a .env file)", () => {
    expect(checkMcpAuth(req(`Bearer ${TOKEN}`), `${TOKEN}\n`)).toBeNull();
  });
});
