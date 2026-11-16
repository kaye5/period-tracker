import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest();
const MIN_TOKEN_LENGTH = 32;
let warnedShortToken = false;

/**
 * Bearer-token gate for /api/mcp (MCP-SPEC "Architecture"). Returns the error response to
 * send, or null when authorised. Unset, empty or too short (< 32 chars after trimming)
 * token → 404 (endpoint off). Digests are compared so length differences don't leak through
 * timing. Never logs or echoes the token.
 */
export function checkMcpAuth(request: Request, token = process.env.MCP_TOKEN): Response | null {
  const expected = token?.trim() ?? "";
  if (expected.length < MIN_TOKEN_LENGTH) {
    if (expected && !warnedShortToken) {
      warnedShortToken = true;
      console.warn(`MCP endpoint is off: MCP_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters.`);
    }
    return new Response("Not found", { status: 404 });
  }
  const match = /^bearer\s+(.+)$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  if (match && timingSafeEqual(sha256(match[1].trim()), sha256(expected))) return null;
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}
