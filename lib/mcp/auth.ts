import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/**
 * Bearer-token gate for /api/mcp (MCP-SPEC "Architecture"). Returns the error response to
 * send, or null when authorised. Unset/empty token → 404 (endpoint off). Digests are compared
 * so length differences don't leak through timing. Never logs or echoes the token.
 */
export function checkMcpAuth(request: Request, token = process.env.MCP_TOKEN): Response | null {
  if (!token) return new Response("Not found", { status: 404 });
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  if (match && timingSafeEqual(sha256(match[1]), sha256(token))) return null;
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}
