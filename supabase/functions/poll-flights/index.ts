// poll-flights: the Flights worker. Supabase Cron POSTs here every 30 s. Each run: check the Vault secret, pick the
// airports golfers follow (most-followed first, max 6, always ORD), ask adsb.lol for the aircraft within 15 nm of
// each (falling back to adsb.fi for that airport on a 429 or any error: sources.ts), parse and coarsen them
// (parse.ts, pure), compare with what's saved (diffRows), write only what changed, delete the planes that left, and
// record one worker_runs row, ok or not. One answer per airport per tick, shared by every golfer who follows it;
// browsers never call either source.
import { checkWorkerSecret } from "../_shared/auth.ts";
import { serviceClient, type SupabaseClient } from "../_shared/db.ts";
import { diffRows } from "../_shared/diff.ts";
import { FetchError, fetchJson } from "../_shared/http.ts";
import { recordRun } from "../_shared/runs.ts";
import { aircraftList, FLIGHT_FIELDS, FLIGHT_KEY, parseFlights, selectAirports, type FlightRow } from "./parse.ts";
import { fetchFirst, spacersFor, type SourceId, type Spacer } from "./sources.ts";

/** Two airports at a time: quick enough for 6 in one tick, gentle enough on free, keyless APIs. */
const PARALLEL = 2;
const clock = { now: () => Date.now(), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };

type AirportResult =
  | { code: string; ok: true; source: SourceId; total: number; inserted: number; updated: number; deleted: number }
  | { code: string; ok: false; detail: string };

/** A short reason for the run detail: "429", "HTTP 503", "timed out", "unreachable", "bad JSON". */
function reason(e: unknown): string {
  if (e instanceof FetchError) {
    if (e.kind === "http") return e.status === 429 ? "429" : `HTTP ${e.status}`;
    return e.kind === "timeout" ? "timed out" : e.kind === "json" ? "bad JSON" : "unreachable";
  }
  return ((e as Error)?.message ?? String(e)).slice(0, 40);
}

/** A source "answered" only if the body has an aircraft list; otherwise fall through to the next source. */
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

  let ok = false;
  let rowsChanged = 0;
  let detail = "";
  try {
    ({ ok, rowsChanged, detail } = await poll(db));
  } catch (e) {
    detail = (e as Error)?.message ?? String(e);
  }

  await recordRun(db, "flights", startedAt, ok, rowsChanged, detail);
  console.log(`poll-flights: ${ok ? "ok" : "FAILED"} rows_changed=${rowsChanged} ${Date.now() - startedAt.getTime()}ms · ${detail}`);
  return json(ok ? 200 : 500, { ok, rows_changed: rowsChanged, detail });
});

async function poll(db: SupabaseClient): Promise<{ ok: boolean; rowsChanged: number; detail: string }> {
  // Which airports: every golfer's follows (service_role reads them all), counted per airport.
  const follows = await db.from("followed_airports").select("airport").limit(10_000);
  if (follows.error) throw new Error(`read followed_airports: ${follows.error.message}`);
  const codes = selectAirports(follows.data ?? []);

  const places = await db.from("airports").select("code, lat, lon").in("code", codes);
  if (places.error) throw new Error(`read airports: ${places.error.message}`);
  const where = new Map((places.data ?? []).map((p) => [p.code as string, { lat: p.lat as number, lon: p.lon as number }]));

  // Two at a time. Each airport falls back on its own (no retry of the same source); adsb.fi calls are queued at
  // least 1.1 s apart across the whole run. An airport only fails if both sources do, and then it keeps its rows.
  const spacers = spacersFor(clock);
  const results: AirportResult[] = [];
  for (let i = 0; i < codes.length; i += PARALLEL) {
    const batch = codes.slice(i, i + PARALLEL);
    results.push(...(await Promise.all(batch.map((code) => pollAirport(db, code, where.get(code), spacers)))));
  }

  // Airports nobody follows any more: clear their boards (one delete, and each row is a Realtime message once).
  const gone = await db.from("airport_flights").delete({ count: "exact" }).not("airport", "in", `(${codes.join(",")})`);
  if (gone.error) console.error("poll-flights: clearing unfollowed airports failed:", gone.error.message);
  const cleared = gone.error ? 0 : gone.count ?? 0;

  const okCount = results.filter((r) => r.ok).length;
  const changed = results.reduce((n, r) => n + (r.ok ? r.inserted + r.updated + r.deleted : 0), 0) + cleared;
  const parts = results.map((r) =>
    r.ok ? `${r.code} ${r.total} ${r.source} (+${r.inserted} −${r.deleted} ~${r.updated})` : `${r.code} failed: ${r.detail}`,
  );
  if (cleared) parts.push(`cleared ${cleared} unfollowed`);
  return { ok: okCount > 0, rowsChanged: changed, detail: parts.join(", ") || "no airports" };
}

async function pollAirport(
  db: SupabaseClient,
  code: string,
  at: { lat: number; lon: number } | undefined,
  spacers: ReadonlyMap<SourceId, Spacer>,
): Promise<AirportResult> {
  if (!at) return { code, ok: false, detail: "not in airports" };
  const got = await fetchFirst(at, fetchAircraft, spacers, reason);
  if (!got.ok) return { code, ok: false, detail: got.tried.join("; ") };
  let incoming: FlightRow[];
  try {
    incoming = parseFlights(got.json, code, at);
  } catch (e) {
    return { code, ok: false, detail: `${got.source} ${reason(e)}` };
  }

  // Only after a good response: compare with what's saved. A failed airport never reaches here, so it keeps its rows.
  const saved = await db.from("airport_flights").select(["airport", "hex", ...FLIGHT_FIELDS].join(", ")).eq("airport", code).limit(2000);
  if (saved.error) return { code, ok: false, detail: `read saved: ${saved.error.message}`.slice(0, 80) };
  const existing = (saved.data ?? []) as unknown as Partial<FlightRow>[];
  const { upserts, deletes } = diffRows<FlightRow, "airport" | "hex">(existing, incoming, FLIGHT_KEY, FLIGHT_FIELDS);

  const savedHex = new Set(existing.map((r) => r.hex));
  const inserted = upserts.filter((r) => !savedHex.has(r.hex)).length;
  if (upserts.length) {
    const now = new Date().toISOString();
    const { error } = await db.from("airport_flights").upsert(upserts.map((r) => ({ ...r, updated_at: now })), { onConflict: "airport,hex" });
    if (error) return { code, ok: false, detail: `upsert: ${error.message}`.slice(0, 80) };
  }
  if (deletes.length) {
    const { error } = await db.from("airport_flights").delete().eq("airport", code).in("hex", deletes.map((d) => d.hex));
    if (error) return { code, ok: false, detail: `delete: ${error.message}`.slice(0, 80) };
  }
  const total = new Set(incoming.map((r) => r.hex)).size;
  return { code, ok: true, source: got.source, total, inserted, updated: upserts.length - inserted, deleted: deletes.length };
}
