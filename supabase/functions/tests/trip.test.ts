// The Flights page's suggestion rule (src/lib/live/suggest.ts) on the real airport data: the four seed migrations
// (OurAirports, as applied) plus the kind backfill (20261102150000_airports_kind.sql). The rule decides which airport a
// golfer is "near" and which they "fly into", so it's checked on the places the user named.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { boxAround, haversineMi, nearbyAlternatives, NEAR_MI, pairKey, suggestAirport, type Placed } from "../../../src/lib/live/suggest.ts";
import { COURSE_GEO } from "../../../src/data/course-geo.ts";

const dir = new URL("../../migrations/", import.meta.url);
const kindSql = readFileSync(new URL("20261102150000_airports_kind.sql", dir), "utf8");
const large = new Set([...kindSql.matchAll(/'([A-Z0-9]{3})'/g)].map((m) => m[1]));
const airports: (Placed & { name: string })[] = [];
for (const f of readdirSync(dir).filter((x) => /^20261102131\d{3}_airports.*\.sql$/.test(x)).sort()) {
  const seed = readFileSync(new URL(f, dir), "utf8").split("$seed$")[1] ?? "";
  for (const line of seed.split("\n")) {
    const p = line.split("|");
    if (p.length !== 7) continue;
    airports.push({ code: p[0], name: p[2], country: p[4], lat: Number(p[5]), lon: Number(p[6]), kind: large.has(p[0]) ? "large" : "medium" });
  }
}
const at = (lat: number, lon: number) => suggestAirport(lat, lon, airports);

test("the seed and the kinds load (1,955 airports, 1,172 large)", () => {
  assert.equal(airports.length, 1955);
  assert.equal(airports.filter((a) => a.kind === "large").length, 1172);
});

// The user's complaint: Fairbanks Ranch suggested McClellan-Palomar (CLD, medium, ~16 mi). SAN is large and ~19 mi.
test("Fairbanks Ranch and Rancho Santa Fe fly into SAN, not CLD", () => {
  for (const slug of ["fairbanks-ranch", "rancho-santa-fe", "torrey-pines-south"]) {
    const g = COURSE_GEO[slug];
    const s = at(g.lat, g.lng);
    assert.equal(s?.airport.code, "SAN", slug);
    assert.ok(s!.miles < 30, `${slug} ${s!.miles}`);
  }
});

// Downtown Chicago: Midway is large and nearer (≈9 mi) than O'Hare (≈15 mi), so the rule says MDW. Near O'Hare it's ORD.
test("Chicago: MDW from the Loop (large and nearer), ORD from the northwest side", () => {
  const loop = at(41.8781, -87.6298)!;
  assert.equal(loop.airport.code, "MDW");
  assert.ok(haversineMi(41.8781, -87.6298, 41.9786, -87.9048) > loop.miles);
  assert.equal(at(42.0, -87.85)?.airport.code, "ORD");
});

// Step 2 (no large airport within 75 mi): the nearest airport of any kind. Augusta National → Augusta Regional (AGS);
// Atlanta is ~140 mi. And the rule's trade-off, pinned: Pebble Beach gets San José (large, ~55 mi) over Monterey
// (medium, ~5 mi), because a large airport within 75 mi always wins.
test("Augusta falls back to the nearest airport of any kind (AGS); Pebble Beach prefers SJC over MRY", () => {
  const g = COURSE_GEO["augusta-national"];
  const s = at(g.lat, g.lng)!;
  assert.equal(s.airport.code, "AGS");
  assert.equal(s.airport.kind, "medium");
  const p = COURSE_GEO["pebble-beach"];
  assert.equal(at(p.lat, p.lng)?.airport.code, "SJC");
});

// Step 3 and 4: far from everything, the nearest large within 250 mi, else nothing.
test("remote places: a large airport within 250 mi, else none", () => {
  const only = [{ code: "BIG", kind: "large" as const, lat: 40, lon: -100 }, { code: "SML", kind: "medium" as const, lat: 41.5, lon: -100 }];
  assert.equal(suggestAirport(42.5, -100, only)?.airport.code, "SML"); // no large within 75, SML 69 mi → step 2
  assert.equal(suggestAirport(43.3, -100, only)?.airport.code, "BIG"); // SML 124 mi, BIG 228 mi → step 3
  assert.equal(suggestAirport(45, -100, only), null); // BIG 345 mi
  assert.equal(at(0, -140), null); // the middle of the Pacific
});

// The alternatives the page offers beside the pick ("You're near MDW · or ORD 15 mi", "Fly into SJC · or MRY 5 mi").
const alts = (lat: number, lon: number) => nearbyAlternatives(lat, lon, airports, at(lat, lon)?.airport.code ?? null);
test("alternatives: Chicago Loop picks MDW and offers ORD first; Pebble Beach picks SJC and offers MRY", () => {
  const loop = alts(41.8781, -87.6298);
  assert.equal(at(41.8781, -87.6298)?.airport.code, "MDW");
  assert.equal(loop[0]?.airport.code, "ORD");
  assert.ok(loop[0].miles > 13 && loop[0].miles < 17, `ORD ${loop[0].miles}`);
  const p = COURSE_GEO["pebble-beach"];
  const peb = alts(p.lat, p.lng);
  assert.equal(at(p.lat, p.lng)?.airport.code, "SJC");
  const mry = peb.find((a) => a.airport.code === "MRY");
  assert.ok(mry, peb.map((a) => a.airport.code).join(","));
  assert.ok(mry.miles < 8, `MRY ${mry.miles}`);
});

test("alternatives: never the pick, at most 2 by default, all within 75 mi, large before medium then nearest", () => {
  for (const [lat, lon] of [[41.8781, -87.6298], [33.0, -117.2], [40.64, -73.78], [36.57, -121.95], [33.5, -82.02]]) {
    const pick = at(lat, lon)?.airport.code ?? null;
    const list = nearbyAlternatives(lat, lon, airports, pick);
    assert.ok(list.length <= 2);
    assert.ok(list.every((a) => a.airport.code !== pick && a.miles <= NEAR_MI));
    for (let i = 1; i < list.length; i++) {
      const [x, y] = [list[i - 1], list[i]];
      assert.ok((x.airport.kind === "large" && y.airport.kind === "medium") || (x.airport.kind === y.airport.kind && x.miles <= y.miles), `${x.airport.code} ${y.airport.code}`);
    }
  }
  const only = [{ code: "BIG", kind: "large" as const, lat: 40, lon: -100 }, { code: "SML", kind: "medium" as const, lat: 40.1, lon: -100 }, { code: "FAR", kind: "large" as const, lat: 42, lon: -100 }];
  assert.deepEqual(nearbyAlternatives(40.05, -100, only, "SML").map((a) => a.airport.code), ["BIG"]); // FAR is 136 mi
  assert.deepEqual(nearbyAlternatives(40.05, -100, only, null, 5).map((a) => a.airport.code), ["BIG", "SML"]); // large first, though SML is as near
  assert.deepEqual(nearbyAlternatives(0, -140, airports, null), []);
});

test("boxAround holds the 250 mi radius; pairKey sorts", () => {
  const b = boxAround(41.88, -87.63);
  for (const a of airports) {
    if (haversineMi(41.88, -87.63, a.lat, a.lon) <= 250) {
      assert.ok(a.lat >= b.lat[0] && a.lat <= b.lat[1] && a.lon >= b.lon[0] && a.lon <= b.lon[1], a.code);
    }
  }
  assert.equal(pairKey("SAN", "ord"), "ORD-SAN");
  assert.equal(pairKey("SAN", "SAN"), null);
});

// Alternatives stay in the pick's country first: from Rancho Santa Fe (pick SAN) the first alternative isn't Tijuana.
test("alternatives prefer the pick's country", () => {
  const list = alts(33.0203, -117.2025).map((a) => a.airport.code);
  assert.ok(list.length > 0);
  assert.notEqual(list[0], "TIJ");
});
