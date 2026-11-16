import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "@/package.json";
import { registerReadTools } from "@/lib/mcp/tools/read";
import { registerWriteTools } from "@/lib/mcp/tools/write";

/** A fresh MCP server with every tool registered. Stateless: one per request. */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "cycle", version: pkg.version });
  registerReadTools(server);
  registerWriteTools(server);
  return server;
}
