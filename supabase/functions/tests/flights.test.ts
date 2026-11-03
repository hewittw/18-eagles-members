// The route-board worker (poll-flights) on saved real responses: adsb.lol's aircraft within 100 nm of O'Hare and of
// San Diego (fixtures/adsblol-ord-100nm.json, adsblol-san-100nm.json), and two adsb.im routeset answers: a small one
// (adsbim-routeset-small.json: a route, an implausible one, an unknown) and every airline callsign within 100 nm of
// Midway in one batch (adsbim-routeset-mdw-request.json → adsbim-routeset-mdw.json: 138 asked, multi-stop routes,
// nulls), all saved 2026-11-02 with curl and a real User-Agent. Each rule here
// decides what a golfer sees on the board, or what a run spends of the free sources' goodwill.
// (The old 15 nm airport-board tests went with airport_flights, which nothing writes any more.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diffRows } from "../_shared/diff.ts";
import { airlineFor, flightNumberFor, isAirlineCallsign } from "../poll-flights/airlines.ts";
import { aircraftList, type AdsbAircraft } from "../poll-flights/parse.ts";
import {
  chooseLookups, chunk, flightNumber, flightState, isFresh, LOOKUP_BUDGET, lookupRoutes, matchRoute, mergeSeen, pairAirlines,
  pairKey, parseRouteset, pickLeg, planBoard, ROUTE_SOURCE, ROUTESET_CHUNK, routesetBody, seenAircraft, trackHexes, TRIP_FIELDS,
  TRIP_KEY, watchPairs, type Route, type RoutesetPlane, type SavedTripFlight, type Seen, type Stop, type TripFlightRow,
} from "../poll-flights/route.ts";
import { fetchFirst, hexUrl, SOURCES, Spacer, spacersFor, type Clock } from "../poll-flights/sources.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const ORD = { lat: 41.9786, lon: -87.9048 };
const SAN = { lat: 32.7336, lon: -117.1897 };
const CLD = { lat: 33.1283, lon: -117.2800 };
const coords = new Map([["ORD", ORD], ["SAN", SAN], ["CLD", CLD], ["LAX", { lat: 33.9425, lon: -118.4081 }], ["EWR", { lat: 40.6925, lon: -74.1687 }]]);
const ordList: AdsbAircraft[] = aircraftList(fixture("adsblol-ord-100nm.json"));
const sanList: AdsbAircraft[] = aircraftList(fixture("adsblol-san-100nm.json"));
const ordSeen = seenAircraft(ordList, "ORD", ORD);
const sanSeen = seenAircraft(sanList, "SAN", SAN);
const NOW = Date.parse("2026-11-02T23:00:00Z");

// Only airline flights can be on a golfer's route. Counted straight from the raw JSON with an independent filter.
test("seenAircraft: keeps positioned airline callsigns only (no N-numbers, cargo, bizjets)", () => {
  const raw = ordList.filter((a) => typeof a.lat === "number" && /^[A-Z]{3}\d{1,4}[A-Z]{0,2}$/.test((a.flight ?? "").trim())
    && !/^(FDX|UPS|GTI|ABX|ATN|CKS|EJA|LXJ|JRE|GJE)/.test((a.flight ?? "").trim()));
  assert.ok(ordSeen.length > 50, `${ordSeen.length} at ORD`);
  assert.ok(ordSeen.length <= raw.length);
  assert.ok(ordSeen.every((s) => isAirlineCallsign(s.callsign)));
  assert.ok(!ordSeen.some((s) => /^(N\d|FDX|EJA|JRE|GTI)/.test(s.callsign)));
  assert.ok(ordSeen.every((s) => s.dist >= 0 && s.dist <= 101));
  assert.ok(sanSeen.length > 20, `${sanSeen.length} at SAN`);
  assert.equal(isAirlineCallsign("N6052C"), false);
  assert.equal(isAirlineCallsign("FDX1443"), false);
  assert.equal(isAirlineCallsign("UAL1234"), true);
  assert.equal(airlineFor("ASA500"), "Alaska");
});

// One aircraft in both circles counts once, from the nearer airport.
test("mergeSeen: one sighting per hex, the nearest", () => {
  const s = ordSeen[0];
  const m = mergeSeen([ordSeen, [{ ...s, near: "MKE", dist: s.dist - 1 }]]);
  assert.equal(m.size, new Set(ordSeen.map((x) => x.hex)).size);
  assert.equal(m.get(s.hex)?.near, "MKE");
});

/** A sighting at the position we sent adsb.im (the request fixture's planes). */
const asSeen = (p: RoutesetPlane, extra: Partial<Seen> = {}): Seen =>
  ({ hex: "a00000", callsign: p.callsign, type: null, lat: p.lat, lon: p.lng, alt: null, ground: false, rate: null, near: "MDW", dist: 0, ...extra });
const mdwAsked: Seen[] = (fixture("adsbim-routeset-mdw-request.json").planes as RoutesetPlane[]).map((p) => asSeen(p));
const mdwAnswer: unknown[] = fixture("adsbim-routeset-mdw.json");

// adsb.im's real answer: UAL2486 SAN → ORD (asked at O'Hare), printed "UA 2486"; SWA3224's route (ONT-PHX) isn't
// plausible over Chicago, and ZZZ9999 is "unknown": both cache as not found.
test("parseRouteset: a real route, an implausible one, an unknown callsign", () => {
  const asked = [
    asSeen({ callsign: "UAL2486", lat: 41.98, lng: -87.9 }), asSeen({ callsign: "SWA3224", lat: 41.78, lng: -87.75 }),
    asSeen({ callsign: "ZZZ9999", lat: 41.98, lng: -87.9 }), asSeen({ callsign: "AAL1", lat: 40.6, lng: -73.8 }),
  ];
  const [ual, swa, zzz, aal] = parseRouteset(asked, fixture("adsbim-routeset-small.json"), NOW);
  assert.deepEqual({ ...ual, stops: undefined }, {
    callsign: "UAL2486", origin: "SAN", destination: "ORD", route: "SAN-ORD", stops: undefined, airline: "United",
    flight: "UA 2486", found: true, source: ROUTE_SOURCE, fetched_at: new Date(NOW).toISOString(),
  });
  assert.deepEqual(ual.stops, [{ code: "SAN", lat: 32.733601, lon: -117.190002 }, { code: "ORD", lat: 41.9786, lon: -87.9048 }]);
  assert.equal(swa.found, false);
  assert.equal(swa.origin, null);
  assert.equal(zzz.found, false);
  assert.equal(zzz.source, ROUTE_SOURCE);
  assert.equal(aal.route, "JFK-LAX");
  assert.equal(aal.flight, "AA 1");
  assert.equal(flightNumber("AS500"), "AS 500");
  assert.equal(flightNumber("nope"), null);
  assert.equal(flightNumberFor("SKW5512"), "OO 5512");
  assert.equal(flightNumberFor("QQQ12"), null);
  assert.throws(() => parseRouteset(asked, { error: "nope" }, NOW));
});

// The whole Midway batch: one row per callsign asked, found exactly where adsb.im has a plausible route (counted from
// the raw JSON), nulls cached as not found, multi-stop routes kept whole, and the answer's order doesn't matter.
test("parseRouteset: 138 real callsigns in one answer, nulls and multi-stop routes", () => {
  const rows = parseRouteset(mdwAsked, mdwAnswer, NOW);
  assert.equal(rows.length, mdwAsked.length);
  assert.deepEqual(rows.map((r) => r.callsign), mdwAsked.map((s) => s.callsign));
  type E = { _airport_codes_iata: string; plausible?: boolean } | null;
  const plausible = (mdwAnswer as E[]).filter((e) => e && e.plausible === true && e._airport_codes_iata !== "unknown").length;
  assert.equal(rows.filter((r) => r.found).length, plausible);
  for (const cs of ["SWA3131", "UAL779", "EJA175"]) assert.equal(rows.find((r) => r.callsign === cs)?.found, false, cs); // null entries
  const asa = rows.find((r) => r.callsign === "ASA1478")!;
  assert.equal(asa.route, "SAN-ORD-SAN");
  assert.deepEqual(asa.stops!.map((x) => x.code), ["SAN", "ORD", "SAN"]);
  assert.equal(rows.find((r) => r.callsign === "UAL2168")?.route, "SFO-IAH-DEN-LGA");
  assert.ok(rows.filter((r) => r.found).every((r) => r.stops!.length >= 2 && r.route!.split("-").length === r.stops!.length));
  const shuffled = [...mdwAnswer].reverse();
  assert.deepEqual(parseRouteset(mdwAsked, shuffled, NOW).map((r) => r.route), rows.map((r) => r.route));
});

// One flight number, several stops: which leg is it flying right now? ASA1478 is SAN → ORD → SAN.
test("pickLeg: the leg that fits the position, climb and heading (SAN-ORD-SAN)", () => {
  const stops = parseRouteset(mdwAsked, mdwAnswer, NOW).find((r) => r.callsign === "ASA1478")!.stops as Stop[];
  const leg = (s: Partial<Seen>, hint?: { origin: string; destination: string }) => {
    const l = pickLeg(stops, { lat: 0, lon: 0, alt: null, ground: false, rate: null, track: null, ...s }, hint);
    return l ? `${l.from.code}-${l.to.code} ${l.state.phase}` : null;
  };
  assert.equal(leg({ lat: 41.9, lon: -88.3, alt: 6000, rate: -1200 }), "SAN-ORD arriving"); // on its way down into ORD
  assert.equal(leg({ lat: 41.9, lon: -88.3, alt: 5000, rate: 2200 }), "ORD-SAN departing"); // climbing out: the next leg
  assert.equal(leg({ lat: 37.5, lon: -103, alt: 36_000, rate: 0, track: 240 }), "ORD-SAN en_route");
  assert.equal(leg({ lat: 37.5, lon: -103, alt: 36_000, rate: 0, track: 60 }), "SAN-ORD en_route");
  assert.equal(leg({ lat: 41.98, lon: -87.9, ground: true }), "ORD-SAN departing"); // at the gate: next leg by default
  assert.equal(leg({ lat: 41.98, lon: -87.9, ground: true }, { origin: "SAN", destination: "ORD" }), "SAN-ORD landed");
  assert.equal(leg({ lat: 28.4, lon: -81.3, alt: 35_000, rate: 0, track: 200 }), null); // over Florida: on neither leg
  // Four stops: over Denver, climbing out east → DEN-LGA; descending into Denver from the south → IAH-DEN.
  const ual = parseRouteset(mdwAsked, mdwAnswer, NOW).find((r) => r.callsign === "UAL2168")!.stops as Stop[];
  assert.equal(pickLeg(ual, { lat: 39.9, lon: -104.4, alt: 12_000, ground: false, rate: 2500, track: 80 })?.to.code, "LGA");
  assert.equal(pickLeg(ual, { lat: 39.4, lon: -104.6, alt: 11_000, ground: false, rate: -1500, track: 350 })?.to.code, "DEN");
});

// The cache's two lifetimes: a found route for 7 days, a "not found" for 1 day.
test("isFresh: routes 7 days, misses 1 day", () => {
  const at = (h: number) => new Date(NOW - h * 3600_000).toISOString();
  assert.equal(isFresh({ found: true, fetched_at: at(24 * 6.9) }, NOW), true);
  assert.equal(isFresh({ found: true, fetched_at: at(24 * 7.1) }, NOW), false);
  assert.equal(isFresh({ found: false, fetched_at: at(23) }, NOW), true);
  assert.equal(isFresh({ found: false, fetched_at: at(25) }, NOW), false);
});

// ORD→SAN and SAN→ORD are one board; the most-shared pairs win the 4 places; a drive (SAN–CLD) and a no-trip
// (same airport) are never watched.
test("pairKey + watchPairs: normalised, ranked, capped at 4, drives skipped", () => {
  assert.equal(pairKey("san", "ORD"), "ORD-SAN");
  assert.equal(pairKey("ORD", "ORD"), null);
  const trips = [
    { from_airport: "ORD", to_airport: "SAN" }, { from_airport: "SAN", to_airport: "ORD" }, { from_airport: "ORD", to_airport: "LAX" },
    { from_airport: "SAN", to_airport: "CLD" }, { from_airport: "SAN", to_airport: "CLD" }, { from_airport: "SAN", to_airport: "CLD" },
    { from_airport: "ORD", to_airport: "ORD" }, { from_airport: "EWR", to_airport: "ORD" }, { from_airport: "EWR", to_airport: "LAX" },
    { from_airport: "EWR", to_airport: "SAN" },
  ];
  const pairs = watchPairs(trips, coords);
  assert.deepEqual(pairs.map((p) => `${p.key}:${p.trips}`), ["ORD-SAN:2", "EWR-LAX:1", "EWR-ORD:1", "EWR-SAN:1"]);
  assert.deepEqual(pairs[0], { key: "ORD-SAN", a: "ORD", b: "SAN", trips: 2 });
  assert.deepEqual(watchPairs([]), []);
});

test("matchRoute: either direction, nothing else", () => {
  const p = { a: "ORD", b: "SAN" };
  assert.equal(matchRoute({ found: true, origin: "ORD", destination: "SAN" }, p), "ab");
  assert.equal(matchRoute({ found: true, origin: "SAN", destination: "ORD" }, p), "ba");
  assert.equal(matchRoute({ found: true, origin: "EWR", destination: "ORD" }, p), null);
  assert.equal(matchRoute({ found: false, origin: null, destination: null }, p), null);
  assert.equal(matchRoute(undefined, p), null);
});

// Phase and progress from a position: the four phases, at the places they change.
test("flightState: departing, en route, arriving, landed; progress to 5 %", () => {
  const climbing = flightState({ lat: 41.9, lon: -88.3, alt: 9400, ground: false, rate: 2200 }, ORD, SAN);
  assert.equal(climbing?.phase, "departing");
  assert.equal(climbing?.alt_ft, 9000);
  assert.equal(climbing?.progress_pct, 0);
  const mid = flightState({ lat: 37.5, lon: -103, alt: 36_200, ground: false, rate: 0 }, ORD, SAN)!;
  assert.equal(mid.phase, "en_route");
  assert.equal(mid.progress_pct % 5, 0);
  assert.ok(mid.progress_pct >= 45 && mid.progress_pct <= 60, `${mid.progress_pct}`);
  const final = flightState({ lat: 32.9, lon: -116.9, alt: 6100, ground: false, rate: -900 }, ORD, SAN);
  assert.equal(final?.phase, "arriving");
  assert.ok(final!.progress_pct >= 95);
  assert.deepEqual(flightState({ lat: 32.734, lon: -117.19, alt: null, ground: true, rate: null }, ORD, SAN), { phase: "landed", progress_pct: 100, alt_ft: 0 });
  assert.deepEqual(flightState({ lat: 41.98, lon: -87.9, alt: null, ground: true, rate: null }, ORD, SAN), { phase: "departing", progress_pct: 0, alt_ft: 0 });
  assert.equal(flightState({ lat: 39.8, lon: -104.7, alt: null, ground: true, rate: null }, ORD, SAN), null); // on the ground at DEN
  assert.equal(flightState({ lat: 41.97, lon: -87.95, alt: 300, ground: false, rate: 1500 }, ORD, SAN)?.alt_ft, 1000);
  // The same flight number on its next leg: climbing out of SAN, or on its way down into ORD. Not this route.
  assert.equal(flightState({ lat: 33.1, lon: -116.6, alt: 22_000, ground: false, rate: 2000 }, ORD, SAN), null);
  assert.equal(flightState({ lat: 41.6, lon: -88.6, alt: 14_000, ground: false, rate: -1800 }, ORD, SAN), null);
  assert.equal(flightState({ lat: 41.95, lon: -87.8, alt: 2000, ground: false, rate: -800 }, ORD, SAN), null); // landing at ORD
  // At cruise mid-route: heading roughly toward SAN (south-west, ~240°) is on the route; heading north-east isn't.
  assert.equal(flightState({ lat: 37.5, lon: -103, alt: 36_000, ground: false, rate: 0, track: 240 }, ORD, SAN)?.phase, "en_route");
  assert.equal(flightState({ lat: 37.5, lon: -103, alt: 36_000, ground: false, rate: 0, track: 50 }, ORD, SAN), null);
  // Inside the terminal area a plane may point anywhere (vectors, a downwind leg): no track check there.
  assert.equal(flightState({ lat: 32.9, lon: -116.9, alt: 9000, ground: false, rate: -900, track: 30 }, ORD, SAN)?.phase, "arriving");
});

// The lookup budget on a real ORD + SAN minute: each callsign once, never one already cached and fresh, climbing/
// descending aircraft before level ones, at most 200; each carries the position adsb.im checks it against.
test("chooseLookups: unique, cached skipped, moving aircraft first, capped", () => {
  const all = mergeSeen([ordSeen, sanSeen]);
  const callsigns = new Set([...all.values()].map((s) => s.callsign));
  const first = chooseLookups(all.values(), new Map(), NOW);
  assert.equal(first.length, Math.min(LOOKUP_BUDGET, callsigns.size));
  assert.equal(new Set(first.map((s) => s.callsign)).size, first.length);
  assert.ok(first.every((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon)));
  const moving = (s: Seen) => !s.ground && Math.abs(s.rate ?? 0) > 300;
  const firstLevel = first.findIndex((s) => !moving(s));
  if (firstLevel >= 0) assert.ok(first.slice(firstLevel).every((s) => !moving(s)), "a moving aircraft after a level one");
  assert.equal(chooseLookups(all.values(), new Map(), NOW, 30).length, 30);
  const cached = new Map(first.slice(0, 40).map((s) => [s.callsign, { found: true, fetched_at: new Date(NOW - 3600_000).toISOString() }]));
  const second = chooseLookups(all.values(), cached, NOW);
  assert.ok(second.every((s) => !cached.has(s.callsign)));
  assert.equal(second.length, Math.min(LOOKUP_BUDGET, callsigns.size - 40));
  const stale = new Map(first.map((s) => [s.callsign, { found: false, fetched_at: new Date(NOW - 30 * 3600_000).toISOString() }]));
  assert.deepEqual(chooseLookups(all.values(), stale, NOW), first);
});

// Batching: 138 real callsigns go out as two POSTs (100 + 38), in order, never one per callsign; the body is the
// shape adsb.im takes; a failed chunk stops the run's lookups (and keeps what came back), and so does the time limit.
test("lookupRoutes: one POST per 100 callsigns, real answers, stops on a failure", async () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 100), []);
  assert.deepEqual(routesetBody([{ callsign: "UAL2486", lat: 41.978612, lon: -87.904833 }]), { planes: [{ callsign: "UAL2486", lat: 41.9786, lng: -87.9048 }] });
  const bodies: { planes: RoutesetPlane[] }[] = [];
  // The fake adsb.im answers each chunk with the real entries for those callsigns, in order.
  const byCs = new Map((mdwAnswer as ({ callsign: string } | null)[]).map((e, i) => [mdwAsked[i].callsign, e]));
  const post = async (b: { planes: RoutesetPlane[] }) => { bodies.push(b); return b.planes.map((p) => byCs.get(p.callsign) ?? null); };
  const got = await lookupRoutes(mdwAsked, post, () => NOW);
  assert.equal(got.calls, 2);
  assert.deepEqual(bodies.map((b) => b.planes.length), [ROUTESET_CHUNK, mdwAsked.length - ROUTESET_CHUNK]);
  assert.deepEqual(bodies.flatMap((b) => b.planes.map((p) => p.callsign)), mdwAsked.map((s) => s.callsign));
  assert.deepEqual(got.looked.map((r) => r.route), parseRouteset(mdwAsked, mdwAnswer, NOW).map((r) => r.route));
  assert.equal(got.error, null);

  let n = 0;
  const failing = async (b: { planes: RoutesetPlane[] }) => { if (n++ === 1) throw http(429); return post(b); };
  const half = await lookupRoutes([...mdwAsked, ...mdwAsked.slice(0, 80)], failing, () => NOW);
  assert.equal(half.calls, 2);
  assert.equal(half.looked.length, ROUTESET_CHUNK);
  assert.equal((half.error as { status: number }).status, 429);
  const late = await lookupRoutes(mdwAsked, post, () => NOW, () => true);
  assert.deepEqual([late.calls, late.looked.length, late.stopped], [0, 0, true]);
});

// The cache: what one run looked up is reused by the next (no lookup), for 7 days if found and 1 day if not; and the
// board reads multi-stop routes from it.
test("cache reuse: looked-up routes aren't asked again until they go stale", async () => {
  const rows = parseRouteset(mdwAsked, mdwAnswer, NOW);
  const cache = new Map(rows.map((r) => [r.callsign, r]));
  assert.equal(chooseLookups(mdwAsked, cache, NOW + 3600_000).length, 0);
  const missing = rows.filter((r) => !r.found).length;
  assert.equal(chooseLookups(mdwAsked, cache, NOW + 25 * 3600_000).length, missing); // misses retried after a day
  assert.equal(chooseLookups(mdwAsked, cache, NOW + 8 * 24 * 3600_000).length, mdwAsked.length); // everything after a week
});

// Multi-stop routes on the board: ASA1478 (SAN-ORD-SAN) is on the ORD-SAN board whichever leg it flies, with the
// leg's direction; UAL1557 (ABQ-ORD-BWI) never is; the stops' positions come from the cache, not the trip airports.
test("planBoard: a multi-stop route joins the pair on the leg it's flying", () => {
  const pairs = watchPairs([{ from_airport: "ORD", to_airport: "SAN" }], coords);
  const rows = parseRouteset(mdwAsked, mdwAnswer, NOW);
  const routes = new Map(rows.map((r) => [r.callsign, r]));
  const climbing: Seen = { hex: "a1b2c3", callsign: "ASA1478", type: "B39M", lat: 41.9, lon: -88.3, alt: 5000, ground: false, rate: 2200, track: 250, near: "ORD", dist: 20 };
  const ual: Seen = { hex: "a1b2c4", callsign: "UAL1557", type: "B739", lat: 41.9, lon: -88.3, alt: 5000, ground: false, rate: 2200, track: 100, near: "ORD", dist: 20 };
  const plan = planBoard({ pairs, coords: new Map([["ORD", ORD], ["SAN", SAN]]), seen: new Map([[climbing.hex, climbing], [ual.hex, ual]]), tracked: new Map(), routes, saved: [], now: NOW });
  assert.deepEqual(plan.rows.map((r) => [r.hex, r.origin, r.destination, r.phase, r.flight, r.airline]), [["a1b2c3", "ORD", "SAN", "departing", "AS 1478", "Alaska"]]);
  const down = { ...climbing, lat: 33.0, lon: -116.9, alt: 9000, rate: -1500, track: 250 };
  const back = planBoard({ pairs, coords, seen: new Map([[down.hex, down]]), tracked: new Map(), routes, saved: [], now: NOW });
  assert.equal(back.rows[0]?.destination, "SAN");
  const arriving = { ...climbing, lat: 41.9, lon: -88.3, alt: 6000, rate: -1200, track: 80 };
  const into = planBoard({ pairs, coords, seen: new Map([[arriving.hex, arriving]]), tracked: new Map(), routes, saved: [], now: NOW });
  assert.deepEqual(into.rows.map((r) => `${r.origin}-${r.destination} ${r.phase}`), ["SAN-ORD arriving"]);
});

// The whole board on real aircraft: give two real O'Hare departures (and one SAN arrival) an ORD↔SAN route and
// check the board, then run it again unchanged (0 writes), then let time pass (drops).
test("planBoard: real aircraft on the ORD-SAN pair, a quiet second run, and the drops", () => {
  const pairs = watchPairs([{ from_airport: "ORD", to_airport: "SAN" }], coords);
  const seen = mergeSeen([ordSeen, sanSeen]);
  const [o1, o2] = ordSeen.filter((s) => !s.ground);
  const s1 = sanSeen.find((s) => !s.ground)!;
  const route = (cs: string, origin: string, destination: string): Route =>
    ({ callsign: cs, origin, destination, airline: "Test Air", flight: null, found: true, fetched_at: new Date(NOW).toISOString() });
  const routes = new Map([[o1.callsign, route(o1.callsign, "ORD", "SAN")], [o2.callsign, route(o2.callsign, "ORD", "SAN")], [s1.callsign, route(s1.callsign, "ORD", "SAN")], ["UAL1234", route("UAL1234", "EWR", "ORD")]]);
  const plan = planBoard({ pairs, coords, seen, tracked: new Map(), routes, saved: [], now: NOW });
  assert.deepEqual(new Set(plan.rows.map((r) => r.hex)), new Set([o1.hex, o2.hex, s1.hex]));
  assert.ok(plan.rows.every((r) => r.pair_key === "ORD-SAN" && r.origin === "ORD" && r.destination === "SAN"));
  assert.ok(plan.rows.every((r) => r.alt_ft === null || r.alt_ft % 1000 === 0));
  assert.ok(plan.rows.every((r) => r.progress_pct !== null && r.progress_pct % 5 === 0));
  assert.ok(plan.rows.find((r) => r.hex === s1.hex)!.progress_pct! >= 75); // within 100 nm of SAN on a 1,500 nm route
  assert.deepEqual(plan.counts.get("ORD-SAN"), { flights: 3, tracked: 0 });

  // Saved, then the same minute again: nothing to write.
  const saved: SavedTripFlight[] = plan.rows.map((r) => ({ ...r, updated_at: new Date(NOW).toISOString() }));
  const again = planBoard({ pairs, coords, seen, tracked: new Map(), routes, saved, now: NOW + 30_000 });
  const d = diffRows<TripFlightRow, "pair_key" | "hex">(saved, again.rows, TRIP_KEY, TRIP_FIELDS, { deleteMissing: false });
  assert.equal(d.upserts.length, 0);
  assert.equal(again.deletes.length, 0);

  // o1 has left both circles: found by hex mid-route → en route, counted as tracked. o2 is seen nowhere: kept
  // for 10 minutes, then dropped.
  const away = new Map([...seen].filter(([h]) => h !== o1.hex && h !== o2.hex));
  assert.deepEqual(trackHexes(saved, new Set(away.keys()), pairs).sort(), [o1.hex, o2.hex].sort());
  const mid = new Map([[o1.hex, { ...o1, lat: 37.5, lon: -103, alt: 36_000, rate: 0 }]]);
  const later = planBoard({ pairs, coords, seen: away, tracked: mid, routes, saved, now: NOW + 5 * 60_000 });
  assert.equal(later.rows.find((r) => r.hex === o1.hex)?.phase, "en_route");
  assert.ok(later.rows.some((r) => r.hex === o2.hex));
  assert.equal(later.counts.get("ORD-SAN")?.tracked, 1);
  const muchLater = planBoard({ pairs, coords, seen: away, tracked: new Map(), routes, saved, now: NOW + 11 * 60_000 });
  assert.deepEqual(muchLater.deletes.map((x) => x.hex).sort(), [o1.hex, o2.hex].sort());

  // o1 seen again, but climbing out of SAN at 22,000 ft (the same flight number's next leg): it goes at once.
  const nextLeg = new Map([...seen, [o1.hex, { ...o1, lat: 33.1, lon: -116.6, alt: 22_000, rate: 2000 }]]);
  const leg = planBoard({ pairs, coords, seen: nextLeg, tracked: new Map(), routes, saved, now: NOW + 60_000 });
  assert.ok(leg.deletes.some((x) => x.hex === o1.hex));
  assert.ok(!leg.rows.some((r) => r.hex === o1.hex));

  // A pair nobody plans any more: its rows go.
  const none = planBoard({ pairs: [], coords, seen, tracked: new Map(), routes, saved, now: NOW });
  assert.equal(none.deletes.length, saved.length);
});

// A flight that lands stays a few minutes as "landed", then goes, and a plane already parked isn't added.
test("planBoard: landed flights linger 5 minutes, and parked ones never join", () => {
  const pairs = watchPairs([{ from_airport: "ORD", to_airport: "SAN" }], coords);
  const parked = { hex: "abc123", callsign: "UAL9", type: "B738", lat: 32.734, lon: -117.19, alt: null, ground: true, rate: null, near: "SAN", dist: 0 };
  const routes = new Map<string, Route>([["UAL9", { callsign: "UAL9", origin: "ORD", destination: "SAN", airline: null, flight: "UA 9", found: true, fetched_at: new Date(NOW).toISOString() }]]);
  const seen = new Map([[parked.hex, parked]]);
  assert.equal(planBoard({ pairs, coords, seen, tracked: new Map(), routes, saved: [], now: NOW }).rows.length, 0);
  const row: SavedTripFlight = { pair_key: "ORD-SAN", hex: "abc123", callsign: "UAL9", flight: "UA 9", airline: "United", aircraft_type: "B738", origin: "ORD", destination: "SAN", phase: "landed", alt_ft: 0, progress_pct: 100, updated_at: new Date(NOW).toISOString() };
  assert.equal(planBoard({ pairs, coords, seen, tracked: new Map(), routes, saved: [row], now: NOW + 2 * 60_000 }).rows.length, 1);
  const gone = planBoard({ pairs, coords, seen, tracked: new Map(), routes, saved: [row], now: NOW + 6 * 60_000 });
  assert.equal(gone.rows.length, 0);
  assert.deepEqual(gone.deletes, [{ pair_key: "ORD-SAN", hex: "abc123" }]);
});

test("pairAirlines: short names, most flights first", () => {
  assert.deepEqual(pairAirlines([
    { callsign: "UAL1", airline: "United Airlines", found: true }, { callsign: "UAL2", airline: "United Airlines", found: true },
    { callsign: "ASA3", airline: "Alaska Airlines", found: true }, { callsign: "QQQ1", airline: "Q Air", found: true }, { callsign: "AAL9", airline: null, found: false },
  ]), ["United", "Alaska", "Q Air"]);
});

/** A fake clock: sleep advances time instantly and records each wait. */
function fakeClock(): Clock & { waits: number[] } {
  let t = 0;
  const waits: number[] = [];
  return { waits, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } };
}
const http = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });
const describe = (e: unknown) => String((e as { status?: number }).status ?? "error");

// The fallback decision: adsb.lol first; adsb.fi only when adsb.lol fails (429 or anything else); both failing is a
// failure that names both reasons. The circle is now 100 nm.
test("fetchFirst: adsb.lol answers → adsb.fi is never called", async () => {
  const calls: string[] = [];
  const got = await fetchFirst(ORD, async (u) => { calls.push(u); return { ac: [] }; }, spacersFor(fakeClock()), describe);
  assert.equal(got.ok && got.source, "lol");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.adsb\.lol\/v2\/point\/41\.9786\/-87\.9048\/100$/);
  assert.equal(hexUrl.lol(["a1b2c3", "ad9ac9"]), "https://api.adsb.lol/v2/hex/a1b2c3,ad9ac9");
});

test("fetchFirst: adsb.lol 429 → the same airport from adsb.fi", async () => {
  const calls: string[] = [];
  const got = await fetchFirst(ORD, async (u) => { calls.push(u); if (u.includes("adsb.lol")) throw http(429); return { aircraft: [] }; }, spacersFor(fakeClock()), describe);
  assert.equal(got.ok && got.source, "fi");
  assert.deepEqual(got.tried, ["lol 429"]);
  assert.match(calls[1], /opendata\.adsb\.fi\/api\/v2\/lat\/41\.9786\/lon\/-87\.9048\/dist\/100$/);
});

test("fetchFirst: any adsb.lol error falls back; both failing reports both", async () => {
  const both = await fetchFirst(ORD, async (u) => { throw http(u.includes("adsb.lol") ? 503 : 429); }, spacersFor(fakeClock()), describe);
  assert.deepEqual(both, { ok: false, tried: ["lol 503", "fi 429"] });
});

// adsb.fi asks for at most one request a second: fallbacks in the same run (even two at once) queue 1.1 s apart.
test("adsb.fi calls in one run are spaced at least 1.1 s apart, even in parallel", async () => {
  const clock = fakeClock();
  const spacers = spacersFor(clock);
  const fiTimes: number[] = [];
  const fetcher = async (u: string) => { if (u.includes("adsb.lol")) throw http(429); fiTimes.push(clock.now()); return { aircraft: [] }; };
  await Promise.all([fetchFirst(ORD, fetcher, spacers, describe), fetchFirst(SAN, fetcher, spacers, describe)]);
  await fetchFirst(ORD, fetcher, spacers, describe);
  assert.equal(fiTimes.length, 3);
  for (let i = 1; i < fiTimes.length; i++) assert.ok(fiTimes[i] - fiTimes[i - 1] >= 1100, `gap ${fiTimes[i] - fiTimes[i - 1]}`);
  assert.equal(SOURCES.find((s) => s.id === "lol")?.minGapMs, 0);
  assert.ok(new Spacer(1100, clock) instanceof Spacer);
});

// adsb.fi's saved response (the `aircraft` list) still reads through the same parser.
test("adsb.fi response: the `aircraft` list reads like adsb.lol's `ac`", () => {
  const fi = fixture("adsbfi-ord.json");
  assert.ok(aircraftList(fi).length >= 10);
  assert.ok(seenAircraft(aircraftList(fi), "ORD", ORD).length >= 1);
});
