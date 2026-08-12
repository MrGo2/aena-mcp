import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, matchesFlight, formatFlight, inWindow, todayMadrid, sortByProximity, localEpochMinutes } from "../dist/format.js";
import { collapseCodeshares, localParts } from "../dist/aena/collapse.js";
import { normalizeWebsiteRow, normalizeRestRow, parseAirlineCodes, clean } from "../dist/aena/client.js";

const mk = (o) => ({ airline: {}, airport: "SCQ", direction: "arrivals", statusLabel: "x", source: "rest", ...o });

// ── inWindow / date anchoring ─────────────────────────────────────────────────

test("inWindow: date-only filter, no time window", () => {
  const f = mk({ scheduledLocal: "09:00:00", date: "13/08/2026", source: "website" });
  assert.equal(inWindow(f, "13/08/2026"), true);
  assert.equal(inWindow(f, "12/08/2026"), false);
});

test("inWindow: fromLocal only (open-ended evening)", () => {
  const f = mk({ scheduledLocal: "22:30:00", date: "12/08/2026", source: "website" });
  assert.equal(inWindow(f, "12/08/2026", "20:00", undefined), true);
  assert.equal(inWindow(f, "12/08/2026", "23:00", undefined), false);
});

test("inWindow: toLocal only (open-ended morning)", () => {
  const f = mk({ scheduledLocal: "06:15:00", date: "12/08/2026", source: "website" });
  assert.equal(inWindow(f, "12/08/2026", undefined, "09:00"), true);
  assert.equal(inWindow(f, "12/08/2026", undefined, "06:00"), false);
});

test("inWindow: boundary times are inclusive", () => {
  const f = mk({ scheduledLocal: "12:00:00", date: "12/08/2026", source: "website" });
  assert.equal(inWindow(f, "12/08/2026", "12:00", "12:00"), true);
});

test("inWindow: flight without any time passes the time filter but respects nothing to date-match", () => {
  const f = mk({});
  assert.equal(inWindow(f, "12/08/2026", "12:00", "20:00"), true); // no date/minutes → not excluded
});

test("inWindow: REST UTC flight is compared in Madrid local, including date rollover", () => {
  // 23:30 UTC on the 12th = 01:30 Madrid on the 13th (summer)
  const f = mk({ scheduledUtc: "2026-08-12T23:30:00.000Z" });
  assert.equal(inWindow(f, "13/08/2026", "01:00", "02:00"), true);
  assert.equal(inWindow(f, "12/08/2026", "01:00", "02:00"), false);
});

test("inWindow: single-digit hour in window spec", () => {
  const f = mk({ scheduledLocal: "08:30:00", date: "12/08/2026", source: "website" });
  assert.equal(inWindow(f, "12/08/2026", "8:00", "9:00"), true);
});

test("todayMadrid returns DD/MM/YYYY", () => {
  assert.match(todayMadrid(), /^\d{2}\/\d{2}\/\d{4}$/);
});

// ── formatFlight ──────────────────────────────────────────────────────────────

test("formatFlight: departures route direction", () => {
  const out = formatFlight(mk({ flightNumber: "VY1676", direction: "departures", otherAirport: "BCN", scheduledLocal: "14:10:00", date: "12/08/2026", source: "website" }));
  assert.match(out, /VY1676 {2}SCQ → BCN/);
});

test("formatFlight: unknown other airport shows '?'", () => {
  const out = formatFlight(mk({ flightNumber: "XX123", scheduledLocal: "10:00:00", date: "12/08/2026", source: "website" }));
  assert.match(out, /\? → SCQ/);
});

test("formatFlight: single codeshare folds inline", () => {
  const out = formatFlight(mk({ flightNumber: "VY3981", otherAirport: "PMI", codeshares: ["IB5863"], scheduledLocal: "12:30:00", date: "12/08/2026", source: "website" }));
  assert.match(out, /VY3981 \(\+IB5863\) {2}PMI → SCQ/);
});

test("formatFlight: empty codeshares array adds no parenthesis", () => {
  const out = formatFlight(mk({ flightNumber: "VY3981", otherAirport: "PMI", codeshares: [], scheduledLocal: "12:30:00", date: "12/08/2026", source: "website" }));
  assert.match(out, /VY3981 {2}PMI → SCQ/);
  assert.doesNotMatch(out, /\(\+/);
});

test("formatFlight: REST estimated time shown as arrow when it differs", () => {
  const out = formatFlight(mk({ flightNumber: "UX7235", otherAirport: "MAD", scheduledUtc: "2026-08-12T14:20:00.000Z", estimatedUtc: "2026-08-12T14:31:00.000Z" }));
  assert.match(out, /16:20 → 16:31/);
});

test("formatFlight: no arrow when estimated equals scheduled", () => {
  const out = formatFlight(mk({ flightNumber: "UX7235", otherAirport: "MAD", scheduledUtc: "2026-08-12T14:20:00.000Z", estimatedUtc: "2026-08-12T14:20:00.000Z" }));
  assert.doesNotMatch(out, /→ 16:20 \(hora/);
  assert.match(out, /16:20 \(hora local\)/);
});

// ── matchesFlight against codeshares ──────────────────────────────────────────

test("matchesFlight finds a flight by one of its collapsed codeshare numbers", () => {
  const f = mk({ flightNumber: "VLG1676", codeshares: ["IBE5504", "QTR3719"] });
  assert.equal(matchesFlight(f, "qtr 3719"), true);
  assert.equal(matchesFlight(f, "IB5999"), false);
});

// ── collapseCodeshares edge cases ─────────────────────────────────────────────

test("collapse: all rows are codeshares (operator row missing) → first one wins", () => {
  const grp = [
    mk({ flightNumber: "IBE5504", otherAirport: "BCN", scheduledUtc: "2026-08-12T12:10:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1676" } }),
    mk({ flightNumber: "QTR3719", otherAirport: "BCN", scheduledUtc: "2026-08-12T12:10:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1676" } }),
  ];
  const out = collapseCodeshares(grp);
  assert.equal(out.length, 1);
  assert.equal(out[0].flightNumber, "IBE5504");
  assert.deepEqual(out[0].codeshares, ["QTR3719"]);
});

test("collapse: duplicate marketing numbers are deduped", () => {
  const grp = [
    mk({ flightNumber: "VLG1676", otherAirport: "BCN", scheduledUtc: "2026-08-12T12:10:00.000Z" }),
    mk({ flightNumber: "IBE5504", otherAirport: "BCN", scheduledUtc: "2026-08-12T12:10:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1676" } }),
    mk({ flightNumber: "IBE5504", otherAirport: "BCN", scheduledUtc: "2026-08-12T12:10:00.000Z", mainFlight: { airline: "VLG", flightNumber: "1676" } }),
  ];
  const out = collapseCodeshares(grp);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].codeshares, ["IBE5504"]);
});

test("collapse: same minute but different destination stays separate", () => {
  const grp = [
    mk({ flightNumber: "VY1", otherAirport: "BCN", scheduledUtc: "2026-08-12T12:10:00.000Z" }),
    mk({ flightNumber: "VY2", otherAirport: "MAD", scheduledUtc: "2026-08-12T12:10:00.000Z" }),
  ];
  assert.equal(collapseCodeshares(grp).length, 2);
});

// ── normalizers ───────────────────────────────────────────────────────────────

test("website row: missing iataCompania falls back to compania for the flight number", () => {
  const f = normalizeWebsiteRow({ numVuelo: "123", compania: "IBE" }, "SCQ", "departures");
  assert.equal(f.flightNumber, "IBE123");
});

test("rest row: unknown status code still yields a label", () => {
  const f = normalizeRestRow({ flightID: { airlineIATA: "VLG", flightNumber: "1" }, flightStatus: "ZZZ" }, "SCQ", "departures");
  assert.equal(f.status, "ZZZ");
  assert.equal(typeof f.statusLabel, "string");
  assert.ok(f.statusLabel.length > 0);
});

test("parseAirlineCodes tolerates short/garbage strings", () => {
  assert.deepEqual(parseAirlineCodes("IB"), { iata: "IB", icao: undefined });
  assert.deepEqual(parseAirlineCodes(""), { iata: undefined, icao: undefined });
});

test("clean() stringifies numbers", () => {
  assert.equal(clean(2), "2");
  assert.equal(clean(0), "0");
});

test("sortByProximity picks today's occurrence of a daily flight, not tomorrow's", () => {
  const today = mk({ flightNumber: "UX7235", scheduledUtc: "2026-08-12T17:20:00.000Z" });   // 19:20 Madrid
  const tomorrow = mk({ flightNumber: "UX7235", scheduledUtc: "2026-08-13T17:20:00.000Z" });
  // now = 12/08/2026 16:40 Madrid
  const now = Date.UTC(2026, 7, 12) / 60000 + 16 * 60 + 40;
  assert.equal(sortByProximity([tomorrow, today], now)[0], today);
  // late at night, tomorrow morning's flight is closer than this morning's
  const thisMorning = mk({ flightNumber: "VY1", scheduledUtc: "2026-08-12T06:00:00.000Z" }); // 08:00
  const tomorrowMorning = mk({ flightNumber: "VY1", scheduledUtc: "2026-08-13T06:00:00.000Z" });
  const lateNight = Date.UTC(2026, 7, 12) / 60000 + 23 * 60 + 30;
  assert.equal(sortByProximity([thisMorning, tomorrowMorning], lateNight)[0], tomorrowMorning);
});

test("localEpochMinutes works for website flights and undefined without a time", () => {
  const web = mk({ scheduledLocal: "17:05:00", date: "12/08/2026", source: "website" });
  assert.equal(localEpochMinutes(web), Date.UTC(2026, 7, 12) / 60000 + 17 * 60 + 5);
  assert.equal(localEpochMinutes(mk({})), undefined);
});
