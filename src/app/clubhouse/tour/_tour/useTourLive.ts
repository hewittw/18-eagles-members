"use client";
// The Tour page's live data: this week's event, its leaderboard, and the world ranking. For each, the page subscribes
// to Realtime FIRST and fetches the snapshot when the channel says SUBSCRIBED (again after every reconnect), so no
// change falls in the gap. The browser reads Supabase only (never ESPN or OWGR): the worker is the one caller.
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

export type TourEvent = {
  id: string;
  name: string;
  short_name: string | null;
  state: "pre" | "in" | "post";
  status_detail: string | null;
  round: number | null;
  starts_at: string | null;
  ends_at: string | null;
  course: string | null;
  updated_at: string;
};

export type BoardRow = {
  event_id: string;
  player_key: string;
  athlete_id: string | null;
  name: string;
  country: string | null;
  position: string | null;
  sort_order: number | null;
  to_par: string | null;
  today: string | null;
  thru: string | null;
  status: string | null;
  updated_at: string;
};

export type RankRow = {
  player_key: string;
  name: string;
  country: string | null;
  rank: number;
  prev_rank: number | null;
  points: number | string | null;
  updated_at: string;
};

/** "loading" until the first snapshot answers; "error" if it couldn't be read (the last data, if any, stays). */
export type Load = "loading" | "ready" | "error";

export type TourLive = {
  event: TourEvent | null;
  eventLoad: Load;
  board: BoardRow[];
  boardLoad: Load;
  rankings: RankRow[];
  rankLoad: Load;
  /** player_key → when a pushed change last touched that row (for the brief highlight). */
  touched: Map<string, number>;
  /** A pushed change to a row, for the page's own announcements (followed players only). */
  lastChange: { key: string; before: BoardRow | null; after: BoardRow } | null;
};

const EVENT_COLS = "id, name, short_name, state, status_detail, round, starts_at, ends_at, course, updated_at";
const BOARD_COLS = "event_id, player_key, athlete_id, name, country, position, sort_order, to_par, today, thru, status, updated_at";
const RANK_COLS = "player_key, name, country, rank, prev_rank, points, updated_at";
const tag = () => Math.random().toString(36).slice(2, 8);

export function useTourLive(db: SupabaseClient | null): TourLive {
  const [event, setEvent] = useState<TourEvent | null>(null);
  const [eventLoad, setEventLoad] = useState<Load>("loading");
  const [boardMap, setBoardMap] = useState<Map<string, BoardRow>>(() => new Map());
  const [boardLoad, setBoardLoad] = useState<Load>("loading");
  const [rankMap, setRankMap] = useState<Map<string, RankRow>>(() => new Map());
  const [rankLoad, setRankLoad] = useState<Load>("loading");
  const [touched, setTouched] = useState<Map<string, number>>(() => new Map());
  const [lastChange, setLastChange] = useState<TourLive["lastChange"]>(null);
  const boardRef = useRef(boardMap);
  useEffect(() => { boardRef.current = boardMap; }, [boardMap]);

  const touch = (keys: string[]) => {
    const now = Date.now();
    setTouched((m) => {
      const next = new Map(m);
      for (const k of keys) next.set(k, now);
      for (const [k, t] of next) if (now - t > 5000) next.delete(k);
      return next;
    });
  };

  // 1. The event. The table holds one event (the worker replaces last week's), but read the newest to be safe.
  useEffect(() => {
    if (!db) return;
    let live = true;
    const fetchEvent = async () => {
      const { data, error } = await db.from("tour_events").select(EVENT_COLS).order("starts_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle<TourEvent>();
      if (!live) return;
      if (error) { setEventLoad("error"); return; }
      setEvent(data ?? null);
      setEventLoad("ready");
    };
    const ch = db
      .channel(`tour_events:${tag()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tour_events" }, (p: RealtimePostgresChangesPayload<TourEvent>) => {
        if (p.eventType === "DELETE") {
          const gone = (p.old as Partial<TourEvent>).id;
          setEvent((e) => (e && e.id === gone ? null : e));
          void fetchEvent();
        } else {
          const row = p.new as TourEvent;
          setEvent((e) => (!e || e.id === row.id || (row.starts_at ?? "") >= (e.starts_at ?? "") ? row : e));
        }
      })
      .subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") void fetchEvent(); });
    return () => { live = false; void db.removeChannel(ch); };
  }, [db]);

  // 2. The leaderboard for that event: inserts/updates filtered to it; deletes can't be filtered by Realtime, so
  //    they're checked against the event here (the old record carries the primary key: event_id, player_key).
  const eventId = event?.id ?? null;
  useEffect(() => {
    if (!db || !eventId) return;
    let live = true;
    const fetchBoard = async () => {
      const { data, error } = await db.from("tour_leaderboard").select(BOARD_COLS).eq("event_id", eventId).order("sort_order", { ascending: true }).limit(400).returns<BoardRow[]>();
      if (!live) return;
      if (error) { setBoardLoad("error"); return; }
      setBoardMap(new Map((data ?? []).map((r) => [r.player_key, r])));
      setBoardLoad("ready");
    };
    const onRow = (p: RealtimePostgresChangesPayload<BoardRow>) => {
      if (p.eventType === "DELETE") {
        const old = p.old as Partial<BoardRow>;
        if (old.event_id && old.event_id !== eventId) return;
        if (!old.player_key) return;
        setBoardMap((m) => { const n = new Map(m); n.delete(old.player_key!); return n; });
        return;
      }
      const row = p.new as BoardRow;
      if (row.event_id !== eventId) return;
      const before = boardRef.current.get(row.player_key) ?? null;
      setBoardMap((m) => new Map(m).set(row.player_key, row));
      touch([row.player_key]);
      setLastChange({ key: row.player_key, before, after: row });
    };
    const ch = db
      .channel(`tour_leaderboard:${eventId}:${tag()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tour_leaderboard", filter: `event_id=eq.${eventId}` }, onRow)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tour_leaderboard", filter: `event_id=eq.${eventId}` }, onRow)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tour_leaderboard" }, onRow)
      .subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") void fetchBoard(); });
    return () => { live = false; void db.removeChannel(ch); };
  }, [db, eventId]);

  // 3. The world ranking (top 200).
  useEffect(() => {
    if (!db) return;
    let live = true;
    const fetchRanks = async () => {
      const { data, error } = await db.from("tour_rankings").select(RANK_COLS).order("rank", { ascending: true }).limit(200).returns<RankRow[]>();
      if (!live) return;
      if (error) { setRankLoad("error"); return; }
      setRankMap(new Map((data ?? []).map((r) => [r.player_key, r])));
      setRankLoad("ready");
    };
    const ch = db
      .channel(`tour_rankings:${tag()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tour_rankings" }, (p: RealtimePostgresChangesPayload<RankRow>) => {
        if (p.eventType === "DELETE") {
          const k = (p.old as Partial<RankRow>).player_key;
          if (k) setRankMap((m) => { const n = new Map(m); n.delete(k); return n; });
          return;
        }
        const row = p.new as RankRow;
        setRankMap((m) => new Map(m).set(row.player_key, row));
        touch([`rank:${row.player_key}`]);
      })
      .subscribe((s) => { if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") void fetchRanks(); });
    return () => { live = false; void db.removeChannel(ch); };
  }, [db]);

  // Rows of another (older) event never show, and with no event there's no board to wait for.
  const board = [...boardMap.values()].filter((r) => r.event_id === eventId).sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name));
  const rankings = [...rankMap.values()].sort((a, b) => a.rank - b.rank);
  return { event, eventLoad, board, boardLoad: eventLoad === "error" ? "error" : eventLoad === "ready" && !eventId ? "ready" : boardLoad, rankings, rankLoad, touched, lastChange };
}
