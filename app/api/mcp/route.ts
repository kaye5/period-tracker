import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { checkMcpAuth } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /api/mcp — stateless Streamable HTTP MCP endpoint (MCP-SPEC "Architecture"): a new server
 * and transport per request, behind the MCP_TOKEN bearer gate. */
async function handle(request: Request): Promise<Response> {
  const denied = checkMcpAuth(request);
  if (denied) return denied;
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Stateless: no server-initiated messages, so no SSE stream to offer (Streamable HTTP allows 405).
export async function GET(request: Request): Promise<Response> {
  return checkMcpAuth(request) ?? new Response(null, { status: 405, headers: { Allow: "POST, DELETE" } });
}

export { handle as POST, handle as DELETE };
