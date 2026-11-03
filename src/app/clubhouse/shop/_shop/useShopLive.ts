"use client";
// The Pro Shop's live data: every sale item (~150 rows, one small read). The page subscribes to Realtime FIRST and
// reads the snapshot when the channel says SUBSCRIBED (again after every reconnect), so no change falls in the gap.
// While the page is paused (useLivePause: hidden or idle tab) the channel is removed; resuming subscribes, then
// refetches. The browser reads Supabase only: the brands' stores are called by the worker, never from here.
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useLivePause } from "@/lib/live/useLivePause";
import type { CategoryId } from "@/lib/live/shop";

export type Deal = {
  id: string;
  brand: string;
  title: string;
  category: CategoryId;
  /** numeric columns arrive as numbers from PostgREST and as numbers or strings from Realtime: always Number() them. */
  price: number | string;
  was_price: number | string;
  pct_off: number;
  available: boolean;
  image: string | null;
  url: string;
  first_seen_at: string;
  updated_at: string;
};

export type Load = "loading" | "ready" | "error";

/** What a pushed change did, for the highlight and the polite announcement. */
export type DealChange = { kind: "new" | "cheaper" | "pricier" | "sold-out" | "back" | "other"; before: Deal | null; after: Deal; at: number };

export type ShopLive = {
  deals: Deal[];
  load: Load;
  /** id → when a pushed change last touched that card (the brief highlight). */
  touched: Map<string, number>;
  lastChange: DealChange | null;
};

const COLS = "id, brand, title, category, price, was_price, pct_off, available, image, url, first_seen_at, updated_at";
const tag = () => Math.random().toString(36).slice(2, 8);

function describe(before: Deal | null, after: Deal): DealChange["kind"] {
  if (!before) return "new";
  if (before.available && !after.available) return "sold-out";
  if (!before.available && after.available) return "back";
  const a = Number(after.price), b = Number(before.price);
  if (a < b) return "cheaper";
  if (a > b) return "pricier";
  return "other";
}

export function useShopLive(db: SupabaseClient | null): ShopLive {
  const [map, setMap] = useState<Map<string, Deal>>(() => new Map());
  const [load, setLoad] = useState<Load>("loading");
  const [touched, setTouched] = useState<Map<string, number>>(() => new Map());
  const [lastChange, setLastChange] = useState<DealChange | null>(null);
  const { paused } = useLivePause();
  const mapRef = useRef(map);
  useEffect(() => { mapRef.current = map; }, [map]);

  useEffect(() => {
    if (!db || paused) return;
    let live = true;
    const fetchAll = async () => {
      const { data, error } = await db.from("shop_deals").select(COLS).order("pct_off", { ascending: false }).limit(1000).returns<Deal[]>();
      if (!live) return;
      if (error) { setLoad("error"); return; }
      setMap(new Map((data ?? []).map((d) => [d.id, d])));
      setLoad("ready");
    };
    const onRow = (p: RealtimePostgresChangesPayload<Deal>) => {
      if (p.eventType === "DELETE") {
        const id = (p.old as Partial<Deal>).id;
        if (id) setMap((m) => { const n = new Map(m); n.delete(id); return n; });
        return;
      }
      const row = p.new as Deal;
      const before = mapRef.current.get(row.id) ?? null;
      const now = Date.now();
      setMap((m) => new Map(m).set(row.id, row));
      setTouched((t) => {
        const n = new Map(t).set(row.id, now);
        for (const [k, v] of n) if (now - v > 5000) n.delete(k);
        return n;
      });
      setLastChange({ kind: describe(before, row), before, after: row, at: now });
    };
    const ch = db
      .channel(`shop_deals:${tag()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_deals" }, onRow)
      .subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") void fetchAll(); });
    return () => { live = false; void db.removeChannel(ch); };
  }, [db, paused]);

  return { deals: [...map.values()], load, touched, lastChange };
}
