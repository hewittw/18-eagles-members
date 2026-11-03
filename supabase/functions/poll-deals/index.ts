// poll-deals: the Pro Shop worker. Supabase Cron POSTs here every 5 minutes. Each run: check the Vault secret, then
// read each brand's public Shopify feed in turn (one request per brand, ?limit=250, spaced SPACING_MS apart), keep
// what's on sale (parse.ts, pure), compare with what's saved (diffRows), write only what changed, and record one
// worker_runs row (source 'deals'), ok or not. A brand that fails this run keeps its saved rows: we only delete a
// brand's rows when its feed answered and they're no longer on sale.
import { checkWorkerSecret } from "../_shared/auth.ts";
import { serviceClient, type SupabaseClient } from "../_shared/db.ts";
import { diffRows } from "../_shared/diff.ts";
import { fetchJson, FetchError } from "../_shared/http.ts";
import { recordRun } from "../_shared/runs.ts";
import { BRANDS, type Brand } from "./catalog.ts";
import { DEAL_FIELDS, parseProducts, type DealRow } from "./parse.ts";

/** Between two stores' requests: polite, and the six take ~10 s in all. */
const SPACING_MS = 1500;
const FEED_TIMEOUT_MS = 12000;

type Result = { ok: boolean; rows: number; detail: string };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const startedAt = new Date();
  let db: SupabaseClient;
  try {
    db = serviceClient();
  } catch (e) {
    console.error("poll-deals: no database client:", (e as Error).message);
    return json(500, { ok: false, error: "worker misconfigured" });
  }

  // The secret first: a bad or missing one gets 401 and nothing is written (not even a run).
  if (req.method !== "POST" || !(await checkWorkerSecret(req, db))) {
    console.log("poll-deals: 401 (missing or wrong x-worker-secret)");
    return json(401, { ok: false, error: "unauthorized" });
  }

  let result: Result;
  try {
    result = await pollDeals(db);
  } catch (e) {
    result = { ok: false, rows: 0, detail: (e as Error)?.message ?? String(e) };
  }

  await recordRun(db, "deals", startedAt, result.ok, result.rows, result.detail);
  console.log(`poll-deals: ${result.ok ? "ok" : "FAILED"} rows_changed=${result.rows} ${Date.now() - startedAt.getTime()}ms · ${result.detail}`);
  return json(result.ok ? 200 : 500, { ok: result.ok, source: "deals", rows_changed: result.rows, detail: result.detail });
});

async function fetchBrand(b: Brand): Promise<DealRow[]> {
  return parseProducts(await fetchJson(`https://${b.domain}/products.json?limit=250`, {}, FEED_TIMEOUT_MS), b);
}

const why = (e: unknown) =>
  e instanceof FetchError ? (e.status ? `HTTP ${e.status}` : e.kind) : String((e as Error)?.message ?? e).slice(0, 60);

async function pollDeals(db: SupabaseClient): Promise<Result> {
  const incoming: DealRow[] = [];
  const answered: string[] = [];
  const failed: string[] = [];
  const counts: string[] = [];
  for (const [i, b] of BRANDS.entries()) {
    if (i > 0) await sleep(SPACING_MS);
    try {
      const rows = await fetchBrand(b);
      incoming.push(...rows);
      answered.push(b.slug);
      counts.push(`${b.slug} ${rows.length}`);
    } catch (e) {
      failed.push(`${b.slug} ${why(e)}`);
    }
  }
  if (!answered.length) return { ok: false, rows: 0, detail: `every store failed: ${failed.join(", ")}` };

  // Only the brands that answered are compared, so a store that's down this run doesn't lose its sale items.
  const existing = await db.from("shop_deals").select("id, " + DEAL_FIELDS.join(", ")).in("brand", answered).returns<DealRow[]>();
  if (existing.error) throw new Error(`read shop_deals: ${existing.error.message}`);
  const d = diffRows<DealRow, "id">(existing.data ?? [], incoming, "id", DEAL_FIELDS);

  const stamp = new Date().toISOString();
  if (d.upserts.length) {
    // first_seen_at isn't sent: the database fills it on insert and an update leaves it alone ("new" on the page).
    const { error } = await db.from("shop_deals").upsert(d.upserts.map((r) => ({ ...r, updated_at: stamp })), { onConflict: "id" });
    if (error) throw new Error(`upsert shop_deals: ${error.message}`);
  }
  if (d.deletes.length) {
    const { error } = await db.from("shop_deals").delete().in("id", d.deletes.map((x) => x.id));
    if (error) throw new Error(`delete shop_deals: ${error.message}`);
  }

  const n = d.upserts.length + d.deletes.length;
  const tail = failed.length ? ` · kept last for ${failed.join(", ")}` : "";
  return { ok: true, rows: n, detail: `${incoming.length} on sale (${counts.join(", ")}) · ${d.upserts.length} up, ${d.deletes.length} gone${tail}` };
}
