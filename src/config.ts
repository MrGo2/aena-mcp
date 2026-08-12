// Env is read lazily at property access so the same module works on Node
// (index.ts loads .env first) and on Cloudflare Workers (nodejs_compat
// populates process.env from vars/secrets).
const env = (k: string): string | undefined => (globalThis as any).process?.env?.[k];

export const config = {
  // REST API (OAuth2 Azure AD). Empty client secret => website-only mode.
  // id/tenant use `||` so a blank env var (DXT injects "") falls back to the
  // working default; the secret uses `??` so blank stays blank on purpose.
  get AENA_CLIENT_ID() { return env("AENA_CLIENT_ID") || "34242493-003c-407a-b399-30eb2a280614"; },
  get AENA_CLIENT_SECRET() { return env("AENA_CLIENT_SECRET") ?? ""; },
  get AENA_TENANT_ID() { return env("AENA_TENANT_ID") || "3ea6ba9c-a793-4c35-b1c1-e9d182879576"; },

  WEBSITE_BASE: "https://www.aena.es/sites/Satellite",
  REST_URL: "https://api.aena.es/b2b-flights/api/v1/flights",

  DEFAULT_TIMEZONE: "Europe/Madrid",
};

export const hasRestCredentials = (): boolean =>
  Boolean(config.AENA_CLIENT_SECRET && config.AENA_CLIENT_ID && config.AENA_TENANT_ID);
