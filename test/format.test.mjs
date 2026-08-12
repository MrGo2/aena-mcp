import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, matchesFlight, formatFlight, inWindow } from "../dist/format.js";

const restFlight = {
  flightNumber: "UX7235",
  airline: { iata: "UX", icao: "AEA" },
  airport: "LCG",
  otherAirport: "MAD",
  direction: "arrivals",
  status: "BOR",
  statusLabel: "Completed",
  scheduledUtc: "2026-08-11T14:20:00.000Z",
  estimatedUtc: "2026-08-11T14:31:00.000Z",
  terminal: "T1",
  aircraft: "738W",
  baggageBelt: "1",
  source: "rest",
};

test("norm strips separators and uppercases", () => {
  assert.equal(norm("ib 0459"), "IB0459");
  assert.equal(norm("UX-7235"), "UX7235");
});

test("matchesFlight is case- and separator-insensitive, empty query matches all", () => {
  assert.equal(matchesFlight(restFlight, "ux7235"), true);
  assert.equal(matchesFlight(restFlight, "UX 7235"), true);
  assert.equal(matchesFlight(restFlight, "7235"), true);
  assert.equal(matchesFlight(restFlight, "IB0459"), false);
  assert.equal(matchesFlight(restFlight, undefined), true);
});

test("formatFlight (rest) shows local Madrid time, route and status", () => {
  const out = formatFlight(restFlight);
  assert.match(out, /UX7235 {2}MAD → LCG/);
  assert.match(out, /\(hora local\)/);
  assert.match(out, /16:20/); // 14:20 UTC → 16:20 Madrid (summer)
  assert.match(out, /\[Completed \/ BOR\]/);
  assert.match(out, /belt 1/);
});

test("formatFlight (website) shows local time and no empty codeshare line", () => {
  const web = {
    flightNumber: "IB0459",
    airline: { iata: "IB", icao: "IBE", name: "Iberia" },
    airport: "LCG",
    otherAirport: "MAD",
    direction: "arrivals",
    status: "BOR",
    statusLabel: "Completed",
    scheduledLocal: "17:05:00",
    estimatedLocal: "17:06:00",
    date: "11/08/2026",
    terminal: "T1",
    source: "website",
  };
  const out = formatFlight(web);
  assert.match(out, /\(hora local\)/);
  assert.match(out, /17:05/);
  assert.match(out, /airline: Iberia/);
  assert.doesNotMatch(out, /operated by/);
});

test("formatFlight shows codeshare operator when present", () => {
  const out = formatFlight({ ...restFlight, mainFlight: { airline: "VLG", flightNumber: "1294" } });
  assert.match(out, /operated by VLG1294 \(codeshare\)/);
});

test("formatFlight folds codeshares into the flight line", () => {
  const out = formatFlight({ ...restFlight, codeshares: ["IBE5504", "QTR3719"] });
  assert.match(out, /UX7235 \(\+IBE5504 QTR3719\) {2}MAD → LCG/);
  assert.doesNotMatch(out, /codeshares:/);
});

test("inWindow anchors the time window to a date (website spans 14 days)", () => {
  const today = { ...restFlight, scheduledUtc: undefined, scheduledLocal: "14:10:00", date: "12/08/2026", source: "website" };
  const tomorrow = { ...today, date: "13/08/2026" };
  assert.equal(inWindow(today, "12/08/2026", "12:00", "20:00"), true);
  assert.equal(inWindow(tomorrow, "12/08/2026", "12:00", "20:00"), false);
  assert.equal(inWindow(today, "12/08/2026", "15:00", "20:00"), false);
  assert.equal(inWindow(today, undefined, undefined, undefined), true);
});
