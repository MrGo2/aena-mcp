import type { Flight } from "./aena/client.js";
import { localParts } from "./aena/collapse.js";

export const norm = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function matchesFlight(f: Flight, query?: string): boolean {
  if (!query) return true;
  const q = norm(query);
  if (norm(f.flightNumber).includes(q)) return true;
  return (f.codeshares ?? []).some((c) => norm(c).includes(q));
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
  const bits = [
    `${f.flightNumber}  ${route}`,
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
    f.codeshares && f.codeshares.length > 0 && `  codeshares: ${f.codeshares.join(", ")}`,
    f.mainFlight?.flightNumber &&
      `  operated by ${f.mainFlight.airline}${f.mainFlight.flightNumber} (codeshare)`,
  ].filter(Boolean);
  return bits.join("\n");
}
