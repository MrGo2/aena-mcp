import type { Flight } from "./aena/client.js";
import { localParts } from "./aena/collapse.js";

export const norm = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function matchesFlight(f: Flight, query?: string): boolean {
  if (!query) return true;
  const q = norm(query);
  if (norm(f.flightNumber).includes(q)) return true;
  return (f.codeshares ?? []).some((c) => norm(c).includes(q));
}

// Today's date in Madrid, as DD/MM/YYYY (the format localParts produces).
export function todayMadrid(): string {
  const fmt = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")}`;
}

// Keep flights on `onDate` (DD/MM/YYYY) whose local scheduled time is within
// [fromLocal, toLocal] (HH:MM). The website API spans ~14 days, so a time
// window without a date anchor would match the same hours on every day.
export function inWindow(f: Flight, onDate?: string, fromLocal?: string, toLocal?: string): boolean {
  if (!onDate && !fromLocal && !toLocal) return true;
  const { date, minutes } = localParts(f);
  if (onDate && date && date !== onDate) return false;
  if (minutes == null) return true;
  const toMin = (s?: string) => (s ? +s.split(":")[0] * 60 + +(s.split(":")[1] ?? 0) : undefined);
  const lo = toMin(fromLocal);
  const hi = toMin(toLocal);
  if (lo != null && minutes < lo) return false;
  if (hi != null && minutes > hi) return false;
  return true;
}

// Minutes since epoch of the flight's scheduled local time, treating local
// wall-clock as UTC. Consistent on both sides of a comparison, so DST shifts
// cancel out for "which flight is closest to now" purposes.
export function localEpochMinutes(f: Flight): number | undefined {
  const { date, minutes } = localParts(f);
  if (!date || minutes == null) return undefined;
  const [d, m, y] = date.split("/").map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + minutes;
}

// A daily flight shows up once per day in the source window (REST ~36h,
// website ~14 days). Sort matches by distance to `nowMin` so the caller can
// take the closest occurrence as the best match.
export function sortByProximity(flights: Flight[], nowMin: number): Flight[] {
  const dist = (f: Flight) => {
    const e = localEpochMinutes(f);
    return e == null ? Number.MAX_SAFE_INTEGER : Math.abs(e - nowMin);
  };
  return [...flights].sort((a, b) => dist(a) - dist(b));
}

// "Now" on the same scale as localEpochMinutes: Madrid wall-clock as UTC.
export function nowMadridMinutes(): number {
  const fmt = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const g = (t: string) => +(fmt.find((p) => p.type === t)?.value ?? 0);
  const hh = g("hour") === 24 ? 0 : g("hour");
  return Date.UTC(g("year"), g("month") - 1, g("day")) / 60000 + hh * 60 + g("minute");
}

export function formatFlight(f: Flight): string {
  const { date, hhmm } = localParts(f);
  const est =
    f.estimatedUtc && f.estimatedUtc !== f.scheduledUtc
      ? ` → ${localParts({ ...f, scheduledUtc: f.estimatedUtc, scheduledLocal: undefined }).hhmm}`
      : f.estimatedLocal && f.estimatedLocal !== f.scheduledLocal
        ? ` → ${f.estimatedLocal.slice(0, 5)}`
        : "";
  const time = `${date ?? ""} ${hhmm ?? ""}${est} (hora local)`.trim();
  const route =
    f.direction === "arrivals"
      ? `${f.otherAirport ?? "?"} → ${f.airport}`
      : `${f.airport} → ${f.otherAirport ?? "?"}`;
  const cs = f.codeshares && f.codeshares.length > 0 ? ` (+${f.codeshares.join(" ")})` : "";
  const bits = [
    `${f.flightNumber}${cs}  ${route}`,
    `  ${time}  [${f.statusLabel}${f.status ? ` / ${f.status}` : ""}]`,
    [
      f.airline.name && `airline: ${f.airline.name}`,
      f.terminal && `terminal ${f.terminal}`,
      f.aircraft && `aircraft ${f.aircraft}`,
      f.gate && `gate ${f.gate}`,
      f.baggageBelt && `belt ${f.baggageBelt}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    f.mainFlight?.flightNumber &&
      `  operated by ${f.mainFlight.airline}${f.mainFlight.flightNumber} (codeshare)`,
  ].filter(Boolean);
  return bits.join("\n");
}
