import { hasRestCredentials } from "./config.js";
import { fetchWebsite, fetchRest, fetchAirports, type Flight } from "./aena/client.js";
import { matchesFlight, formatFlight, inWindow, todayMadrid } from "./format.js";
import { collapseCodeshares } from "./aena/collapse.js";

export const serverInstructions = `Flight data for the 50 Spanish AENA airports.

Two data sources, unified behind one Flight shape:
- REST (OAuth2): richer, sees ~54h past / ~24h future, gives codeshare operator.
  Requires AENA_CLIENT_SECRET. Times are UTC.
- Website (public, no auth): discovery up to ~14 days ahead, no past. Times local.

Neither API filters by flight number server-side, so searches pull the airport
and filter locally. Set source to force one API; default 'auto' uses REST when
credentials are present, else the website.`;

// Works with both @modelcontextprotocol/sdk v1 and @modelcontextprotocol/server
// v2 McpServer instances — registerTool has the same shape in both.
interface ToolServer {
  registerTool(name: string, meta: any, handler: (args: any) => Promise<any>): any;
}

// `z` is injected by each entrypoint: zod v3 for the stdio build (SDK v1),
// zod v4 for the Cloudflare Worker (@modelcontextprotocol/server v2).
export function registerTools(server: ToolServer, z: any): void {
  server.registerTool(
    "search_flights",
    {
      title: "Search flights",
      description:
        "List flights for an AENA airport (arrivals or departures). Codeshares of the same physical flight are collapsed into one entry by default. Filter by flight number and/or a local-time window (e.g. afternoon = fromLocal 12:00, toLocal 20:00). Times in the output are local Madrid time.",
      inputSchema: {
        airport: z.string().length(3).describe("Airport IATA code, e.g. MAD, BCN, SCQ"),
        direction: z.enum(["arrivals", "departures"]),
        flightNumber: z.string().optional().describe("Filter client-side, e.g. IB0459 or UX7235"),
        fromLocal: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe("Only flights scheduled at or after this local time (HH:MM), e.g. 12:00 for afternoon"),
        toLocal: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe("Only flights scheduled at or before this local time (HH:MM), e.g. 20:00 for afternoon"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Only flights on this local date (YYYY-MM-DD). Defaults to today when fromLocal/toLocal is set."),
        collapseCodeshares: z.boolean().default(true).describe("Collapse codeshares of the same flight into one entry (default true)"),
        source: z.enum(["auto", "website", "rest"]).default("auto"),
        hoursBack: z.number().default(6).describe("REST window: hours into the past"),
        hoursForward: z.number().default(12).describe("REST window: hours into the future"),
      },
    },
    async ({ airport, direction, flightNumber, fromLocal, toLocal, date, collapseCodeshares: collapse, source, hoursBack, hoursForward }: any) => {
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
      if (collapse) flights = collapseCodeshares(flights);
      const onDate = date
        ? date.split("-").reverse().join("/")
        : fromLocal || toLocal
          ? todayMadrid()
          : undefined;
      const filtered = flights.filter(
        (f) => matchesFlight(f, flightNumber) && inWindow(f, onDate, fromLocal, toLocal),
      );
      const win = fromLocal || toLocal || onDate ? ` on ${onDate}${fromLocal || toLocal ? ` between ${fromLocal ?? "…"} and ${toLocal ?? "…"} local` : ""}` : "";
      const header = `${filtered.length} ${direction} at ${ap}${flightNumber ? ` matching "${flightNumber}"` : ""}${win} (source: ${useRest ? "rest" : "website"})`;
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
    async ({ airport, flightNumber, direction }: any) => {
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
      const hits = collapseCodeshares(flights).filter((f) => matchesFlight(f, flightNumber));
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
}
