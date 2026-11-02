// The flights worker on two saved adsb.lol responses: the same O'Hare query about a minute apart (66 s by their `now`;
// fixtures/adsblol-ord-a.json and -b.json, saved 2026-11-02). The parse decides what a golfer sees; the coarsening plus diffRows decide what gets
// written, and every write is a Realtime message to every open Flights page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diffRows } from "../_shared/diff.ts";
import { airlineFor } from "../poll-flights/airlines.ts";
import { FLIGHT_FIELDS, FLIGHT_KEY, parseFlights, phaseOf, selectAirports, type FlightRow } from "../poll-flights/parse.ts";
import { fetchFirst, SOURCES, Spacer, spacersFor, type Clock } from "../poll-flights/sources.ts";

type Raw = { hex: string; flight?: string; r?: string; alt_baro?: number | "ground"; gs?: number; lat?: number; lon?: number; dst?: number };
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as { ac: Raw[] };
const A = fixture("adsblol-ord-a.json");
const B = fixture("adsblol-ord-b.json");
const rowsA = parseFlights(A, "ORD");
const rowsB = parseFlights(B, "ORD");
const diff = (saved: FlightRow[], next: FlightRow[]) => diffRows<FlightRow, "airport" | "hex">(saved, next, FLIGHT_KEY, FLIGHT_FIELDS);

// Every aircraft with a position becomes exactly one row (counted straight from the raw JSON, not by the parser),
// including the three on the ground with no callsign, which are named by their registration instead.
test("fixture A: one row per positioned aircraft, unnamed ones fall back to the registration", () => {
  const positioned = new Set(A.ac.filter((a) => typeof a.lat === "number" && typeof a.lon === "number").map((a) => a.hex));
  assert.equal(rowsA.length, positioned.size);
  assert.equal(rowsA.length, 60);
  for (const a of A.ac.filter((x) => !x.flight?.trim())) {
    const row = rowsA.find((r) => r.hex === a.hex);
    assert.equal(row?.callsign, a.r, `hex ${a.hex}`);
  }
  assert.ok(rowsA.every((r) => r.airport === "ORD" && r.callsign === r.callsign?.trim()));
});

// A busy hub 20 s in: planes on the ground, some arriving, some departing, some passing over. If a phase vanished,
// the board's counts would silently lie.
test("fixture A: all four phases appear, and ground rows sit at 0 ft", () => {
  const phases = new Set(rowsA.map((r) => r.phase));
  assert.deepEqual([...phases].sort(), ["arriving", "departing", "ground", "overhead"]);
  const groundRaw = A.ac.filter((a) => a.alt_baro === "ground").map((a) => a.hex);
  for (const hex of groundRaw) assert.equal(rowsA.find((r) => r.hex === hex)?.phase, "ground", hex);
  for (const r of rowsA.filter((x) => x.phase === "ground")) assert.equal(r.alt_ft, 0, r.hex);
});

// The phase rules on hand-made aircraft, so each boundary is pinned: 12,000 ft ceiling, ±300 ft/min, the ground test.
test("phaseOf: ground, arriving, departing, overhead at their boundaries", () => {
  assert.equal(phaseOf({ alt_baro: "ground" }), "ground");
  assert.equal(phaseOf({ alt_baro: 150, gs: 20 }), "ground");
  assert.equal(phaseOf({ alt_baro: 150, gs: 140, baro_rate: -700 }), "arriving"); // short final, not taxiing
  assert.equal(phaseOf({ alt_baro: 4000, baro_rate: -800 }), "arriving");
  assert.equal(phaseOf({ alt_baro: 4000, baro_rate: 1500 }), "departing");
  assert.equal(phaseOf({ alt_baro: 4000, baro_rate: -200 }), "overhead"); // nearly level
  assert.equal(phaseOf({ alt_baro: 13000, baro_rate: -1500 }), "overhead"); // descending, but still en route
  assert.equal(phaseOf({ alt_baro: 9000 }), "overhead"); // no vertical rate reported
});

// Coarsening is what makes "only what changed" meaningful: altitude to the nearest 1,000 ft, distance to whole nm.
test("fixture A: altitude and distance are coarsened", () => {
  for (const r of rowsA) {
    if (r.alt_ft !== null) assert.equal(r.alt_ft % 1000, 0, `${r.hex} alt ${r.alt_ft}`);
    if (r.dist_nm !== null) assert.ok(Number.isInteger(r.dist_nm), `${r.hex} dst ${r.dist_nm}`);
  }
  const lxj = rowsA.find((r) => r.callsign === "LXJ575"); // alt_baro 45025, dst 22.587 in the raw JSON
  assert.equal(lxj?.alt_ft, 45000);
  assert.equal(lxj?.dist_nm, 23);
});

// Callsign prefixes map to airlines (mainline, regional, bizjet), N-numbers to "Private", unknown designators to null.
test("airlines: known prefixes map, N-numbers are private, unknown is null", () => {
  const aal = rowsA.find((r) => r.callsign?.startsWith("AAL"));
  assert.equal(aal?.airline, "American");
  assert.equal(rowsA.find((r) => r.callsign?.startsWith("ENY"))?.airline, "Envoy");
  assert.equal(rowsA.find((r) => r.callsign === "EJA401")?.airline, "NetJets");
  assert.equal(rowsA.find((r) => r.callsign === "N6052C")?.airline, "Private");
  assert.equal(airlineFor("ZZZ123"), null);
  assert.equal(airlineFor(""), null);
  assert.equal(airlineFor("UAL1"), "United");
});

// The common case at a 30 s tick: nothing a golfer would notice changed, so nothing is written.
test("diff A → A: no upserts, no deletes", () => {
  const d = diff(rowsA, parseFlights(A, "ORD"));
  assert.deepEqual(d, { upserts: [], deletes: [] });
});

// A then B, with the expected sets computed independently from the raw JSON (coarsened by hand here): only new
// planes and planes whose visible fields moved are upserted, and exactly the planes missing from B are deleted.
test("diff A → B: only new/changed rows upsert, and exactly the planes missing from B are deleted", () => {
  const hexA = new Set(A.ac.map((a) => a.hex));
  const hexB = new Set(B.ac.map((a) => a.hex));
  const expectedDeletes = [...hexA].filter((h) => !hexB.has(h)).sort();
  const expectedNew = [...hexB].filter((h) => !hexA.has(h));

  const d = diff(rowsA, rowsB);
  assert.deepEqual(d.deletes.map((x) => x.hex).sort(), expectedDeletes);
  assert.ok(d.deletes.every((x) => x.airport === "ORD"));
  const up = new Set(d.upserts.map((r) => r.hex));
  for (const h of expectedNew) assert.ok(up.has(h), `new plane ${h} not upserted`);

  // Every upserted plane that was already there must differ in a visible field; every one left out must be identical.
  const byHexA = new Map(rowsA.map((r) => [r.hex, r]));
  for (const r of rowsB) {
    const old = byHexA.get(r.hex);
    if (!old) continue;
    const differs = FLIGHT_FIELDS.some((f) => old[f] !== r[f]);
    assert.equal(up.has(r.hex), differs, `${r.hex} ${r.callsign}`);
  }
  // Planes parked on the ground in both responses (same spot, same callsign) are never rewritten: the quiet part of
  // the board costs nothing. Moving planes do cross a 1 nm or 1,000 ft line in a minute, and those are real changes.
  const parked = rowsB.filter((r) => r.phase === "ground" && byHexA.get(r.hex)?.phase === "ground" && byHexA.get(r.hex)?.dist_nm === r.dist_nm && byHexA.get(r.hex)?.callsign === r.callsign);
  assert.ok(parked.length >= 10, `only ${parked.length} parked`);
  for (const r of parked) assert.ok(!up.has(r.hex), `parked ${r.hex} was upserted`);
  assert.ok(d.upserts.length < rowsB.length, `${d.upserts.length} of ${rowsB.length} upserted`);
  assert.ok(expectedDeletes.length > 0 && expectedNew.length > 0, "fixtures should have planes leaving and arriving");
});

// A plane holding at 4,300 ft that drifts to 4,450 ft is the same row; one that climbs through 4,500 is a change.
test("coarsening hides tiny moves and keeps real ones", () => {
  const base = { hex: "abc123", flight: "AAL1  ", lat: 42, lon: -88, baro_rate: 0 };
  const [r1] = parseFlights({ ac: [{ ...base, alt_baro: 4300, dst: 9.2 }] }, "ORD");
  const [r2] = parseFlights({ ac: [{ ...base, alt_baro: 4450, dst: 8.6 }] }, "ORD");
  const [r3] = parseFlights({ ac: [{ ...base, alt_baro: 4600, dst: 8.6 }] }, "ORD");
  assert.equal(diff([r1], [r2]).upserts.length, 0);
  assert.equal(diff([r1], [r3]).upserts.length, 1);
});

// Bad entries never reach the database: no position, a malformed hex. A missing ac[] is an error (the run is "down").
test("rows without a position or a valid hex are skipped; a response without ac[] throws", () => {
  const rows = parseFlights({ ac: [{ hex: "a1b2c3", flight: "UAL9" }, { hex: "nothex", lat: 1, lon: 1 }, { hex: "A1B2C4", lat: 42, lon: -88, alt_baro: 3000 }] }, "ORD");
  assert.deepEqual(rows.map((r) => r.hex), ["a1b2c4"]);
  assert.throws(() => parseFlights({ msg: "error" }, "ORD"));
});

// One adsb.lol call per airport no matter how many golfers follow it, the most-followed first, at most 6, ORD always.
test("selectAirports: dedupes across golfers, ranks by followers, caps at 6, always includes ORD", () => {
  const follows = [
    ...["SAN", "SAN", "SAN", "MRY", "MRY", "SAV", "EDI", "CHS", "PIT", "SEA"].map((airport) => ({ airport })),
    { airport: "san" }, // case doesn't matter
  ];
  const picked = selectAirports(follows);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked).size, 6);
  assert.deepEqual(picked.slice(0, 2), ["SAN", "MRY"]);
  assert.ok(picked.includes("ORD"));
  assert.deepEqual(selectAirports([]), ["ORD"]);
  assert.deepEqual(selectAirports([{ airport: "ORD" }, { airport: "ORD" }, { airport: "SAN" }]), ["ORD", "SAN"]);
});

// ───────── The adsb.fi fallback ─────────

// adsb.fi answers with the same readsb fields under `aircraft` instead of `ac` (fixtures/adsbfi-ord.json, a real O'Hare
// response saved 2026-11-02). The parser must read it the same way, or a fallback tick would empty the board.
test("adsb.fi response: the `aircraft` list parses like adsb.lol's `ac`", () => {
  const fi = JSON.parse(readFileSync(new URL("./fixtures/adsbfi-ord.json", import.meta.url), "utf8")) as { aircraft: Raw[] };
  const rows = parseFlights(fi, "ORD");
  const positioned = new Set(fi.aircraft.filter((a) => typeof a.lat === "number" && typeof a.lon === "number").map((a) => a.hex));
  assert.equal(rows.length, positioned.size);
  assert.ok(rows.length >= 10, `${rows.length} rows`);
  assert.ok(rows.some((r) => r.phase === "ground"));
  assert.ok(rows.some((r) => r.airline !== null));
  // And fixture A with its list renamed gives exactly fixture A's rows.
  assert.deepEqual(parseFlights({ aircraft: A.ac }, "ORD"), rowsA);
});

/** A fake clock: sleep advances time instantly and records each wait. */
function fakeClock(): Clock & { waits: number[] } {
  let t = 0;
  const waits: number[] = [];
  return { waits, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } };
}
const http = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
const describe = (e: unknown) => String((e as { status?: number }).status ?? "error");
const ORD = { lat: 41.9786, lon: -87.9048 };

// The fallback decision: adsb.lol first; adsb.fi only when adsb.lol fails (429 or anything else); both failing is a
// failure that names both reasons (the worker then keeps that airport's rows).
test("fetchFirst: adsb.lol answers → adsb.fi is never called", async () => {
  const calls: string[] = [];
  const got = await fetchFirst(ORD, async (u) => { calls.push(u); return { ac: [] }; }, spacersFor(fakeClock()), describe);
  assert.equal(got.ok && got.source, "lol");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.adsb\.lol\/v2\/point\/41\.9786\/-87\.9048\/15$/);
});

test("fetchFirst: adsb.lol 429 → the same airport from adsb.fi", async () => {
  const calls: string[] = [];
  const got = await fetchFirst(ORD, async (u) => { calls.push(u); if (u.includes("adsb.lol")) throw http(429); return { aircraft: [] }; }, spacersFor(fakeClock()), describe);
  assert.ok(got.ok);
  assert.equal(got.ok && got.source, "fi");
  assert.deepEqual(got.tried, ["lol 429"]);
  assert.match(calls[1], /opendata\.adsb\.fi\/api\/v2\/lat\/41\.9786\/lon\/-87\.9048\/dist\/15$/);
});

test("fetchFirst: any adsb.lol error falls back; both failing reports both", async () => {
  const both = await fetchFirst(ORD, async (u) => { throw http(u.includes("adsb.lol") ? 503 : 429); }, spacersFor(fakeClock()), describe);
  assert.deepEqual(both, { ok: false, tried: ["lol 503", "fi 429"] });
});

// adsb.fi asks for at most one request a second: fallbacks from several airports in the same run (even two at once)
// are queued at least 1.1 s apart; adsb.lol calls aren't held back.
test("adsb.fi calls in one run are spaced at least 1.1 s apart, even in parallel", async () => {
  const clock = fakeClock();
  const spacers = spacersFor(clock);
  const fiTimes: number[] = [];
  const fetcher = async (u: string) => { if (u.includes("adsb.lol")) throw http(429); fiTimes.push(clock.now()); return { aircraft: [] }; };
  await Promise.all([fetchFirst(ORD, fetcher, spacers, describe), fetchFirst({ lat: 33.1, lon: -117.3 }, fetcher, spacers, describe)]);
  await fetchFirst(ORD, fetcher, spacers, describe);
  assert.equal(fiTimes.length, 3);
  for (let i = 1; i < fiTimes.length; i++) assert.ok(fiTimes[i] - fiTimes[i - 1] >= 1100, `gap ${fiTimes[i] - fiTimes[i - 1]}`);
  assert.equal(SOURCES.find((s) => s.id === "lol")?.minGapMs, 0);
  assert.ok(new Spacer(1100, clock) instanceof Spacer);
});
