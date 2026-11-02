"use client";
// The live board for the golfer's airports. Subscribes to Realtime FIRST and reads the snapshot when the channel says
// SUBSCRIBED (again after every reconnect), so no change falls in the gap. Inserts and updates are filtered to the
// followed airports (`airport=in.(…)`); Realtime can't filter deletes, so those are checked here against the board.
// The channel is rebuilt whenever the followed set changes, removed while the page is paused (useLivePause), and
// rebuilt (subscribe, then refetch) on resume. The browser reads Supabase only, never adsb.lol.
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { Phase } from "@/components/golf/flights/PhaseMark";
import { useLivePause } from "@/lib/live/useLivePause";

export type FlightRow = {
  airport: string;
  hex: string;
  callsign: string | null;
  airline: string | null;
  aircraft_type: string | null;
  phase: Phase;
  alt_ft: number | null;
  dist_nm: number | null;
  updated_at: string;
};

export type FlightsLive = {
  /** airport → its aircraft. */
  byAirport: Map<string, FlightRow[]>;
  /** "loading" until the first snapshot for the current set answers; "error" if it couldn't be read (rows kept). */
  load: "loading" | "ready" | "error";
  /** `${airport}:${hex}` → when a pushed change touched that row (the brief highlight). */
  touched: Map<string, number>;
};

const COLS = "airport, hex, callsign, airline, aircraft_type, phase, alt_ft, dist_nm, updated_at";
const keyOf = (r: Pick<FlightRow, "airport" | "hex">) => `${r.airport}:${r.hex}`;

export function useFlightsLive(db: SupabaseClient | null, codes: readonly string[] | null): FlightsLive {
  const codesKey = codes ? [...codes].sort().join(",") : null;
  const [rows, setRows] = useState<Map<string, FlightRow>>(() => new Map());
  const [loadedFor, setLoadedFor] = useState<{ key: string; ok: boolean } | null>(null);
  const [touched, setTouched] = useState<Map<string, number>>(() => new Map());
  const { paused } = useLivePause();

  useEffect(() => {
    if (!db || codesKey === null || paused) return;
    const set = new Set(codesKey ? codesKey.split(",") : []);
    if (!set.size) return;

    let live = true;
    const touch = (k: string) => {
      const now = Date.now();
      setTouched((t) => {
        const n = new Map(t);
        n.set(k, now);
        for (const [x, at] of n) if (now - at > 5000) n.delete(x);
        return n;
      });
    };
    const fetchSnapshot = async () => {
      const { data, error } = await db.from("airport_flights").select(COLS).in("airport", [...set]).limit(3000).returns<FlightRow[]>();
      if (!live) return;
      if (error) { setLoadedFor({ key: codesKey, ok: false }); return; }
      setRows((m) => {
        const n = new Map([...m].filter(([, r]) => !set.has(r.airport)));
        for (const r of data ?? []) n.set(keyOf(r), r);
        return n;
      });
      setLoadedFor({ key: codesKey, ok: true });
    };
    const onRow = (p: RealtimePostgresChangesPayload<FlightRow>) => {
      if (p.eventType === "DELETE") {
        const old = p.old as Partial<FlightRow>;
        if (!old.airport || !old.hex || !set.has(old.airport)) return;
        setRows((m) => { if (!m.has(keyOf(old as FlightRow))) return m; const n = new Map(m); n.delete(keyOf(old as FlightRow)); return n; });
        return;
      }
      const r = p.new as FlightRow;
      if (!set.has(r.airport)) return;
      setRows((m) => new Map(m).set(keyOf(r), r));
      touch(keyOf(r));
    };
    const filter = `airport=in.(${[...set].join(",")})`;
    const ch = db
      .channel(`airport_flights:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "airport_flights", filter }, onRow)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "airport_flights", filter }, onRow)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "airport_flights" }, onRow)
      .subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") void fetchSnapshot(); });
    return () => { live = false; void db.removeChannel(ch); };
  }, [db, codesKey, paused]);

  // Boards no longer followed drop out at once; the rest stay on screen while a new snapshot loads.
  const byAirport = useMemo(() => {
    const keep = new Set(codesKey ? codesKey.split(",") : []);
    const m = new Map<string, FlightRow[]>();
    for (const r of rows.values()) {
      if (!keep.has(r.airport)) continue;
      const list = m.get(r.airport);
      if (list) list.push(r); else m.set(r.airport, [r]);
    }
    return m;
  }, [rows, codesKey]);

  const load: FlightsLive["load"] = codesKey === "" ? "ready" : !loadedFor || loadedFor.key !== codesKey ? "loading" : loadedFor.ok ? "ready" : "error";
  return { byAirport, load, touched };
}
