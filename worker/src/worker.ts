// Public remote MCP server (Streamable HTTP, no auth) for Cloudflare Workers.
// Reuses the same tool registrations as the stdio build; nodejs_compat
// populates process.env from vars/secrets so config.ts works unchanged.
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

import { registerTools, serverInstructions } from "../../src/tools.js";

function createServer() {
  const server = new McpServer(
    { name: "aena-mcp", version: "0.1.3", title: "AENA Flights MCP" },
    { instructions: serverInstructions },
  );
  registerTools(server, z);
  return server;
}

const handler = createMcpHandler(createServer);

export default {
  fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET")
      return new Response(
        "aena-mcp — MCP server for Spanish AENA airport flight data.\nMCP endpoint: POST /mcp\nSource: https://github.com/MrGo2/aena-mcp\n",
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    return (handler as any)(request, env, ctx);
  },
};
