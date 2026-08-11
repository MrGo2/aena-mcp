# aena-mcp — agent notes

MCP server (TypeScript, stdio) exposing AENA flight data for the 50 Spanish
airports. Published as `mcp-aena` on npm.

## Layout

- `src/index.ts` — server, tool registration, tool handlers.
- `src/aena/client.ts` — the two API clients plus the pure normalizers
  (`normalizeWebsiteRow`, `normalizeRestRow`) and the `Flight` type.
- `src/aena/status.ts` — flight status code → label map (shared by both APIs).
- `src/format.ts` — `norm`, `matchesFlight`, `formatFlight` (all pure).
- `src/config.ts` — env loading; REST credential defaults.
- `test/*.test.mjs` — node:test over fixtures, import from `dist/`.

## The two APIs, unified

- Website (public, no auth): ~14 days ahead, no past, local times.
- REST (OAuth2 Azure AD): ~54h past / ~24h future, UTC, gives codeshare operator.

Three API quirks the normalizers hide, each covered by a test:
1. Arrivals is `"A"` in REST but `"L"` in the website API.
2. REST `flightID.airlineIATA` actually carries the ICAO code.
3. `mainFlight.aiportIATA` is misspelled in AENA's API (missing "r").

## Rules

- New parsing goes in a pure normalizer with a fixture-based test. Handlers do
  no parsing.
- A field the source cannot provide is left undefined, never faked.
- `pnpm test` must be green. A bug fix ships with the fixture that catches it.
- Version lives in `package.json`, `manifest.json` and `server.json` — the
  release workflow fails if they disagree with the tag. Bump all three.

## Credentials

REST needs `AENA_CLIENT_SECRET` (id and tenant have working defaults). Without
it the server runs website-only. The secret is stored in
`~/Edelwyss/infrastructure/_CREDENTIALS_BACKUP/credentials.toml` under `[aena]`.
Never commit `.env`.
