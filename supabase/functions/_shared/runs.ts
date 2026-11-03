// One worker_runs row per run, success or failure: it's what the pages' freshness line reads.
import type { SupabaseClient } from "./db.ts";

export type RunSource = "tour" | "rankings" | "flights" | "deals";

/**
 * Records one run. finished_at is now; detail is trimmed to 300 characters (say what failed, never a key or a body).
 * Never throws: if the insert itself fails it's logged, so a bookkeeping problem can't crash the worker.
 */
export async function recordRun(
  db: SupabaseClient,
  source: RunSource,
  startedAt: Date,
  ok: boolean,
  rowsChanged: number,
  detail?: string | null,
): Promise<void> {
  try {
    const { error } = await db.from("worker_runs").insert({
      source,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      ok,
      rows_changed: Math.max(0, Math.trunc(rowsChanged) || 0),
      detail: detail ? String(detail).slice(0, 300) : null,
    });
    if (error) console.error(`recordRun(${source}) failed:`, error.code ?? "", error.message);
  } catch (e) {
    console.error(`recordRun(${source}) threw:`, (e as Error)?.message ?? e);
  }
}
