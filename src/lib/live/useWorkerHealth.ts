"use client";
// Is the worker for this source alive? Reads the latest worker_runs row, then listens for new ones (Realtime), and
// re-evaluates on the shared 5 s clock (useNow) so "fresh" turns "stale" on its own when runs stop arriving.
// One module-level store per source: every component asking about the same source shares one channel and one
// snapshot, and the snapshot is one read (the latest run; a second read for the latest *ok* run only when the latest
// failed). Before, every call made both reads, so the Tour page (tour + rankings) made 4 per load; now 2.
import { useEffect, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseBrowser } from "./browser";
import { useLivePause } from "./useLivePause";
import { tickNow, useNow } from "./useNow";

export type WorkerSource = "tour" | "rankings" | "flights" | "deals";
export type WorkerHealthState = "loading" | "fresh" | "stale" | "down" | "paused";

/** One row of public.worker_runs. */
export type WorkerRun = {
  id: number;
  source: WorkerSource;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  rows_changed: number;
  detail: string | null;
};

export type WorkerHealth = {
  /** loading: no answer yet. fresh: the last run worked, within 3 intervals. stale: no ok run within 3 intervals.
   *  down: the latest run failed. paused: not listening (hidden or idle tab, see useLivePause); the last data stays. */
  state: WorkerHealthState;
  /** When the last successful run finished (the data on screen is at least this fresh), or null if none is known. */
  lastOkAt: Date | null;
  /** The latest run, ok or not. */
  lastRun: WorkerRun | null;
  /** The latest successful run (its detail says whether the source was actually fetched, e.g. "idle: …"). */
  lastOk: WorkerRun | null;
};

const COLUMNS = "id, source, started_at, finished_at, ok, rows_changed, detail";

type Snap = { lastRun: WorkerRun | null; lastOk: WorkerRun | null; loaded: boolean };
const EMPTY: Snap = { lastRun: null, lastOk: null, loaded: false };

const newer = (a: WorkerRun | null, b: WorkerRun | null) => (!a ? b : !b ? a : b.id > a.id ? b : a);
const doneAt = (r: WorkerRun) => Date.parse(r.finished_at ?? r.started_at);

// ───────── The shared store: one entry per source ─────────
type Entry = {
  db: SupabaseClient | null;
  snap: Snap;
  /** Components showing this source (they re-render on a new snapshot). */
  listeners: Set<() => void>;
  /** Components that want it live right now (mounted, signed in, not paused). The channel exists while > 0. */
  holders: number;
  stop: (() => void) | null;
};
const entries = new Map<WorkerSource, Entry>();

function entryFor(source: WorkerSource): Entry {
  let e = entries.get(source);
  if (!e) { e = { db: null, snap: EMPTY, listeners: new Set(), holders: 0, stop: null }; entries.set(source, e); }
  return e;
}

function merge(e: Entry, lastRun: WorkerRun | null, lastOk: WorkerRun | null) {
  e.snap = { lastRun: newer(e.snap.lastRun, lastRun), lastOk: newer(e.snap.lastOk, lastOk), loaded: true };
  for (const f of e.listeners) f();
}

/** Subscribe FIRST, then read the snapshot on SUBSCRIBED (again after every reconnect), so no run falls in the gap. */
function start(e: Entry, db: SupabaseClient, source: WorkerSource): () => void {
  let live = true;
  const fetchSnapshot = async () => {
    const latest = await db.from("worker_runs").select(COLUMNS).eq("source", source).order("started_at", { ascending: false }).limit(1).maybeSingle<WorkerRun>();
    if (!live) return;
    let ok: WorkerRun | null = latest.data?.ok ? latest.data : null;
    // Only when the latest run failed is a second read needed, for the last one that worked.
    if (latest.data && !latest.data.ok) {
      const r = await db.from("worker_runs").select(COLUMNS).eq("source", source).eq("ok", true).order("started_at", { ascending: false }).limit(1).maybeSingle<WorkerRun>();
      if (!live) return;
      ok = r.data ?? null;
    }
    // A failed read leaves us knowing nothing new: count it as loaded, so the line says stale rather than spin forever.
    merge(e, latest.data ?? null, ok);
  };
  const channel = db
    .channel(`worker_runs:${source}:${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs", filter: `source=eq.${source}` }, (payload) => {
      const run = payload.new as WorkerRun;
      merge(e, run, run.ok ? run : null);
      tickNow();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") void fetchSnapshot();
    });
  return () => { live = false; void db.removeChannel(channel); };
}

function hold(source: WorkerSource, db: SupabaseClient): () => void {
  const e = entryFor(source);
  if (e.db !== db) {
    // A different golfer's client: start over (their channel was closed with the old client).
    e.stop?.(); e.stop = null; e.holders = 0; e.db = db; e.snap = EMPTY;
    for (const f of e.listeners) f();
  }
  if (e.holders++ === 0) e.stop = start(e, db, source);
  return () => {
    if (e.db !== db) return;
    if (--e.holders === 0) { e.stop?.(); e.stop = null; }
  };
}

const subscribeTo = (source: WorkerSource) => (cb: () => void) => {
  const e = entryFor(source);
  e.listeners.add(cb);
  return () => { e.listeners.delete(cb); };
};
const subscribers = new Map<WorkerSource, (cb: () => void) => () => void>();
const subscriberFor = (source: WorkerSource) => {
  let s = subscribers.get(source);
  if (!s) { s = subscribeTo(source); subscribers.set(source, s); }
  return s;
};

/**
 * useWorkerHealth(source, everySec) → { state, lastOkAt, lastRun }
 * `everySec` is the worker's schedule (tour 10, deals 300, rankings 3600). Every caller for the same source shares
 * one channel and one snapshot (see above); the channel closes when the last caller unmounts or the page is paused
 * (useLivePause), and on resume it subscribes again, then refetches.
 */
export function useWorkerHealth(source: WorkerSource, everySec: number): WorkerHealth {
  const db = useSupabaseBrowser();
  const now = useNow();
  const { paused } = useLivePause();
  const snap = useSyncExternalStore(subscriberFor(source), () => (entries.get(source)?.db === db ? entries.get(source)!.snap : EMPTY), () => EMPTY);

  useEffect(() => {
    if (!db || paused) return;
    return hold(source, db);
  }, [db, source, paused]);

  const { lastRun, lastOk } = snap;
  const lastOkAt = lastOk ? new Date(doneAt(lastOk)) : null;
  let state: WorkerHealthState;
  // now is 0 until the clock starts (server render, hydration): too early to call anything fresh or stale.
  if (paused) state = "paused";
  else if (!snap.loaded || !now) state = "loading";
  else if (lastRun && !lastRun.ok) state = "down";
  else if (lastOkAt && now - lastOkAt.getTime() <= 3 * everySec * 1000) state = "fresh";
  else state = "stale";
  return { state, lastOkAt, lastRun, lastOk };
}
