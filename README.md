# AENA Flights MCP

An MCP server for flight data across the 50 Spanish airports run by AENA. It puts both of AENA's flight APIs behind one clean set of tools, so an agent asks for flights and gets back the same flight shape no matter which API answered.

## Why two APIs

AENA exposes two ways to read flights, and each covers a gap the other leaves open.

- **Website API** is public and needs no credentials. It sees roughly 14 days ahead but has no past data, and it reports local times. Good for discovery.
- **REST API** uses OAuth2 and needs a client secret. It sees about 54 hours into the past and 24 ahead, reports UTC, and tells you the real operating flight behind a codeshare. Good for tracking.

The server picks the right one for you (`source: "auto"`), or you can force either. Without a secret it runs in website-only mode and still works.

## Tools

- `search_flights` — arrivals or departures for an airport, with an optional flight-number filter.
- `get_flight` — one flight by number at an airport.
- `list_airports` — every AENA airport with IATA/ICAO codes, fetched live.

## Install

```bash
pnpm install
pnpm build
```

## Configure

Copy `.env.example` to `.env`. The website API needs nothing. For the REST API set `AENA_CLIENT_SECRET`; `AENA_CLIENT_ID` and `AENA_TENANT_ID` already have working defaults.

```json
{
  "mcpServers": {
    "aena": {
      "command": "node",
      "args": ["/path/to/aena-mcp/dist/index.js"]
    }
  }
}
```

## Notes on the data

- Arrivals is `"A"` in the REST API but `"L"` in the website API. The server hides this.
- The REST `airlineIATA` field actually carries the ICAO code. The server resolves both.
- Neither API filters by flight number on the server, so searches pull the whole airport and filter locally.
- Neither gives real takeoff or landing times, only scheduled and estimated. For wheels-off and wheels-on you need a source like FlightRadar24.

## License

MIT
