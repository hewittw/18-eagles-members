// poll-tour: the Tour worker. Supabase Cron POSTs here every 10 s (body {}: the ESPN leaderboard) and hourly
// (body {"part":"rankings"}: the OWGR top 200). Each run: check the Vault secret, fetch, parse (parse.ts, pure),
// compare with what's saved (diffRows), write only what changed, and record one worker_runs row, ok or not.
// Adaptive polling (docs/a5-plan.md): with no live round, ESPN is called at most once every 5 minutes.
import { checkWorkerSecret } from "../_shared/auth.ts";
import { serviceClient, type SupabaseClient } from "../_shared/db.ts";
import { diffRows } from "../_shared/diff.ts";
import { fetchJson, isRateLimited } from "../_shared/http.ts";
import { recordRun } from "../_shared/runs.ts";
import {
  EVENT_FIELDS,
  LEADERBOARD_FIELDS,
  parseLeaderboard,
  parseRankings,
  RANKING_FIELDS,
  shouldFetchLeaderboard,
  type LeaderboardRow,
  type RankingRow,
  type TourEventRow,
} from "./parse.ts";

const ESPN_URL = "https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga";
const OWGR_URL = "https://apiweb.owgr.com/api/owgr/rankings/getRankings?regionId=0&pageSize=200&pageNumber=1&countryId=0&sortString=Rank+ASC";
/** A top-200 page shorter than this is a broken response, not 120 players leaving the ranking: don't delete on it. */
const MIN_RANKINGS_FOR_DELETE = 100;

type Result = { ok: boolean; rows: number; detail: string; status?: number };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const startedAt = new Date();
  let db: SupabaseClient;
  try {
    db = serviceClient();
  } catch (e) {
    console.error("poll-tour: no database client:", (e as Error).message);
    return json(500, { ok: false, error: "worker misconfigured" });
  }

  // The secret first: a bad or missing one gets 401 and nothing is written (not even a run).
  if (req.method !== "POST" || !(await checkWorkerSecret(req, db))) {
    console.log("poll-tour: 401 (missing or wrong x-worker-secret)");
    return json(401, { ok: false, error: "unauthorized" });
  }

  let part = "leaderboard";
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === "object" && (body as { part?: unknown }).part === "rankings") part = "rankings";
  } catch { /* an empty body is the leaderboard */ }

  const source = part === "rankings" ? "rankings" : "tour";
  let result: Result;
  try {
    result = part === "rankings" ? await pollRankings(db) : await pollLeaderboard(db, startedAt);
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    result = isRateLimited(e) ? { ok: false, rows: 0, detail: "429 from source: skipped this tick" } : { ok: false, rows: 0, detail: msg };
  }

  await recordRun(db, source, startedAt, result.ok, result.rows, result.detail);
  console.log(`poll-tour ${source}: ${result.ok ? "ok" : "FAILED"} rows_changed=${result.rows} ${Date.now() - startedAt.getTime()}ms · ${result.detail}`);
  return json(result.ok ? 200 : 500, { ok: result.ok, source, rows_changed: result.rows, detail: result.detail });
});

// ───────── Leaderboard ─────────

async function pollLeaderboard(db: SupabaseClient, now: Date): Promise<Result> {
  // What's saved: the latest event, its earliest unplayed tee time, and when ESPN was last really called.
  const [evQ, lastQ] = await Promise.all([
    db.from("tour_events").select("id, " + EVENT_FIELDS.join(", ")).order("starts_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle<TourEventRow>(),
    db.from("worker_runs").select("started_at").eq("source", "tour").not("detail", "like", "idle:%")
      .order("started_at", { ascending: false }).limit(1).maybeSingle<{ started_at: string }>(),
  ]);
  if (evQ.error) throw new Error(`read tour_events: ${evQ.error.message}`);
  if (lastQ.error) throw new Error(`read worker_runs: ${lastQ.error.message}`);
  const stored = evQ.data ?? null;

  let firstTeeAt: string | null = null;
  if (stored?.state === "pre") {
    const tee = await db.from("tour_leaderboard").select("thru").eq("event_id", stored.id).eq("status", "not_started")
      .not("thru", "is", null).order("thru", { ascending: true }).limit(1).maybeSingle<{ thru: string }>();
    firstTeeAt = tee.data?.thru ?? null;
  }

  const decision = shouldFetchLeaderboard({ event: stored, firstTeeAt, lastFetchAt: lastQ.data?.started_at ?? null, now });
  if (!decision.fetch) return { ok: true, rows: 0, detail: "idle: no live round" };

  const parsed = parseLeaderboard(await fetchJson(ESPN_URL));
  if (!parsed.event) return { ok: true, rows: 0, detail: `no event this week (${decision.reason})` };
  const event = parsed.event;
  const stamp = new Date().toISOString();
  let changed = 0;

  // 1. The event row (it must exist before its leaderboard rows: the foreign key).
  const evDiff = diffRows<TourEventRow, "id">(stored && stored.id === event.id ? [stored] : [], [event], "id", EVENT_FIELDS, { deleteMissing: false });
  if (evDiff.upserts.length) {
    const { error } = await db.from("tour_events").upsert(evDiff.upserts.map((r) => ({ ...r, updated_at: stamp })), { onConflict: "id" });
    if (error) throw new Error(`upsert tour_events: ${error.message}`);
    changed += evDiff.upserts.length;
  }

  // 2. A new week's event replaces last week's (cascade removes its leaderboard), so the tables hold one event.
  const old = await db.from("tour_events").delete().neq("id", event.id).select("id");
  if (old.error) throw new Error(`delete old tour_events: ${old.error.message}`);
  changed += old.data?.length ?? 0;

  // 3. The field: upsert new/changed players, delete the ones ESPN no longer lists.
  const existing = await db.from("tour_leaderboard").select("event_id, player_key, " + LEADERBOARD_FIELDS.join(", ")).eq("event_id", event.id).returns<LeaderboardRow[]>();
  if (existing.error) throw new Error(`read tour_leaderboard: ${existing.error.message}`);
  const d = diffRows<LeaderboardRow, "event_id" | "player_key">(existing.data ?? [], parsed.rows, ["event_id", "player_key"], LEADERBOARD_FIELDS);
  if (d.upserts.length) {
    const { error } = await db.from("tour_leaderboard").upsert(d.upserts.map((r) => ({ ...r, updated_at: stamp })), { onConflict: "event_id,player_key" });
    if (error) throw new Error(`upsert tour_leaderboard: ${error.message}`);
  }
  if (d.deletes.length) {
    const { error } = await db.from("tour_leaderboard").delete().eq("event_id", event.id).in("player_key", d.deletes.map((x) => x.player_key));
    if (error) throw new Error(`delete tour_leaderboard: ${error.message}`);
  }
  changed += d.upserts.length + d.deletes.length;

  return {
    ok: true,
    rows: changed,
    detail: `${event.short_name ?? event.name} · ${event.status_detail ?? event.state} · ${parsed.rows.length} players · ${d.upserts.length} up, ${d.deletes.length} gone (${decision.reason})`,
  };
}

// ───────── World ranking ─────────

async function pollRankings(db: SupabaseClient): Promise<Result> {
  const rows = parseRankings(await fetchJson(OWGR_URL, {}, 12000));
  if (!rows.length) return { ok: false, rows: 0, detail: "OWGR sent an empty ranking" };

  const existing = await db.from("tour_rankings").select("player_key, " + RANKING_FIELDS.join(", ")).returns<RankingRow[]>();
  if (existing.error) throw new Error(`read tour_rankings: ${existing.error.message}`);
  // We always ask for the same top-200 page, so a saved player missing from a full page has dropped out of it.
  const d = diffRows<RankingRow, "player_key">(existing.data ?? [], rows, "player_key", RANKING_FIELDS, { deleteMissing: rows.length >= MIN_RANKINGS_FOR_DELETE });

  const stamp = new Date().toISOString();
  if (d.upserts.length) {
    const { error } = await db.from("tour_rankings").upsert(d.upserts.map((r) => ({ ...r, updated_at: stamp })), { onConflict: "player_key" });
    if (error) throw new Error(`upsert tour_rankings: ${error.message}`);
  }
  if (d.deletes.length) {
    const { error } = await db.from("tour_rankings").delete().in("player_key", d.deletes.map((x) => x.player_key));
    if (error) throw new Error(`delete tour_rankings: ${error.message}`);
  }
  const n = d.upserts.length + d.deletes.length;
  return { ok: true, rows: n, detail: n ? `${rows.length} ranked · ${d.upserts.length} up, ${d.deletes.length} gone` : `${rows.length} ranked · unchanged` };
}
