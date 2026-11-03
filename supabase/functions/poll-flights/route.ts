// The route board's rules, pure (no Deno or npm imports) so the Node tests drive them on saved real responses.
// A trip is (from, to); a pair is the two airports sorted ("ORD-SAN"), so both directions share one board.
// Each run: which pairs to watch, which airline flights near their airports to look up (adsb.im's routeset, one
// batched call, a budget per run), which leg of a multi-stop route each one is flying, whether that leg is the pair,
// where it is on it (phase + progress), and which old rows to drop.
import { airlineFor, flightNumberFor, isAirlineCallsign } from "./airlines.ts";
import { altitudeOf, bearingDeg, haversineNm, HEX, num, onGround, verticalRate, type AdsbAircraft } from "./parse.ts";

export type Pt = { lat: number; lon: number };
export type Pair = { key: string; a: string; b: string; trips: number };

export const MAX_PAIRS = 4;
/** Closer than this (statute miles) the page says "you can drive this one", so the worker doesn't watch it. */
export const DRIVE_MI = 150;
/** Callsigns looked up per run at most, sent to adsb.im in chunks of ROUTESET_CHUNK (so normally one request). */
export const LOOKUP_BUDGET = 200;
export const ROUTESET_CHUNK = 100;
/** adsb.im asks for plain http ("to reduce server load") and a User-Agent that lets them contact us. */
export const ROUTESET_URL = "http://adsb.im/api/0/routeset";
/** callsign_routes.source for rows from adsb.im's routeset. Rows from anywhere else are not read. */
export const ROUTE_SOURCE = "adsb.im";
export const MAX_TRACKED_PER_PAIR = 12;
export const FOUND_TTL_MS = 7 * 24 * 3600_000;
export const MISSING_TTL_MS = 24 * 3600_000;
/** Not seen for this long (in a circle or by hex): the flight is dropped from the board. */
export const UNSEEN_MS = 10 * 60_000;
/** On the ground at its destination for this long: dropped. */
export const LANDED_MS = 5 * 60_000;

const CODE = /^[A-Z0-9]{3}$/;
const NM_PER_MI = 0.868976;

/** "san", "ORD" → "ORD-SAN"; the same airport twice, or anything that isn't a code, → null. */
export function pairKey(x: string | null | undefined, y: string | null | undefined): string | null {
  const a = String(x ?? "").trim().toUpperCase(), b = String(y ?? "").trim().toUpperCase();
  if (!CODE.test(a) || !CODE.test(b) || a === b) return null;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * watchPairs(trips, coords?) → the pairs to watch this run: one per distinct pair however many golfers share it
 * (A→B and B→A are the same pair), most trips first (ties alphabetical), at most 4. Pairs whose airports are known
 * and under 150 mi apart are skipped (the page shows "drive this one", never a board).
 */
export function watchPairs(
  trips: readonly { from_airport: string; to_airport: string }[],
  coords?: ReadonlyMap<string, Pt>,
  max = MAX_PAIRS,
): Pair[] {
  const count = new Map<string, number>();
  for (const t of trips) {
    const k = pairKey(t?.from_airport, t?.to_airport);
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out: Pair[] = [];
  for (const [key, n] of [...count].sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]))) {
    const [a, b] = key.split("-");
    const pa = coords?.get(a), pb = coords?.get(b);
    if (pa && pb && haversineNm(pa.lat, pa.lon, pb.lat, pb.lon) / NM_PER_MI < DRIVE_MI) continue;
    out.push({ key, a, b, trips: n });
    if (out.length >= max) break;
  }
  return out;
}

/** One airline aircraft seen in a traffic circle (or found by hex), with what the board needs. */
export type Seen = {
  hex: string;
  callsign: string;
  type: string | null;
  lat: number;
  lon: number;
  alt: number | null;
  ground: boolean;
  rate: number | null;
  /** Direction over the ground, degrees true (null if not reported). */
  track?: number | null;
  /** The airport whose circle it was seen in ("" when found by hex), and how far from it, nm. */
  near: string;
  dist: number;
};

/** The airline-looking, positioned aircraft in one airport's response. Everything else is ignored. */
export function seenAircraft(list: readonly AdsbAircraft[], airport: string, at?: Pt): Seen[] {
  const out: Seen[] = [];
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const hex = String(a.hex ?? "").trim().toLowerCase();
    const callsign = String(a.flight ?? "").trim().toUpperCase();
    const lat = num(a.lat), lon = num(a.lon);
    if (!HEX.test(hex) || lat === null || lon === null || !isAirlineCallsign(callsign)) continue;
    const dist = num(a.dst) ?? (at ? haversineNm(at.lat, at.lon, lat, lon) : 0);
    out.push({
      hex, callsign, type: String(a.t ?? "").trim().toUpperCase().slice(0, 8) || null, lat, lon,
      alt: altitudeOf(a), ground: onGround(a), rate: verticalRate(a), track: num(a.track), near: airport, dist,
    });
  }
  return out;
}

/** The same aircraft seen from two airports' circles: keep the sighting nearest its airport. */
export function mergeSeen(lists: readonly Seen[][]): Map<string, Seen> {
  const m = new Map<string, Seen>();
  for (const list of lists) for (const s of list) {
    const had = m.get(s.hex);
    if (!had || s.dist < had.dist) m.set(s.hex, s);
  }
  return m;
}

/** One stop on a route, with its position (from adsb.im's `_airports`). */
export type Stop = { code: string; lat: number; lon: number };

/** A cached route (public.callsign_routes). origin/destination: the leg it was flying when looked up. */
export type Route = {
  callsign: string;
  origin: string | null;
  destination: string | null;
  /** Every stop, in order: "SAN-ORD-SAN" is two legs flown under one flight number. */
  route?: string | null;
  stops?: Stop[] | null;
  airline: string | null;
  flight: string | null;
  found: boolean;
  source?: string;
  fetched_at: string;
};
/** A route is reused for 7 days; "unknown callsign" for 1 day. */
export function isFresh(r: Pick<Route, "found" | "fetched_at">, now: number): boolean {
  const age = now - Date.parse(r.fetched_at);
  return Number.isFinite(age) && age < (r.found ? FOUND_TTL_MS : MISSING_TTL_MS);
}

/** "UA1234" → "UA 1234" (how a boarding pass prints it). */
export function flightNumber(iata: string | null | undefined): string | null {
  const m = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(String(iata ?? "").trim().toUpperCase());
  return m ? `${m[1]} ${m[2]}` : null;
}

/** One adsb.im routeset entry, the fields we read (checked with curl 2026-11-02, fixtures/adsbim-routeset-*.json). */
type RoutesetEntry = {
  callsign?: unknown;
  _airport_codes_iata?: unknown; // "SAN-ORD", "SAN-ORD-SAN", or "unknown"
  _airports?: { iata?: unknown; lat?: unknown; lon?: unknown }[];
  plausible?: unknown; // false: the route doesn't fit where the aircraft is now (a stale or reused callsign)
};

/** The position adsb.im checks plausibility against: where we saw the aircraft. */
export type RoutesetPlane = { callsign: string; lat: number; lng: number };

/** The request body for one chunk: `{"planes":[{"callsign","lat","lng"}]}`, positions to 4 decimals. */
export function routesetBody(seen: readonly Pick<Seen, "callsign" | "lat" | "lon">[]): { planes: RoutesetPlane[] } {
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  return { planes: seen.map((s) => ({ callsign: s.callsign, lat: r4(s.lat), lng: r4(s.lon) })) };
}

/** Split a list into chunks of at most n. */
export function chunk<T>(list: readonly T[], n = ROUTESET_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += Math.max(1, n)) out.push(list.slice(i, i + Math.max(1, n)));
  return out;
}

/**
 * parseRouteset(asked, json, now) → one row to cache per aircraft asked about. adsb.im answers an array in the same
 * order as the request (an entry may be null); each entry is matched by its callsign first, by position second.
 * found = false (cached a day) when the entry is missing or null, the route is "unknown", a code isn't an IATA code,
 * a stop has no position, or adsb.im says it isn't `plausible` for where the aircraft is. A found route keeps every
 * stop, and origin/destination are the leg the aircraft is on now (pickLeg).
 */
export function parseRouteset(asked: readonly Seen[], json: unknown, now: number): Route[] {
  if (!Array.isArray(json)) throw new Error("routeset answer isn't a list");
  const list = json as (RoutesetEntry | null)[];
  const byCallsign = new Map<string, RoutesetEntry>();
  for (const e of list) if (e && typeof e === "object") byCallsign.set(String(e.callsign ?? "").trim().toUpperCase(), e);
  const fetched_at = new Date(now).toISOString();
  return asked.map((s, i) => {
    const at = list[i];
    const e = byCallsign.get(s.callsign) ?? (at && String(at.callsign ?? "").trim().toUpperCase() === "" ? at : undefined);
    const miss: Route = { callsign: s.callsign, origin: null, destination: null, route: null, stops: null, airline: null, flight: null, found: false, source: ROUTE_SOURCE, fetched_at };
    const stops = e && e.plausible !== false ? stopsOf(e) : null;
    if (!stops) return miss;
    const leg = pickLeg(stops, s);
    const first = leg ?? { from: stops[0], to: stops[1] };
    return {
      callsign: s.callsign, origin: first.from.code, destination: first.to.code, route: stops.map((x) => x.code).join("-"), stops,
      airline: airlineFor(s.callsign), flight: flightNumberFor(s.callsign), found: true, source: ROUTE_SOURCE, fetched_at,
    };
  });
}

export type Lookup = { looked: Route[]; calls: number; error: unknown };

/**
 * lookupRoutes(want, post, now, stop?) → the routes for `want`, asked in chunks of 100 (one POST per chunk, in turn,
 * never in parallel), parsed and ready to cache. The first failed chunk ends it (the rest are asked next run) and
 * its error is returned; `stop()` true before a chunk (the run's time limit) ends it too, with no error.
 */
export async function lookupRoutes(
  want: readonly Seen[],
  post: (body: { planes: RoutesetPlane[] }) => Promise<unknown>,
  now: () => number,
  stop: () => boolean = () => false,
): Promise<Lookup & { stopped: boolean }> {
  const looked: Route[] = [];
  let calls = 0;
  for (const part of chunk(want)) {
    if (stop()) return { looked, calls, error: null, stopped: true };
    calls++;
    try {
      looked.push(...parseRouteset(part, await post(routesetBody(part)), now()));
    } catch (e) {
      return { looked, calls, error: e, stopped: false };
    }
  }
  return { looked, calls, error: null, stopped: false };
}

/** The stops of one entry, or null if it isn't a usable route (unknown, a bad code, a stop without a position). */
function stopsOf(e: RoutesetEntry): Stop[] | null {
  const codes = String(e._airport_codes_iata ?? "").trim().toUpperCase().split("-");
  if (codes.length < 2 || !codes.every((c) => CODE.test(c))) return null;
  const airports = Array.isArray(e._airports) ? e._airports : [];
  const stops: Stop[] = [];
  for (const [i, code] of codes.entries()) {
    const a = String(airports[i]?.iata ?? "").toUpperCase() === code ? airports[i] : airports.find((x) => String(x?.iata ?? "").toUpperCase() === code);
    const lat = num(a?.lat), lon = num(a?.lon);
    if (lat === null || lon === null) return null;
    stops.push({ code, lat, lon });
  }
  for (let i = 1; i < stops.length; i++) if (stops[i].code === stops[i - 1].code) return null;
  return stops;
}

export type Leg = { from: Stop; to: Stop; state: FlightState };

/**
 * pickLeg(stops, aircraft, hint?) → the leg of a route (one flight number, several stops: WN 3224 MDW→SAN→SMF) the
 * aircraft is flying now, with its state on that leg; null if it fits none. Each leg is tried with flightState (which
 * already turns down the next or previous leg: landing at the origin, climbing out of the destination, heading off);
 * a leg the aircraft is far off (more than max(100 nm, 30 % of the leg) out of its way) is out; of the rest, the one
 * whose phase agrees with the climb or descent wins, then the one it's nearest the line of. On the ground at a
 * through-stop (landed on one leg, departing on the next) the hint (its leg on the board) decides, else the next leg.
 */
export function pickLeg(stops: readonly Stop[], s: Pick<Seen, "lat" | "lon" | "alt" | "ground" | "rate" | "track">, hint?: { origin: string; destination: string }): Leg | null {
  let best: { leg: Leg; score: number } | null = null;
  for (let i = 0; i + 1 < stops.length; i++) {
    const from = stops[i], to = stops[i + 1];
    const state = flightState(s, from, to);
    if (!state) continue;
    const len = haversineNm(from.lat, from.lon, to.lat, to.lon);
    const excess = haversineNm(s.lat, s.lon, from.lat, from.lon) + haversineNm(s.lat, s.lon, to.lat, to.lon) - len;
    if (excess > Math.max(100, 0.3 * len)) continue;
    const rate = s.rate ?? 0;
    let score = excess;
    if ((state.phase === "arriving" && rate > 300) || (state.phase === "departing" && !s.ground && rate < -300)) score += 10_000;
    if (s.ground) score += hint && hint.origin === from.code && hint.destination === to.code ? -1 : state.phase === "landed" ? 1 : 0;
    if (!best || score < best.score) best = { leg: { from, to, state }, score };
  }
  return best?.leg ?? null;
}

/** The legs of a cached route: its stops, else (a row with no stops) origin → destination from coords. */
export function legStops(r: Pick<Route, "origin" | "destination" | "stops">, coords: ReadonlyMap<string, Pt>): Stop[] | null {
  if (Array.isArray(r.stops) && r.stops.length >= 2) return r.stops;
  const a = r.origin ? coords.get(r.origin) : undefined, b = r.destination ? coords.get(r.destination) : undefined;
  return a && b ? [{ code: r.origin!, ...a }, { code: r.destination!, ...b }] : null;
}

/**
 * chooseLookups(seen, routes, now, budget?) → the aircraft to ask adsb.im about this run (one per callsign, the
 * sighting nearest its airport, whose position goes in the request): only callsigns with no fresh cached answer,
 * climbing or descending aircraft first (they're the ones leaving or reaching a trip airport), then the nearest.
 * At most 200 (two chunks of 100).
 */
export function chooseLookups(seen: Iterable<Seen>, routes: ReadonlyMap<string, Pick<Route, "found" | "fetched_at">>, now: number, budget = LOOKUP_BUDGET): Seen[] {
  const best = new Map<string, Seen>();
  for (const s of seen) {
    const r = routes.get(s.callsign);
    if (r && isFresh(r, now)) continue;
    const had = best.get(s.callsign);
    if (!had || s.dist < had.dist) best.set(s.callsign, s);
  }
  const moving = (s: Seen) => (!s.ground && s.rate !== null && Math.abs(s.rate) > 300 ? 0 : 1);
  return [...best.values()]
    .sort((x, y) => moving(x) - moving(y) || x.dist - y.dist || x.callsign.localeCompare(y.callsign))
    .slice(0, Math.max(0, budget));
}

/** Does this route fly the pair? "ab" (a → b), "ba", or null. */
export function matchRoute(r: Pick<Route, "found" | "origin" | "destination"> | undefined, pair: Pick<Pair, "a" | "b">): "ab" | "ba" | null {
  if (!r?.found) return null;
  if (r.origin === pair.a && r.destination === pair.b) return "ab";
  if (r.origin === pair.b && r.destination === pair.a) return "ba";
  return null;
}

export type Phase = "departing" | "en_route" | "arriving" | "landed";
export type FlightState = { phase: Phase; progress_pct: number; alt_ft: number | null };

/** Within this many nm of an airport and low (or climbing/descending), a flight is leaving or reaching it. */
const TERMINAL_NM = 80;
const TERMINAL_FT = 15_000;
const ON_FIELD_NM = 10;

/**
 * flightState(aircraft, origin, destination) → where it is on its route, coarsened:
 *   progress_pct: great-circle progress, distance flown / (flown + to go), rounded to 5 %.
 *   landed:    on the ground within 10 nm of the destination (progress 100).
 *   departing: on the ground at the origin, or airborne within 80 nm of it, in the first half, climbing or under 15,000 ft.
 *   arriving:  airborne within 80 nm of the destination, in the second half, descending or under 15,000 ft.
 *   en_route:  everything else in the air.
 *   alt_ft:    to the nearest 1,000 ft; 0 on the ground; at least 1,000 in the air.
 * On the ground anywhere else (a diversion, a stale position) → null: not on this route right now. Also null, because
 * it's the same flight number's next or previous leg (airlines reuse a number all day, WN 3224 MDW→SAN→…; pickLeg
 * tries each leg of a multi-stop route with this): descending near the origin (landing there); climbing away near the destination; or
 * at cruise, outside both terminal areas, with its track more than 100° off the bearing to the destination.
 */
export function flightState(s: Pick<Seen, "lat" | "lon" | "alt" | "ground" | "rate" | "track">, origin: Pt, destination: Pt): FlightState | null {
  const dO = haversineNm(s.lat, s.lon, origin.lat, origin.lon);
  const dD = haversineNm(s.lat, s.lon, destination.lat, destination.lon);
  const raw = dO + dD > 0 ? dO / (dO + dD) : 0;
  const progress = Math.min(100, Math.max(0, Math.round((raw * 100) / 5) * 5));
  if (s.ground) {
    if (dD <= ON_FIELD_NM) return { phase: "landed", progress_pct: 100, alt_ft: 0 };
    if (dO <= ON_FIELD_NM) return { phase: "departing", progress_pct: 0, alt_ft: 0 };
    return null;
  }
  const alt = s.alt === null ? null : Math.min(60_000, Math.max(1000, Math.round(s.alt / 1000) * 1000));
  const low = s.alt !== null && s.alt < TERMINAL_FT;
  const rate = s.rate ?? 0;
  if (raw <= 0.15 && rate < -500) return null; // landing at the origin
  if (s.alt !== null && s.alt > 8000 && raw >= 0.85 && rate > 500) return null; // climbing out of the destination
  if (s.track != null && s.alt !== null && s.alt > 8000 && dO > 40 && dD > 40) {
    const off = Math.abs(((s.track - bearingDeg(s.lat, s.lon, destination.lat, destination.lon) + 540) % 360) - 180);
    if (off > 100) return null; // heading somewhere else
  }
  let phase: Phase = "en_route";
  if (dD < TERMINAL_NM && raw >= 0.5 && (rate < -300 || low)) phase = "arriving";
  else if (dO < TERMINAL_NM && raw < 0.5 && (rate > 300 || low)) phase = "departing";
  return { phase, progress_pct: progress, alt_ft: alt };
}

/** One public.trip_flights row as the worker writes it (updated_at is added at write time). */
export type TripFlightRow = {
  pair_key: string;
  hex: string;
  callsign: string | null;
  flight: string | null;
  airline: string | null;
  aircraft_type: string | null;
  origin: string;
  destination: string;
  phase: Phase;
  alt_ft: number | null;
  progress_pct: number | null;
};
export type SavedTripFlight = TripFlightRow & { updated_at: string };

/** The key and the compared columns for diffRows. updated_at is left out, or every row would always differ. */
export const TRIP_KEY = ["pair_key", "hex"] as const;
export const TRIP_FIELDS = ["callsign", "flight", "airline", "aircraft_type", "origin", "destination", "phase", "alt_ft", "progress_pct"] as const;

/**
 * trackHexes(saved, seenHexes, pairs) → the saved flights to look up by hex this run, because they've left every
 * traffic circle (they're mid-route): en route ones first, then the most recently changed, at most 12 per pair.
 */
export function trackHexes(saved: readonly SavedTripFlight[], seenHexes: ReadonlySet<string>, pairs: readonly Pair[], max = MAX_TRACKED_PER_PAIR): string[] {
  const out = new Set<string>();
  for (const p of pairs) {
    saved
      .filter((r) => r.pair_key === p.key && !seenHexes.has(r.hex) && r.phase !== "landed")
      .sort((x, y) => Number(y.phase === "en_route") - Number(x.phase === "en_route") || Date.parse(y.updated_at) - Date.parse(x.updated_at))
      .slice(0, max)
      .forEach((r) => out.add(r.hex));
  }
  return [...out];
}

export type PlanInput = {
  pairs: readonly Pair[];
  coords: ReadonlyMap<string, Pt>;
  /** Every airline aircraft in the circles this run, by hex. */
  seen: ReadonlyMap<string, Seen>;
  /** Saved flights found by hex this run (they're outside every circle). */
  tracked: ReadonlyMap<string, Seen>;
  routes: ReadonlyMap<string, Route>;
  saved: readonly SavedTripFlight[];
  now: number;
};
export type PairCount = { flights: number; tracked: number };
export type Plan = { rows: TripFlightRow[]; deletes: Pick<TripFlightRow, "pair_key" | "hex">[]; counts: Map<string, PairCount> };

/**
 * planBoard(input) → every row the watched pairs' boards should hold now, and the saved rows to delete:
 *   - a seen aircraft whose cached route has a leg it is flying now (pickLeg) that is a→b or b→a joins its pair (unless
 *     it's already landed and wasn't on the board);
 *   - a saved flight not in any circle but found by hex is moved along its route (still matched by its saved origin/destination);
 *   - a saved flight seen nowhere stays as it was for up to 10 minutes after its last change, then goes;
 *   - a saved flight that is seen but no longer on the route (flightState null: its next leg) goes at once;
 *   - a landed flight goes 5 minutes after it landed; rows of pairs no longer watched go.
 */
export function planBoard({ pairs, coords, seen, tracked, routes, saved, now }: PlanInput): Plan {
  const rows: TripFlightRow[] = [];
  const deletes: Pick<TripFlightRow, "pair_key" | "hex">[] = [];
  const counts = new Map<string, PairCount>();
  const watched = new Set(pairs.map((p) => p.key));
  const savedBy = new Map(saved.map((r) => [`${r.pair_key}:${r.hex}`, r]));

  for (const r of saved) if (!watched.has(r.pair_key)) deletes.push({ pair_key: r.pair_key, hex: r.hex });

  for (const p of pairs) {
    const c: PairCount = { flights: 0, tracked: 0 };
    counts.set(p.key, c);
    const placed = new Set<string>();

    for (const s of seen.values()) {
      const route = routes.get(s.callsign);
      if (!route?.found) continue;
      const stops = legStops(route, coords);
      if (!stops || !stops.some((x) => x.code === p.a) || !stops.some((x) => x.code === p.b)) continue;
      const old = savedBy.get(`${p.key}:${s.hex}`);
      const leg = pickLeg(stops, s, old);
      if (!leg || !matchRoute({ found: true, origin: leg.from.code, destination: leg.to.code }, p)) continue;
      const st = leg.state;
      if (st.phase === "landed" && !old) continue;
      if (st.phase === "landed" && old?.phase === "landed" && now - Date.parse(old.updated_at) > LANDED_MS) {
        deletes.push({ pair_key: p.key, hex: s.hex });
        placed.add(s.hex);
        continue;
      }
      rows.push({
        pair_key: p.key, hex: s.hex, callsign: s.callsign, flight: route.flight,
        airline: airlineFor(s.callsign) ?? route.airline, aircraft_type: s.type,
        origin: leg.from.code, destination: leg.to.code, ...st,
      });
      placed.add(s.hex);
      c.flights++;
    }

    for (const old of saved) {
      if (old.pair_key !== p.key || placed.has(old.hex)) continue;
      const t = tracked.get(old.hex) ?? seen.get(old.hex);
      const from = coords.get(old.origin) ?? stopOf(routes.get(old.callsign ?? ""), old.origin);
      const to = coords.get(old.destination) ?? stopOf(routes.get(old.callsign ?? ""), old.destination);
      const st = t && from && to ? flightState(t, from, to) : null;
      const age = now - Date.parse(old.updated_at);
      if (st) {
        if (st.phase === "landed" && old.phase === "landed" && age > LANDED_MS) { deletes.push({ pair_key: p.key, hex: old.hex }); continue; }
        rows.push({ ...strip(old), aircraft_type: t!.type ?? old.aircraft_type, ...st });
        c.flights++;
        if (tracked.has(old.hex)) c.tracked++;
      } else if (t || age > (old.phase === "landed" ? LANDED_MS : UNSEEN_MS)) {
        // Seen, but not on this route any more (its next leg, or on the ground elsewhere), or seen nowhere for 10 minutes.
        deletes.push({ pair_key: p.key, hex: old.hex });
      } else {
        rows.push(strip(old));
        c.flights++;
      }
    }
  }
  return { rows, deletes, counts };
}

const stopOf = (r: Route | undefined, code: string): Pt | undefined => r?.stops?.find((x) => x.code === code);

const strip = (r: SavedTripFlight): TripFlightRow => {
  const row = { ...r } as Partial<SavedTripFlight>;
  delete row.updated_at;
  return row as TripFlightRow;
};

/** The airlines known (from cached routes) to fly a pair, most flights first, at most 6: for the empty board's copy. */
export function pairAirlines(routes: readonly Pick<Route, "callsign" | "airline" | "found">[]): string[] {
  const n = new Map<string, number>();
  for (const r of routes) {
    if (!r.found) continue;
    const name = airlineFor(r.callsign) ?? r.airline;
    if (name) n.set(name, (n.get(name) ?? 0) + 1);
  }
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([k]) => k);
}
