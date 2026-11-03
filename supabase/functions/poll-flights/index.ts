// poll-flights: the route-board worker. Supabase Cron POSTs here every 30 s. Each run: check the Vault secret, read
// every golfer's trip (service_role), pick the pairs to watch (A↔B is one pair, most-shared first, max 4, none closer
// than a drive), and for each airport in them ask adsb.lol (adsb.fi on a 429 or any error) for the aircraft within
// 100 nm. Airline callsigns with no fresh cached route are looked up on adsbdb (at most 30 a run, 150 ms apart, moving
// aircraft first) and cached in callsign_routes. Flights whose route is a→b or b→a go on the pair's board in
// trip_flights; ones that have left both circles are found by hex (one adsb.lol call for all of them) and moved along.
// Only changed rows are written (diffRows on coarsened fields), and one worker_runs row records the run, ok or not.
// No trips → an ok "idle: no trips" run that calls nothing outside. Browsers never call any of these sources.
import { checkWorkerSecret } from "../_shared/auth.ts";
import { serviceClient, type SupabaseClient } from "../_shared/db.ts";
import { diffRows } from "../_shared/diff.ts";
import { FetchError, fetchJson } from "../_shared/http.ts";
import { recordRun } from "../_shared/runs.ts";
import { aircraftList } from "./parse.ts";
import {
  chooseLookups, LOOKUP_GAP_MS, mergeSeen, pairAirlines, parseAdsbdb, planBoard, seenAircraft, trackHexes, TRIP_FIELDS,
  TRIP_KEY, watchPairs, type Pt, type Route, type SavedTripFlight, type Seen, type TripFlightRow,
} from "./route.ts";
import { fetchFirst, hexUrl, spacersFor, type SourceId, type Spacer } from "./sources.ts";

const PARALLEL = 2;
/** Stop spending lookups this long into a run, so a run stays well inside the 30 s tick. */
const LOOKUP_DEADLINE_MS = 14_000;
const clock = { now: () => Date.now(), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };

/** A short reason for the run detail: "429", "HTTP 503", "timed out", "unreachable", "bad JSON". */
function reason(e: unknown): string {
  if (e instanceof FetchError) {
    if (e.kind === "http") return e.status === 429 ? "429" : `HTTP ${e.status}`;
    return e.kind === "timeout" ? "timed out" : e.kind === "json" ? "bad JSON" : "unreachable";
  }
  return ((e as Error)?.message ?? String(e)).slice(0, 40);
}

const fetchAircraft = async (url: string) => { const j = await fetchJson(url); aircraftList(j); return j; };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const startedAt = new Date();
  let db: SupabaseClient;
  try {
    db = serviceClient();
  } catch (e) {
    console.error("poll-flights: no database client:", (e as Error).message);
    return json(500, { ok: false, error: "worker misconfigured" });
  }
  // The secret first: a bad or missing one gets 401 and nothing is written (not even a run).
  if (req.method !== "POST" || !(await checkWorkerSecret(req, db))) {
    console.log("poll-flights: 401 (missing or wrong x-worker-secret)");
    return json(401, { ok: false, error: "unauthorized" });
  }

  let ok = false, rowsChanged = 0, detail = "";
  try {
    ({ ok, rowsChanged, detail } = await poll(db, startedAt.getTime()));
  } catch (e) {
    detail = (e as Error)?.message ?? String(e);
  }
  await recordRun(db, "flights", startedAt, ok, rowsChanged, detail);
  console.log(`poll-flights: ${ok ? "ok" : "FAILED"} rows_changed=${rowsChanged} ${Date.now() - startedAt.getTime()}ms · ${detail}`);
  return json(ok ? 200 : 500, { ok, rows_changed: rowsChanged, detail });
});

async function poll(db: SupabaseClient, t0: number): Promise<{ ok: boolean; rowsChanged: number; detail: string }> {
  const trips = await db.from("trips").select("from_airport, to_airport").limit(10_000);
  if (trips.error) throw new Error(`read trips: ${trips.error.message}`);
  const codesInTrips = [...new Set((trips.data ?? []).flatMap((t) => [t.from_airport as string, t.to_airport as string]))];

  const coords = new Map<string, Pt>();
  if (codesInTrips.length) {
    const places = await db.from("airports").select("code, lat, lon").in("code", codesInTrips);
    if (places.error) throw new Error(`read airports: ${places.error.message}`);
    for (const p of places.data ?? []) coords.set(p.code as string, { lat: p.lat as number, lon: p.lon as number });
  }
  const pairs = watchPairs(trips.data ?? [], coords);
  const savedRes = await db.from("trip_flights").select(["pair_key", "hex", ...TRIP_FIELDS, "updated_at"].join(", ")).limit(2000);
  if (savedRes.error) throw new Error(`read trip_flights: ${savedRes.error.message}`);
  const saved = (savedRes.data ?? []) as unknown as SavedTripFlight[];

  if (!pairs.length) {
    // Nothing to watch: clear any old boards (no outside calls).
    let cleared = 0;
    if (saved.length) {
      const del = await db.from("trip_flights").delete({ count: "exact" }).neq("pair_key", "");
      cleared = del.count ?? 0;
    }
    await db.from("trip_pairs").delete().neq("pair_key", "");
    return { ok: true, rowsChanged: cleared, detail: cleared ? `idle: no trips (cleared ${cleared})` : "idle: no trips" };
  }

  // 1. Traffic around each airport in the watched pairs, two at a time, falling back per airport.
  const airports = [...new Set(pairs.flatMap((p) => [p.a, p.b]))];
  const spacers = spacersFor(clock);
  const failed: string[] = [];
  const sightings: Seen[][] = [];
  for (let i = 0; i < airports.length; i += PARALLEL) {
    const got = await Promise.all(airports.slice(i, i + PARALLEL).map((code) => circle(code, coords.get(code), spacers)));
    for (const g of got) {
      if (g.ok) sightings.push(g.seen);
      else failed.push(`${g.code} failed: ${g.detail}`);
    }
  }
  if (failed.length === airports.length) return { ok: false, rowsChanged: 0, detail: failed.join(", ") };
  const seen = mergeSeen(sightings);

  // 2. Routes: what's cached, then spend the lookup budget on the rest.
  const now = Date.now();
  const callsigns = [...new Set([...seen.values()].map((s) => s.callsign))];
  const routes = new Map<string, Route>();
  for (let i = 0; i < callsigns.length; i += 200) {
    const r = await db.from("callsign_routes").select("callsign, origin, destination, airline, flight, found, fetched_at").in("callsign", callsigns.slice(i, i + 200));
    if (r.error) throw new Error(`read callsign_routes: ${r.error.message}`);
    for (const row of (r.data ?? []) as Route[]) routes.set(row.callsign, row);
  }
  const want = chooseLookups(seen.values(), routes, now);
  const looked: Route[] = [];
  let lookupNote = "";
  for (const cs of want) {
    if (Date.now() - t0 > LOOKUP_DEADLINE_MS) { lookupNote = "lookups stopped at the time limit"; break; }
    if (looked.length) await clock.sleep(LOOKUP_GAP_MS);
    try {
      looked.push(parseAdsbdb(cs, await fetchJson(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`), Date.now()));
    } catch (e) {
      if (e instanceof FetchError && e.status === 404) { looked.push(parseAdsbdb(cs, null, Date.now())); continue; }
      lookupNote = `adsbdb ${reason(e)}`;
      if (e instanceof FetchError && e.status === 429) break;
    }
  }
  if (looked.length) {
    const { error } = await db.from("callsign_routes").upsert(looked, { onConflict: "callsign" });
    if (error) console.error("poll-flights: caching routes failed:", error.message);
    for (const r of looked) routes.set(r.callsign, r);
  }

  // 3. Flights already on a board that have left every circle: one adsb.lol call by hex (adsb.fi for a few if not).
  const tracked = await trackByHex(trackHexes(saved, new Set(seen.keys()), pairs), spacers);

  // 4. The board: plan, diff, write only what changed.
  const plan = planBoard({ pairs, coords, seen, tracked, routes, saved, now: Date.now() });
  const { upserts } = diffRows<TripFlightRow, "pair_key" | "hex">(saved, plan.rows, TRIP_KEY, TRIP_FIELDS, { deleteMissing: false });
  let changed = 0;
  if (upserts.length) {
    const stamp = new Date().toISOString();
    const { error } = await db.from("trip_flights").upsert(upserts.map((r) => ({ ...r, updated_at: stamp })), { onConflict: "pair_key,hex" });
    if (error) throw new Error(`upsert trip_flights: ${error.message}`.slice(0, 120));
    changed += upserts.length;
  }
  for (const key of new Set(plan.deletes.map((d) => d.pair_key))) {
    const hexes = plan.deletes.filter((d) => d.pair_key === key).map((d) => d.hex);
    const { error } = await db.from("trip_flights").delete().eq("pair_key", key).in("hex", hexes);
    if (error) throw new Error(`delete trip_flights: ${error.message}`.slice(0, 120));
    changed += hexes.length;
  }

  // 5. The pair rows: first check, and the airlines known to fly each pair (for the empty board's copy).
  changed += await syncPairs(db, pairs.map((p) => p.key));

  // Lookups and tracking are counted against the first pair whose airport saw the aircraft.
  const lookupsBy = new Map<string, number>();
  for (const r of looked) {
    const s = [...seen.values()].find((x) => x.callsign === r.callsign);
    const p = pairs.find((q) => q.a === s?.near || q.b === s?.near) ?? pairs[0];
    lookupsBy.set(p.key, (lookupsBy.get(p.key) ?? 0) + 1);
  }
  const parts = pairs.map((p) => {
    const c = plan.counts.get(p.key) ?? { flights: 0, tracked: 0 };
    return `${p.key} ${c.flights} flight${c.flights === 1 ? "" : "s"} (${lookupsBy.get(p.key) ?? 0} lookups, ${c.tracked} tracked)`;
  });
  return { ok: true, rowsChanged: changed, detail: [...parts, ...failed, lookupNote].filter(Boolean).join(", ") };
}

type CircleResult = { code: string; ok: true; source: SourceId; seen: Seen[] } | { code: string; ok: false; detail: string };

async function circle(code: string, at: Pt | undefined, spacers: ReadonlyMap<SourceId, Spacer>): Promise<CircleResult> {
  if (!at) return { code, ok: false, detail: "not in airports" };
  const got = await fetchFirst(at, fetchAircraft, spacers, reason);
  if (!got.ok) return { code, ok: false, detail: got.tried.join("; ") };
  try {
    return { code, ok: true, source: got.source, seen: seenAircraft(aircraftList(got.json), code, at) };
  } catch (e) {
    return { code, ok: false, detail: `${got.source} ${reason(e)}` };
  }
}

/** Live positions for the given hexes: adsb.lol in one call; if that fails, adsb.fi for up to 4 of them. */
async function trackByHex(hexes: string[], spacers: ReadonlyMap<SourceId, Spacer>): Promise<Map<string, Seen>> {
  const out = new Map<string, Seen>();
  if (!hexes.length) return out;
  const add = (j: unknown) => {
    for (const s of seenAircraft(aircraftList(j), "")) out.set(s.hex, s);
  };
  try {
    add(await fetchJson(hexUrl.lol(hexes)));
    return out;
  } catch (e) {
    console.log("poll-flights: hex lookup on adsb.lol failed:", reason(e));
  }
  for (const h of hexes.slice(0, 4)) {
    await spacers.get("fi")?.wait();
    try { add(await fetchJson(hexUrl.fi(h))); } catch { /* keep the saved row; it ages out after 10 minutes */ }
  }
  return out;
}

/** Make trip_pairs match the watched pairs. Writes only a new pair, a changed airline list, or a pair gone. */
async function syncPairs(db: SupabaseClient, keys: string[]): Promise<number> {
  let n = 0;
  const have = await db.from("trip_pairs").select("pair_key, airlines");
  if (have.error) { console.error("poll-flights: read trip_pairs:", have.error.message); return 0; }
  const old = new Map((have.data ?? []).map((r) => [r.pair_key as string, (r.airlines as string[]) ?? []]));
  for (const key of keys) {
    const [a, b] = key.split("-");
    const r = await db.from("callsign_routes").select("callsign, airline, found")
      .eq("found", true).or(`and(origin.eq.${a},destination.eq.${b}),and(origin.eq.${b},destination.eq.${a})`).limit(200);
    const airlines = r.error ? old.get(key) ?? [] : pairAirlines((r.data ?? []) as Route[]);
    if (old.has(key) && JSON.stringify(old.get(key)) === JSON.stringify(airlines)) continue;
    const { error } = await db.from("trip_pairs").upsert({ pair_key: key, airlines, checked_at: new Date().toISOString() }, { onConflict: "pair_key" });
    if (!error) n++;
  }
  const gone = [...old.keys()].filter((k) => !keys.includes(k));
  if (gone.length) {
    const { error } = await db.from("trip_pairs").delete().in("pair_key", gone);
    if (!error) n += gone.length;
  }
  return n;
}
