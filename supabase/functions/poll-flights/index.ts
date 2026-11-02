// poll-flights: the Flights worker. Supabase Cron POSTs here every 30 s. Each run: check the Vault secret, pick the
// airports golfers follow (most-followed first, max 6, always ORD), ask adsb.lol once per airport for the aircraft
// within 15 nm, parse and coarsen them (parse.ts, pure), compare with what's saved (diffRows), write only what
// changed, delete the planes that left, and record one worker_runs row, ok or not.
// One call per airport per tick, shared by every golfer who follows it; browsers never call adsb.lol.
import { checkWorkerSecret } from "../_shared/auth.ts";
import { serviceClient, type SupabaseClient } from "../_shared/db.ts";
import { diffRows } from "../_shared/diff.ts";
import { fetchJson, isRateLimited } from "../_shared/http.ts";
import { recordRun } from "../_shared/runs.ts";
import { FLIGHT_FIELDS, FLIGHT_KEY, parseFlights, selectAirports, type FlightRow } from "./parse.ts";

const RADIUS_NM = 15;
const pointUrl = (lat: number, lon: number) => `https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${RADIUS_NM}`;
/** Two airports at a time: quick enough for 6 in one tick, gentle enough on a free, keyless API. */
const PARALLEL = 2;

type AirportResult =
  | { code: string; ok: true; total: number; inserted: number; updated: number; deleted: number }
  | { code: string; ok: false; detail: string; rateLimited?: boolean };

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

  // Two at a time; a 429 stops the rest of this tick (no retry storm), and those airports keep their rows.
  const results: AirportResult[] = [];
  let rateLimited = false;
  for (let i = 0; i < codes.length; i += PARALLEL) {
    const batch = codes.slice(i, i + PARALLEL);
    if (rateLimited) {
      for (const code of batch) results.push({ code, ok: false, detail: "skipped after 429" });
      continue;
    }
    const done = await Promise.all(batch.map((code) => pollAirport(db, code, where.get(code))));
    results.push(...done);
    if (done.some((r) => !r.ok && r.rateLimited)) rateLimited = true;
  }

  // Airports nobody follows any more: clear their boards (one delete, and each row is a Realtime message once).
  const gone = await db.from("airport_flights").delete({ count: "exact" }).not("airport", "in", `(${codes.join(",")})`);
  if (gone.error) console.error("poll-flights: clearing unfollowed airports failed:", gone.error.message);
  const cleared = gone.error ? 0 : gone.count ?? 0;

  const okCount = results.filter((r) => r.ok).length;
  const changed = results.reduce((n, r) => n + (r.ok ? r.inserted + r.updated + r.deleted : 0), 0) + cleared;
  const parts = results.map((r) =>
    r.ok ? `${r.code} ${r.total} (+${r.inserted} −${r.deleted} ~${r.updated})` : `${r.code} failed: ${r.detail}`,
  );
  if (cleared) parts.push(`cleared ${cleared} unfollowed`);
  return { ok: okCount > 0, rowsChanged: changed, detail: parts.join(", ") || "no airports" };
}

async function pollAirport(db: SupabaseClient, code: string, at: { lat: number; lon: number } | undefined): Promise<AirportResult> {
  if (!at) return { code, ok: false, detail: "not in airports" };
  let incoming: FlightRow[];
  try {
    incoming = parseFlights(await fetchJson(pointUrl(at.lat, at.lon)), code, at);
  } catch (e) {
    if (isRateLimited(e)) return { code, ok: false, detail: "429, skipped this tick", rateLimited: true };
    return { code, ok: false, detail: ((e as Error)?.message ?? String(e)).slice(0, 80) };
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
  return { code, ok: true, total, inserted, updated: upserts.length - inserted, deleted: deletes.length };
}
