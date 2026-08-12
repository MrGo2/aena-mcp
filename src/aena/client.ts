import { config, hasRestCredentials } from "../config.js";
import { statusLabel } from "./status.js";

// ── Unified flight shape ──────────────────────────────────────────────────────
// Same object regardless of which underlying AENA API produced it. Fields the
// source cannot provide are left undefined rather than faked.
export interface Flight {
  flightNumber: string;
  airline: { iata?: string; icao?: string; name?: string };
  airport: string; // the AENA airport queried
  otherAirport?: string; // origin (arrivals) or destination (departures)
  otherCity?: string;
  direction: "arrivals" | "departures";
  status?: string;
  statusLabel: string;
  scheduledUtc?: string; // ISO 8601 UTC (REST only)
  estimatedUtc?: string; // ISO 8601 UTC (REST only)
  scheduledLocal?: string; // "HH:MM:SS" local (website only)
  estimatedLocal?: string; // "HH:MM:SS" local (website only)
  date?: string; // "DD/MM/YYYY" (website only)
  terminal?: string;
  aircraft?: string;
  gate?: string;
  baggageBelt?: string;
  mainFlight?: { airline: string; flightNumber: string; airport?: string };
  codeshares?: string[]; // marketing flight numbers collapsed into this one
  source: "website" | "rest";
}

export const clean = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return s && s !== "null" ? s : undefined;
};

// airlineCodes / codigosCompania: 6 CSV slots
// [IATA, ICAO, operatorIATA, commercialIATA, operatorICAO, commercialICAO]
export const parseAirlineCodes = (raw?: string): { iata?: string; icao?: string } => {
  const p = (raw ?? "").split(",");
  return { iata: clean(p[0]), icao: clean(p[1]) };
};

// ── Pure normalizers (no network — unit-tested) ───────────────────────────────
export function normalizeWebsiteRow(
  r: any,
  airport: string,
  direction: "arrivals" | "departures",
): Flight {
  return {
    flightNumber: `${clean(r.iataCompania) ?? clean(r.compania) ?? ""}${clean(r.numVuelo) ?? ""}`,
    airline: {
      iata: clean(r.iataCompania),
      icao: clean(r.oaciCompania) ?? clean(r.compania),
      name: clean(r.nombreCompania),
    },
    airport: clean(r.iataAena) ?? airport,
    otherAirport: clean(r.iataOtro),
    otherCity: clean(r.ciudadIataOtro),
    direction,
    status: clean(r.estado),
    statusLabel: statusLabel(clean(r.estado)),
    scheduledLocal: clean(r.horaProgramada),
    estimatedLocal: clean(r.horaEstimada),
    date: clean(r.fecha),
    terminal: clean(r.terminal),
    aircraft: clean(r.tipoAeronave),
    gate: clean(r.puertaPrimera),
    baggageBelt: clean(r.cintaPrimera),
    source: "website",
  };
}

export function normalizeRestRow(
  r: any,
  airport: string,
  direction: "arrivals" | "departures",
): Flight {
  const codes = parseAirlineCodes(r.airlineCodes);
  const mf = r.mainFlight;
  return {
    // In REST, flightID.airlineIATA actually carries the ICAO code.
    flightNumber: `${clean(r.flightID?.airlineIATA) ?? codes.icao ?? ""}${clean(r.flightID?.flightNumber) ?? ""}`,
    airline: { iata: codes.iata, icao: clean(r.flightID?.airlineIATA) ?? codes.icao },
    airport: clean(r.flightID?.airportIATA) ?? airport,
    otherAirport: clean(r.airportIATATo) ?? clean(r.airportIATAFrom),
    direction,
    status: clean(r.flightStatus),
    statusLabel: statusLabel(clean(r.flightStatus)),
    scheduledUtc: clean(r.flightID?.scheduledDate),
    estimatedUtc: clean(r.actualDate),
    terminal: clean(r.arrivingTerminal),
    aircraft: clean(r.airplaneModel),
    gate: clean(r.boardingGate?.firstBoardingGate),
    baggageBelt: clean(r.baggageClaim?.firstBaggageClaim),
    mainFlight: mf
      ? {
          airline: clean(mf.airlineIATA) ?? "",
          flightNumber: clean(mf.flightNumber) ?? "",
          // typo in AENA's API: "aiportIATA" (missing r)
          airport: clean(mf.aiportIATA) ?? clean(mf.airportIATA),
        }
      : undefined,
    source: "rest",
  };
}

// ── Website API (public, no auth) ─────────────────────────────────────────────
export async function fetchWebsite(
  airport: string,
  direction: "arrivals" | "departures",
): Promise<Flight[]> {
  const flightType = direction === "arrivals" ? "L" : "S";
  const url =
    `${config.WEBSITE_BASE}?pagename=AENA_ConsultarVuelos` +
    `&airport=${encodeURIComponent(airport)}&flightType=${flightType}&dosDias=si`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Website API ${res.status} for ${airport}`);
  const rows = (await res.json()) as any[];
  return rows.map((r) => normalizeWebsiteRow(r, airport, direction));
}

// ── REST API (OAuth2 Azure AD) ────────────────────────────────────────────────
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    scope: ".default",
    grant_type: "client_credentials",
    client_id: config.AENA_CLIENT_ID,
    client_secret: config.AENA_CLIENT_SECRET,
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${config.AENA_TENANT_ID}/oauth2/v2.0/token/`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
  );
  if (!res.ok) throw new Error(`OAuth token ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

export async function fetchRest(
  airport: string,
  direction: "arrivals" | "departures",
  fromIso: string,
  toIso: string,
): Promise<Flight[]> {
  const token = await getToken();
  // NOTE: REST uses "A" for arrivals, not "L" like the website API.
  const flightType = direction === "arrivals" ? "A" : "S";
  const res = await fetch(config.REST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      airportDetails: { airportIATA: airport, flightType },
      dateDetails: { scheduledDateFrom: fromIso, scheduledDateTo: toIso },
    }),
  });
  if (!res.ok) throw new Error(`REST API ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as any[];
  return rows.map((r) => normalizeRestRow(r, airport, direction));
}

export { hasRestCredentials };

// ── Airports (live, self-updating) ────────────────────────────────────────────
export interface Airport {
  iata: string;
  icao?: string;
  name?: string;
  city?: string;
}

export async function fetchAirports(): Promise<Airport[]> {
  const res = await fetch(`${config.WEBSITE_BASE}?pagename=AENA_InfoAeropuertos&l=es_ES`);
  if (!res.ok) throw new Error(`Airports API ${res.status}`);
  const rows = (await res.json()) as any[];
  return rows
    .map((r) => ({
      iata: clean(r.iata) ?? "",
      icao: clean(r.oaci),
      name: clean(r.nombre),
      city: clean(r.ciudad),
    }))
    .filter((a) => a.iata)
    .sort((a, b) => a.iata.localeCompare(b.iata));
}
