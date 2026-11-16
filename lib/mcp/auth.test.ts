import { describe, expect, it } from "vitest";
import { checkMcpAuth } from "./auth";

const TOKEN = "test-token-0123456789abcdefghijklmnopqrstuv";

function req(authorization?: string): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: authorization === undefined ? {} : { Authorization: authorization },
  });
}

describe("checkMcpAuth", () => {
  it.each([undefined, ""])("returns 404 when the token is %j (endpoint off)", (token) => {
    expect(checkMcpAuth(req(`Bearer ${TOKEN}`), token)?.status).toBe(404);
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
});
