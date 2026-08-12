import type { Flight } from "./client.js";

const MADRID = "Europe/Madrid";

// Local Madrid time for a flight, from whichever timestamp the source gave.
// REST carries UTC ISO; the website already gives local HH:MM plus a date.
export function localParts(f: Flight): { date?: string; hhmm?: string; minutes?: number } {
  if (f.scheduledUtc) {
    const d = new Date(f.scheduledUtc);
    const fmt = new Intl.DateTimeFormat("es-ES", {
      timeZone: MADRID,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const g = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
    const hh = g("hour") === "24" ? "00" : g("hour");
    return { date: `${g("day")}/${g("month")}/${g("year")}`, hhmm: `${hh}:${g("minute")}`, minutes: +hh * 60 + +g("minute") };
  }
  if (f.scheduledLocal) {
    const [h, m] = f.scheduledLocal.split(":");
    return { date: f.date, hhmm: `${h}:${m}`, minutes: +h * 60 + +m };
  }
  return {};
}

// Codeshares of one physical flight share the exact route and scheduled minute.
// Collapse them into a single entry: the operating flight (the REST row with no
// mainFlight, i.e. not a codeshare of anything) becomes primary, and the other
// marketing numbers are listed as codeshares.
export function collapseCodeshares(flights: Flight[]): Flight[] {
  const groups = new Map<string, Flight[]>();
  for (const f of flights) {
    const { date, hhmm } = localParts(f);
    const key = `${f.otherAirport ?? "?"}|${date ?? ""}|${hhmm ?? ""}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }
  const out: Flight[] = [];
  for (const grp of groups.values()) {
    if (grp.length === 1) {
      out.push(grp[0]);
      continue;
    }
    // Operating flight = a row that is not itself a codeshare (no mainFlight).
    const primary = grp.find((f) => !f.mainFlight) ?? grp[0];
    const codeshares = grp
      .filter((f) => f.flightNumber !== primary.flightNumber)
      .map((f) => f.flightNumber)
      .filter((n, i, a) => n && a.indexOf(n) === i);
    out.push({ ...primary, codeshares });
  }
  return out;
}
