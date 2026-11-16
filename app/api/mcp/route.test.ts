import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const TOKEN = "test-token-0123456789abcdefghijklmnopqrstuv";
const URL = "http://localhost/api/mcp";
const auth = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => vi.stubEnv("MCP_TOKEN", TOKEN));
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/mcp", () => {
  it("returns 405 with Allow: POST, DELETE and no body when authorised", async () => {
    const res = await GET(new Request(URL, { headers: { ...auth, Accept: "text/event-stream" } }));
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST, DELETE");
    expect(await res.text()).toBe("");
  });

  it("still checks auth first: 401 without a token, 404 when the endpoint is off", async () => {
    expect((await GET(new Request(URL))).status).toBe(401);
    vi.stubEnv("MCP_TOKEN", "");
    expect((await GET(new Request(URL, { headers: auth }))).status).toBe(404);
  });
});

describe("POST /api/mcp", () => {
  it("answers initialize when authorised", async () => {
    const res = await POST(
      new Request(URL, {
        method: "POST",
        headers: {
          ...auth,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "test", version: "0" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).result.serverInfo.name).toBe("cycle");
  });
});

describe("DELETE /api/mcp", () => {
  it("is still handled by the transport", async () => {
    expect((await DELETE(new Request(URL, { method: "DELETE", headers: auth }))).status).toBe(200);
  });
});
