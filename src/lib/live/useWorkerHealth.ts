"use client";
// Is the worker for this source alive? Reads the latest worker_runs row, then listens for new ones (Realtime), and
// re-evaluates every 5 s so "fresh" turns "stale" on its own when runs stop arriving.
import { useEffect, useState } from "react";
import { useSupabaseBrowser } from "./browser";

export type WorkerSource = "tour" | "rankings" | "flights";
export type WorkerHealthState = "loading" | "fresh" | "stale" | "down";

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
  /** loading: no answer yet. fresh: the last run worked, within 3 intervals. stale: no ok run within 3 intervals. down: the latest run failed. */
  state: WorkerHealthState;
  /** When the last successful run finished (the data on screen is at least this fresh), or null if none is known. */
  lastOkAt: Date | null;
  /** The latest run, ok or not. */
  lastRun: WorkerRun | null;
};

const TICK_MS = 5000;
const COLUMNS = "id, source, started_at, finished_at, ok, rows_changed, detail";

// key: the source this snapshot belongs to (a new source starts over at loading).
type Snap = { key: string; lastRun: WorkerRun | null; lastOk: WorkerRun | null; loaded: boolean };

const newer = (a: WorkerRun | null, b: WorkerRun | null) => (!a ? b : !b ? a : b.id > a.id ? b : a);
const doneAt = (r: WorkerRun) => Date.parse(r.finished_at ?? r.started_at);

/**
 * useWorkerHealth(source, everySec) → { state, lastOkAt, lastRun }
 * `everySec` is the worker's schedule (tour 10, flights 30, rankings 3600). Subscribes before it fetches the first
 * snapshot, so no run falls in the gap; refetches on every (re)subscribe; unsubscribes on unmount.
 */
export function useWorkerHealth(source: WorkerSource, everySec: number): WorkerHealth {
  const db = useSupabaseBrowser();
  const [snap, setSnap] = useState<Snap>({ key: "", lastRun: null, lastOk: null, loaded: false });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!db) return;
    let live = true;
    const merge = (lastRun: WorkerRun | null, lastOk: WorkerRun | null) =>
      setSnap((s) => {
        const base = s.key === source ? s : { key: source, lastRun: null, lastOk: null, loaded: false };
        return { key: source, lastRun: newer(base.lastRun, lastRun), lastOk: newer(base.lastOk, lastOk), loaded: true };
      });

    const fetchSnapshot = async () => {
      const [latest, latestOk] = await Promise.all([
        db.from("worker_runs").select(COLUMNS).eq("source", source).order("started_at", { ascending: false }).limit(1).maybeSingle<WorkerRun>(),
        db.from("worker_runs").select(COLUMNS).eq("source", source).eq("ok", true).order("started_at", { ascending: false }).limit(1).maybeSingle<WorkerRun>(),
      ]);
      if (!live) return;
      // A failed read leaves us knowing nothing new: count it as loaded, so the line says stale rather than spin forever.
      merge(latest.data ?? null, latestOk.data ?? null);
    };

    const channel = db
      .channel(`worker_runs:${source}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs", filter: `source=eq.${source}` }, (payload) => {
        const run = payload.new as WorkerRun;
        merge(run, run.ok ? run : null);
        setNow(Date.now());
      })
      .subscribe((status) => {
        // SUBSCRIBED fires again after a reconnect: refetch, since inserts during the drop were missed.
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") void fetchSnapshot();
      });

    return () => {
      live = false;
      void db.removeChannel(channel);
    };
  }, [db, source]);

  const current = snap.key === source ? snap : null;
  const lastRun = current?.lastRun ?? null;
  const lastOk = current?.lastOk ?? null;
  const lastOkAt = lastOk ? new Date(doneAt(lastOk)) : null;
  let state: WorkerHealthState;
  if (!current?.loaded) state = "loading";
  else if (lastRun && !lastRun.ok) state = "down";
  else if (lastOkAt && now - lastOkAt.getTime() <= 3 * everySec * 1000) state = "fresh";
  else state = "stale";
  return { state, lastOkAt, lastRun };
}
