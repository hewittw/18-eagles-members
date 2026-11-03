// The route board's rules, pure (no Deno or npm imports) so the Node tests drive them on saved real responses.
// A trip is (from, to); a pair is the two airports sorted ("ORD-SAN"), so both directions share one board.
// Each run: which pairs to watch, which airline flights near their airports to look up (adsbdb, a budget per run),
// which of those fly the pair, where each one is on the route (phase + progress), and which old rows to drop.
import { airlineFor, isAirlineCallsign } from "./airlines.ts";
import { altitudeOf, haversineNm, HEX, num, onGround, verticalRate, type AdsbAircraft } from "./parse.ts";

export type Pt = { lat: number; lon: number };
export type Pair = { key: string; a: string; b: string; trips: number };

export const MAX_PAIRS = 4;
/** Closer than this (statute miles) the page says "you can drive this one", so the worker doesn't watch it. */
export const DRIVE_MI = 150;
export const LOOKUP_BUDGET = 30;
export const LOOKUP_GAP_MS = 150;
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
      alt: altitudeOf(a), ground: onGround(a), rate: verticalRate(a), near: airport, dist,
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

/** A cached adsbdb answer (public.callsign_routes). */
export type Route = {
  callsign: string;
  origin: string | null;
  destination: string | null;
  airline: string | null;
  flight: string | null;
  found: boolean;
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

/**
 * parseAdsbdb(callsign, json, now) → the row to cache. adsbdb answers
 * `{ response: { flightroute: { origin: { iata_code }, destination: { iata_code }, airline: { name }, callsign_iata } } }`,
 * or HTTP 404 with `{ response: "unknown callsign" }` (pass that body: it caches as found = false). A route without
 * both IATA codes is "not found" too: we can't match it to a pair.
 */
export function parseAdsbdb(callsign: string, json: unknown, now: number): Route {
  type Place = { iata_code?: unknown };
  type FlightRoute = { origin?: Place; destination?: Place; airline?: { name?: unknown }; callsign_iata?: unknown };
  const fr = (json as { response?: { flightroute?: FlightRoute } | string } | null)?.response;
  const route = typeof fr === "object" && fr ? fr.flightroute : undefined;
  const code = (v: unknown) => { const c = String(v ?? "").trim().toUpperCase(); return CODE.test(c) ? c : null; };
  const origin = code(route?.origin?.iata_code), destination = code(route?.destination?.iata_code);
  const found = !!(origin && destination && origin !== destination);
  return {
    callsign,
    origin: found ? origin : null,
    destination: found ? destination : null,
    airline: found ? String(route?.airline?.name ?? "").trim().slice(0, 60) || null : null,
    flight: found ? flightNumber(String(route?.callsign_iata ?? "")) : null,
    found,
    fetched_at: new Date(now).toISOString(),
  };
}

/**
 * chooseLookups(seen, routes, now, budget?) → the callsigns to spend this run's adsbdb budget on: only ones with no
 * fresh cached answer, each once, climbing or descending aircraft first (they're the ones leaving or reaching a trip
 * airport), then the nearest to their airport. At most 30.
 */
export function chooseLookups(seen: Iterable<Seen>, routes: ReadonlyMap<string, Pick<Route, "found" | "fetched_at">>, now: number, budget = LOOKUP_BUDGET): string[] {
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
    .slice(0, Math.max(0, budget))
    .map((s) => s.callsign);
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
 * On the ground anywhere else (a diversion, a stale position) → null: not on this route right now. Also null: climbing
 * away near the destination, or descending near the origin. Airlines reuse a flight number for every leg of a day
 * (WN 3224 MDW→SAN→…), and adsbdb knows one route per callsign, so that is the next (or previous) leg, not this one.
 */
export function flightState(s: Pick<Seen, "lat" | "lon" | "alt" | "ground" | "rate">, origin: Pt, destination: Pt): FlightState | null {
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
  if (s.alt !== null && s.alt > 8000 && ((raw >= 0.85 && rate > 500) || (raw <= 0.15 && rate < -500))) return null;
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
 *   - a seen aircraft whose cached route is a→b or b→a joins its pair (unless it's already landed and wasn't on the board);
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
      const dir = matchRoute(route, p);
      if (!dir || !route) continue;
      const from = coords.get(route.origin!), to = coords.get(route.destination!);
      if (!from || !to) continue;
      const st = flightState(s, from, to);
      if (!st) continue;
      const old = savedBy.get(`${p.key}:${s.hex}`);
      if (st.phase === "landed" && !old) continue;
      if (st.phase === "landed" && old?.phase === "landed" && now - Date.parse(old.updated_at) > LANDED_MS) {
        deletes.push({ pair_key: p.key, hex: s.hex });
        placed.add(s.hex);
        continue;
      }
      rows.push({
        pair_key: p.key, hex: s.hex, callsign: s.callsign, flight: route.flight,
        airline: airlineFor(s.callsign) ?? route.airline, aircraft_type: s.type,
        origin: route.origin!, destination: route.destination!, ...st,
      });
      placed.add(s.hex);
      c.flights++;
    }

    for (const old of saved) {
      if (old.pair_key !== p.key || placed.has(old.hex)) continue;
      const t = tracked.get(old.hex) ?? seen.get(old.hex);
      const from = coords.get(old.origin), to = coords.get(old.destination);
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
