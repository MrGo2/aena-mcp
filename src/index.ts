#!/usr/bin/env node
// Load .env from the module dir, not the cwd — MCP clients (Claude Desktop etc.)
// launch the server from an arbitrary working directory.
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", ".env") });

const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
const { hasRestCredentials } = await import("./config.js");
const { registerTools, serverInstructions } = await import("./tools.js");
const { z } = await import("zod");

const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

const server = new McpServer(
  { name: "aena-mcp", version, title: "AENA Flights MCP" },
  { instructions: serverInstructions },
);
registerTools(server, z);

console.error(`[aena-mcp] v${version} — REST credentials: ${hasRestCredentials() ? "yes" : "no (website-only)"}`);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = (sig: string) => {
  console.error(`[aena-mcp] ${sig}, shutting down`);
  transport.close().finally(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
