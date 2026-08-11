#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { config, hasRestCredentials } from "./config.js";
import { fetchWebsite, fetchRest, fetchAirports, type Flight } from "./aena/client.js";
import { matchesFlight, formatFlight } from "./format.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

const server = new McpServer(
  { name: "aena-mcp", version, title: "AENA Flights MCP" },
  {
    instructions: `Flight data for the 50 Spanish AENA airports.

Two data sources, unified behind one Flight shape:
- REST (OAuth2): richer, sees ~54h past / ~24h future, gives codeshare operator.
  Requires AENA_CLIENT_SECRET. Times are UTC.
- Website (public, no auth): discovery up to ~14 days ahead, no past. Times local.

Neither API filters by flight number server-side, so searches pull the airport
and filter locally. Set source to force one API; default 'auto' uses REST when
credentials are present, else the website.`,
  },
);

server.registerTool(
  "search_flights",
  {
    title: "Search flights",
    description:
      "List flights for an AENA airport (arrivals or departures), optionally filtered by flight number. Returns a unified flight list from the REST or website API.",
    inputSchema: {
      airport: z.string().length(3).describe("Airport IATA code, e.g. MAD, BCN, LCG"),
      direction: z.enum(["arrivals", "departures"]),
      flightNumber: z.string().optional().describe("Filter client-side, e.g. IB0459 or UX7235"),
      source: z.enum(["auto", "website", "rest"]).default("auto"),
      hoursBack: z.number().default(6).describe("REST window: hours into the past"),
      hoursForward: z.number().default(12).describe("REST window: hours into the future"),
    },
  },
  async ({ airport, direction, flightNumber, source, hoursBack, hoursForward }) => {
    const ap = airport.toUpperCase();
    const useRest = source === "rest" || (source === "auto" && hasRestCredentials());
    let flights: Flight[];
    if (useRest) {
      if (!hasRestCredentials())
        return { content: [{ type: "text", text: "REST API needs AENA_CLIENT_SECRET (and CLIENT_ID / TENANT_ID). Set them or use source:'website'." }], isError: true };
      const now = Date.now();
      const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
      flights = await fetchRest(ap, direction, iso(now - hoursBack * 3.6e6), iso(now + hoursForward * 3.6e6));
    } else {
      flights = await fetchWebsite(ap, direction);
    }
    const filtered = flights.filter((f) => matchesFlight(f, flightNumber));
    const header = `${filtered.length} ${direction} at ${ap}${flightNumber ? ` matching "${flightNumber}"` : ""} (source: ${useRest ? "rest" : "website"})`;
    if (filtered.length === 0) return { content: [{ type: "text", text: header }] };
    return { content: [{ type: "text", text: `${header}\n\n${filtered.map(formatFlight).join("\n\n")}` }] };
  },
);

server.registerTool(
  "get_flight",
  {
    title: "Get a specific flight",
    description: "Find one flight by number at an airport. Convenience wrapper over search_flights that returns the single best match.",
    inputSchema: {
      airport: z.string().length(3).describe("Airport IATA code"),
      flightNumber: z.string().describe("e.g. IB0459, UX7235"),
      direction: z.enum(["arrivals", "departures"]),
    },
  },
  async ({ airport, flightNumber, direction }) => {
    const ap = airport.toUpperCase();
    const useRest = hasRestCredentials();
    let flights: Flight[];
    if (useRest) {
      const now = Date.now();
      const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
      flights = await fetchRest(ap, direction, iso(now - 12 * 3.6e6), iso(now + 24 * 3.6e6));
    } else {
      flights = await fetchWebsite(ap, direction);
    }
    const hits = flights.filter((f) => matchesFlight(f, flightNumber));
    if (hits.length === 0)
      return { content: [{ type: "text", text: `No ${direction} flight matching "${flightNumber}" at ${ap}.` }] };
    return { content: [{ type: "text", text: hits.map(formatFlight).join("\n\n") }] };
  },
);

server.registerTool(
  "list_airports",
  {
    title: "List AENA airports",
    description: "List all Spanish airports in the AENA network with IATA/ICAO codes and city. Fetched live, so always current.",
    inputSchema: {},
  },
  async () => {
    const airports = await fetchAirports();
    const lines = airports.map((a) => `${a.iata}  ${a.icao ?? "    "}  ${a.name ?? ""}${a.city && a.city !== a.name ? ` (${a.city})` : ""}`);
    return { content: [{ type: "text", text: `${airports.length} AENA airports:\n\n${lines.join("\n")}` }] };
  },
);

console.error(`[aena-mcp] v${version} — REST credentials: ${hasRestCredentials() ? "yes" : "no (website-only)"}`);

const transport = new StdioServerTransport();
await server.connect(transport);

const shutdown = (sig: string) => {
  console.error(`[aena-mcp] ${sig}, shutting down`);
  transport.close().finally(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
