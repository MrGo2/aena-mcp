# Privacy

aena-mcp runs entirely on your machine. It has no backend and no telemetry.

## What it does

The server queries AENA's flight endpoints and returns the results to your MCP
client. It reads only public flight data: schedules, statuses, gates, terminals
and aircraft types for the Spanish airports AENA operates. It does not read your
files, contacts, mail or any personal data.

## What leaves your machine

Two kinds of outbound request, both to AENA and Microsoft:

- Flight and airport lookups to `www.aena.es` and `api.aena.es`.
- If you configure the REST API, an OAuth2 token request to
  `login.microsoftonline.com` carrying your client id and secret.

No third party receives your queries. Nothing is logged off your machine.

## Credentials

The optional REST client secret is read from an environment variable or a local
`.env` file and used only to obtain an access token. It is never written to disk
by the server and never transmitted anywhere except Microsoft's token endpoint.
