import type { Flight } from "./aena/client.js";

export const norm = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function matchesFlight(f: Flight, query?: string): boolean {
  if (!query) return true;
  return norm(f.flightNumber).includes(norm(query));
}

export function formatFlight(f: Flight): string {
  const time = f.scheduledUtc
    ? `${f.scheduledUtc}${f.estimatedUtc && f.estimatedUtc !== f.scheduledUtc ? ` → ${f.estimatedUtc}` : ""} (UTC)`
    : `${f.date ?? ""} ${f.scheduledLocal ?? ""}${f.estimatedLocal && f.estimatedLocal !== f.scheduledLocal ? ` → ${f.estimatedLocal}` : ""} (local)`.trim();
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
    f.mainFlight?.flightNumber &&
      `  operated by ${f.mainFlight.airline}${f.mainFlight.flightNumber} (codeshare)`,
  ].filter(Boolean);
  return bits.join("\n");
}
