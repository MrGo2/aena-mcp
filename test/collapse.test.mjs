import { test } from "node:test";
import assert from "node:assert/strict";
import { collapseCodeshares, localParts } from "../dist/aena/collapse.js";

const mk = (o) => ({ airline: {}, airport: "SCQ", direction: "arrivals", statusLabel: "x", source: "rest", ...o });

test("localParts converts REST UTC to Madrid local (summer = UTC+2)", () => {
  const p = localParts(mk({ scheduledUtc: "2026-08-12T06:30:00.000Z" }));
  assert.equal(p.hhmm, "08:30");
  assert.equal(p.date, "12/08/2026");
  assert.equal(p.minutes, 8 * 60 + 30);
});

test("localParts passes through website local time", () => {
  const p = localParts(mk({ scheduledLocal: "17:05:00", date: "12/08/2026", source: "website" }));
  assert.equal(p.hhmm, "17:05");
  assert.equal(p.minutes, 17 * 60 + 5);
});

test("collapseCodeshares merges same route+time into the operating flight", () => {
  const flights = [
    mk({ flightNumber: "VLG1680", otherAirport: "BCN", scheduledUtc: "2026-08-12T06:30:00.000Z" }), // operator (no mainFlight)
    mk({ flightNumber: "LVL5127", otherAirport: "BCN", scheduledUtc: "2026-08-12T06:30:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1680" } }),
    mk({ flightNumber: "QTR3564", otherAirport: "BCN", scheduledUtc: "2026-08-12T06:30:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1680" } }),
    mk({ flightNumber: "IBE5368", otherAirport: "BCN", scheduledUtc: "2026-08-12T06:30:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1680" } }),
    mk({ flightNumber: "UX7235", otherAirport: "MAD", scheduledUtc: "2026-08-12T07:00:00.000Z" }), // different flight
  ];
  const out = collapseCodeshares(flights);
  assert.equal(out.length, 2);
  const bcn = out.find((f) => f.otherAirport === "BCN");
  assert.equal(bcn.flightNumber, "VLG1680");
  assert.deepEqual(bcn.codeshares.sort(), ["IBE5368", "LVL5127", "QTR3564"]);
});

test("collapseCodeshares keeps distinct flights on the same route at different times", () => {
  const flights = [
    mk({ flightNumber: "VY1671", otherAirport: "BCN", scheduledUtc: "2026-08-12T08:50:00.000Z" }),
    mk({ flightNumber: "VY1685", otherAirport: "BCN", scheduledUtc: "2026-08-12T14:00:00.000Z" }),
  ];
  assert.equal(collapseCodeshares(flights).length, 2);
});
