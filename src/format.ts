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
