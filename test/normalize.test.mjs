import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWebsiteRow,
  normalizeRestRow,
  parseAirlineCodes,
  clean,
} from "../dist/aena/client.js";

// Fixtures captured from live AENA responses (LCG arrivals, 2026-08-11).

test("clean() drops empty and the literal 'null' string", () => {
  assert.equal(clean("  T4 "), "T4");
  assert.equal(clean("null"), undefined);
  assert.equal(clean(""), undefined);
  assert.equal(clean(null), undefined);
  assert.equal(clean(undefined), undefined);
});

test("parseAirlineCodes reads IATA and ICAO slots", () => {
  assert.deepEqual(parseAirlineCodes("IB,IBE,,IB,IBE,IBE"), { iata: "IB", icao: "IBE" });
  assert.deepEqual(parseAirlineCodes("UX,AEA,,UX,AEA,"), { iata: "UX", icao: "AEA" });
  assert.deepEqual(parseAirlineCodes(undefined), { iata: undefined, icao: undefined });
});

test("website row: builds flight number from IATA + numVuelo, keeps local time", () => {
  const row = {
    numVuelo: "0459",
    iataCompania: "IB",
    oaciCompania: "IBE",
    nombreCompania: "Iberia",
    compania: "IBE",
    iataAena: "LCG",
    iataOtro: "MAD",
    ciudadIataOtro: "MADRID",
    fecha: "11/08/2026",
    horaProgramada: "17:05:00",
    horaEstimada: "17:06:00",
    estado: "BOR",
    tipoVuelo: "L",
    terminal: "T1",
    tipoAeronave: "A319",
    cintaPrimera: "2",
    salaPrimera: "null",
  };
  const f = normalizeWebsiteRow(row, "LCG", "arrivals");
  assert.equal(f.flightNumber, "IB0459");
  assert.equal(f.airline.name, "Iberia");
  assert.equal(f.airport, "LCG");
  assert.equal(f.otherAirport, "MAD");
  assert.equal(f.scheduledLocal, "17:05:00");
  assert.equal(f.estimatedLocal, "17:06:00");
  assert.equal(f.status, "BOR");
  assert.equal(f.statusLabel, "Completed");
  assert.equal(f.baggageBelt, "2");
  assert.equal(f.source, "website");
  assert.equal(f.scheduledUtc, undefined); // website has no UTC
});

test("rest row: airlineIATA is really ICAO, times are UTC", () => {
  const row = {
    flightID: { airlineIATA: "UX", flightNumber: "7235", airportIATA: "LCG", scheduledDate: "2026-08-11T14:20:00.000Z" },
    airportIATAFrom: "MAD",
    actualDate: "2026-08-11T14:31:00.000Z",
    flightStatus: "BOR",
    flightType: "A",
    airlineCodes: "UX,AEA,,UX,AEA,",
    airplaneModel: "738W",
    arrivingTerminal: "T1",
    baggageClaim: { firstBaggageClaim: "1" },
  };
  const f = normalizeRestRow(row, "LCG", "arrivals");
  assert.equal(f.flightNumber, "UX7235");
  assert.equal(f.airline.iata, "UX");
  assert.equal(f.airline.icao, "UX"); // flightID.airlineIATA wins as ICAO source
  assert.equal(f.otherAirport, "MAD");
  assert.equal(f.scheduledUtc, "2026-08-11T14:20:00.000Z");
  assert.equal(f.estimatedUtc, "2026-08-11T14:31:00.000Z");
  assert.equal(f.scheduledLocal, undefined);
  assert.equal(f.baggageBelt, "1");
  assert.equal(f.source, "rest");
  assert.equal(f.mainFlight, undefined);
});

test("rest codeshare: mainFlight parsed despite the 'aiportIATA' typo", () => {
  const row = {
    flightID: { airlineIATA: "IBE", flightNumber: "5308", airportIATA: "BCN", scheduledDate: "2026-04-01T14:30:00.000Z" },
    airportIATATo: "LCG",
    flightStatus: "SCH",
    flightType: "D",
    airlineCodes: "IB,IBE,VY,IB,VLG,IBE",
    mainFlight: { airlineIATA: "VLG", flightNumber: "1294", aiportIATA: "BCN", departureScheduledDate: "2026-04-01T14:30:00.000Z" },
  };
  const f = normalizeRestRow(row, "BCN", "departures");
  assert.deepEqual(f.mainFlight, { airline: "VLG", flightNumber: "1294", airport: "BCN" });
});
