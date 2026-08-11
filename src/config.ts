// Load .env from the module dir, not the cwd — MCP clients (Claude Desktop etc.)
// launch the server from an arbitrary working directory.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", ".env") });

export const config = {
  // REST API (OAuth2 Azure AD). Empty client secret => website-only mode.
  // id/tenant use `||` so a blank env var (DXT injects "") falls back to the
  // working default; the secret uses `??` so blank stays blank on purpose.
  AENA_CLIENT_ID: process.env.AENA_CLIENT_ID || "34242493-003c-407a-b399-30eb2a280614",
  AENA_CLIENT_SECRET: process.env.AENA_CLIENT_SECRET ?? "",
  AENA_TENANT_ID: process.env.AENA_TENANT_ID || "3ea6ba9c-a793-4c35-b1c1-e9d182879576",

  WEBSITE_BASE: "https://www.aena.es/sites/Satellite",
  REST_URL: "https://api.aena.es/b2b-flights/api/v1/flights",

  DEFAULT_TIMEZONE: "Europe/Madrid",
};

export const hasRestCredentials = (): boolean =>
  Boolean(config.AENA_CLIENT_SECRET && config.AENA_CLIENT_ID && config.AENA_TENANT_ID);
