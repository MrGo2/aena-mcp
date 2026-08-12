# ✈️ AENA Flights MCP

[![CI](https://github.com/MrGo2/aena-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MrGo2/aena-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcp-aena)](https://www.npmjs.com/package/mcp-aena)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Español: [README.es.md](README.es.md)**

Live flight data for the 50 Spanish airports run by AENA, as an MCP server. Ask Claude things like *"what departures leave Santiago this afternoon?"* or *"is IB0459 delayed?"* and it answers from real airport data: times, gates, terminals, aircraft, status and codeshares.

It puts both of AENA's flight APIs behind one clean set of tools, so an agent asks for flights and gets back the same flight shape no matter which API answered.

## 🚀 Use it in 30 seconds (no install)

The server runs publicly at `https://aena-mcp.carlos-ls.workers.dev/mcp`. Add it to Claude with one click:

**[➕ Add to Claude](https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=AENA%20Flights&connectorUrl=https%3A%2F%2Faena-mcp.carlos-ls.workers.dev%2Fmcp)**

That link opens claude.ai with the connector prefilled; just confirm. Works on every plan, Free included, and once added it is available in the Claude apps too, phone included. No account, no API key, nothing to configure.

Prefer to add it by hand? Claude → Settings → Connectors → Add custom connector, name it `AENA Flights` and paste the URL above.

## 💬 Things you can ask

- 🛫 "Departures from MAD between 16:00 and 18:00"
- 🛬 "What flights arrive at BCN from London tomorrow afternoon?"
- 🔍 "Where is flight UX7235 right now, which gate?"
- 🏝️ "List all AENA airports in the Canary Islands"

## 🖥️ Other ways to run it

| How | For whom | Setup |
|---|---|---|
| ☁️ Remote connector (above) | Everyone, iPhone included | One click |
| 📦 Desktop extension | Claude Desktop | Download `aena-mcp.mcpb` from the [latest release](https://github.com/MrGo2/aena-mcp/releases/latest), double click |
| 🟩 npm | Claude Code, Cursor, any MCP client | `npx mcp-aena` |
| 🔧 From source | Developers | See below |

Config for npm-based clients:

```json
{
  "mcpServers": {
    "aena": {
      "command": "npx",
      "args": ["-y", "mcp-aena"]
    }
  }
}
```

For Claude Code it is one command:

```bash
claude mcp add aena -- npx -y mcp-aena
```

## 🧰 Tools

- `search_flights` — arrivals or departures for an airport. Filter by flight number, by date, or by a local-time window (afternoon = `fromLocal 12:00`, `toLocal 20:00`). Codeshares of the same physical flight collapse into one entry, and every time in the output is local Madrid time.
- `get_flight` — one flight by number at an airport.
- `list_airports` — every AENA airport with IATA/ICAO codes, fetched live.

## 🔀 Why two APIs

AENA exposes two ways to read flights, and each covers a gap the other leaves open.

- 🌐 The **website API** is public and needs no credentials. It sees roughly 14 days ahead but has no past data. Good for discovery.
- 🔐 The **REST API** uses OAuth2 and needs a client secret. It sees about 54 hours into the past and 24 ahead, and tells you the real operating flight behind a codeshare. Good for tracking.

The server picks the right one for you (`source: "auto"`), or you can force either. Without a secret it runs in website-only mode and still works. The public remote server has full REST access already configured.

## 🛠️ From source

```bash
pnpm install
pnpm build      # tsc → dist/
pnpm test       # unit tests over captured fixtures, no network, no credentials
pnpm inspect    # drive a live stdio session with the MCP inspector
```

Copy `.env.example` to `.env`. The website API needs nothing. For the REST API set `AENA_CLIENT_SECRET`; `AENA_CLIENT_ID` and `AENA_TENANT_ID` already have working defaults.

The public remote server lives in [`worker/`](worker/) (Cloudflare Workers, Streamable HTTP, no auth). To host your own:

```bash
cd worker
pnpm install
npx wrangler deploy
npx wrangler secret put AENA_CLIENT_SECRET   # optional, enables the REST source
```

Parsing lives in pure normalizers (`normalizeWebsiteRow`, `normalizeRestRow`) so the mapping is tested without a live call. See [CONTRIBUTING.md](CONTRIBUTING.md).

CI runs the tests on Node 20 and 22 plus an MCP inspector smoke. Tagged pushes (`v*`) publish to npm (OIDC trusted publishing), the MCP Registry, and attach a `.mcpb` bundle to the GitHub release.

## 📝 Notes on the data

- Arrivals is `"A"` in the REST API but `"L"` in the website API. The server hides this.
- The REST `airlineIATA` field actually carries the ICAO code. The server resolves both.
- Flight numbers differ by source: the REST API names flights by ICAO (`VLG1674`), the website by IATA (`VY1674`).
- Neither API filters by flight number on the server, so searches pull the whole airport and filter locally.
- Neither gives real takeoff or landing times, only scheduled and estimated. For wheels-off and wheels-on you need a source like FlightRadar24.

## 📄 License

MIT
