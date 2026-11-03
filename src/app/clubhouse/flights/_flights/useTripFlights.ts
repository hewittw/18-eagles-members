"use client";
// The board for one pair of airports ("ORD-SAN"): its flights (trip_flights) and whether the worker has checked it
// yet, plus the airlines known to fly it (trip_pairs). Subscribes to Realtime FIRST, filtered `pair_key=eq.<key>`, and
// reads the snapshot when the channel says SUBSCRIBED (again after every reconnect), so no change falls in the gap.
// Realtime can't filter deletes, so those arrive unfiltered and are dropped here unless they're this pair's.
// Paused (useLivePause): the channel is removed; resume subscribes again, then refetches. Reads Supabase only.
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useLivePause } from "@/lib/live/useLivePause";

export type TripPhase = "departing" | "en_route" | "arriving" | "landed";
export type TripFlight = {
  pair_key: string;
  hex: string;
  callsign: string | null;
  flight: string | null;
  airline: string | null;
  aircraft_type: string | null;
  origin: string;
  destination: string;
  phase: TripPhase;
  alt_ft: number | null;
  progress_pct: number | null;
  updated_at: string;
};
type PairRow = { pair_key: string; airlines: string[]; checked_at: string };

export type TripBoard = {
  flights: TripFlight[];
  /** loading: no snapshot yet. waiting: the worker hasn't checked this pair yet. ready / error as they say. */
  load: "loading" | "waiting" | "ready" | "error";
  airlines: string[];
  /** hex → when a pushed change touched it (the brief highlight). */
  touched: Map<string, number>;
};

const COLS = "pair_key, hex, callsign, flight, airline, aircraft_type, origin, destination, phase, alt_ft, progress_pct, updated_at";

export function useTripFlights(db: SupabaseClient | null, pairKey: string | null): TripBoard {
  const [snap, setSnap] = useState<{ key: string; rows: Map<string, TripFlight>; pair: PairRow | null; ok: boolean } | null>(null);
  const [touched, setTouched] = useState<Map<string, number>>(() => new Map());
  const { paused } = useLivePause();

  useEffect(() => {
    if (!db || !pairKey || paused) return;
    let live = true;
    const key = pairKey;
    const fetchSnapshot = async () => {
      const [f, p] = await Promise.all([
        db.from("trip_flights").select(COLS).eq("pair_key", key).limit(500).returns<TripFlight[]>(),
        db.from("trip_pairs").select("pair_key, airlines, checked_at").eq("pair_key", key).maybeSingle<PairRow>(),
      ]);
      if (!live) return;
      if (f.error || p.error) { setSnap((s) => (s?.key === key ? { ...s, ok: false } : { key, rows: new Map(), pair: null, ok: false })); return; }
      setSnap({ key, rows: new Map((f.data ?? []).map((r) => [r.hex, r])), pair: p.data ?? null, ok: true });
    };
    const touch = (hex: string) => {
      const now = Date.now();
      setTouched((t) => { const n = new Map(t); n.set(hex, now); for (const [x, at] of n) if (now - at > 5000) n.delete(x); return n; });
    };
    const onFlight = (e: RealtimePostgresChangesPayload<TripFlight>) => {
      if (e.eventType === "DELETE") {
        const old = e.old as Partial<TripFlight>;
        if (old.pair_key !== key || !old.hex) return;
        setSnap((s) => { if (!s || s.key !== key || !s.rows.has(old.hex!)) return s; const rows = new Map(s.rows); rows.delete(old.hex!); return { ...s, rows }; });
        return;
      }
      const r = e.new as TripFlight;
      if (r.pair_key !== key) return;
      setSnap((s) => (s && s.key === key ? { ...s, rows: new Map(s.rows).set(r.hex, r) } : s));
      touch(r.hex);
    };
    const onPair = (e: RealtimePostgresChangesPayload<PairRow>) => {
      if (e.eventType === "DELETE") return;
      const r = e.new as PairRow;
      if (r.pair_key === key) setSnap((s) => (s && s.key === key ? { ...s, pair: r } : s));
    };
    const filter = `pair_key=eq.${key}`;
    const ch = db
      .channel(`trip:${key}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trip_flights", filter }, onFlight)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trip_flights", filter }, onFlight)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "trip_flights" }, onFlight)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trip_pairs", filter }, onPair)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trip_pairs", filter }, onPair)
      .subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") void fetchSnapshot(); });
    return () => { live = false; void db.removeChannel(ch); };
  }, [db, pairKey, paused]);

  const mine = snap && snap.key === pairKey ? snap : null;
  const flights = mine ? [...mine.rows.values()] : [];
  const load: TripBoard["load"] = !mine ? "loading" : !mine.ok && !flights.length ? "error" : !mine.pair && !flights.length ? "waiting" : "ready";
  return { flights, load, airlines: mine?.pair?.airlines ?? [], touched };
}
