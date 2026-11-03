"use client";
// Which Pro Shop categories this golfer watches. Read with the page's browser client (publishable key + the golfer's
// Clerk token → RLS on watched_categories: only their own rows exist), the same way the Tour page reads follows.
// Watch and unwatch are Server Actions (follow-actions.ts), the same door as every write. Optimistic: the chip flips
// at once; if the server says no (the 4-category limit, a dropped connection) it flips back and a toast says why.
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/ui";
import { MAX_CATEGORIES } from "@/lib/live/limits";
import { categoryLabel, CATEGORY_IDS, type CategoryId } from "@/lib/live/shop";
import { unwatchCategory, watchCategory } from "@/lib/server/follow-actions";

export type WatchedState = {
  /** null until the first answer; in the order they were watched. */
  list: CategoryId[] | null;
  error: string | null;
  busy: Set<CategoryId>;
  isWatching: (c: CategoryId) => boolean;
  toggle: (c: CategoryId) => void;
};

export function useWatched(db: SupabaseClient | null): WatchedState {
  const toast = useToast();
  const [list, setList] = useState<CategoryId[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<CategoryId>>(() => new Set());
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; }, [list]);

  useEffect(() => {
    if (!db) return;
    let live = true;
    const fail = () => { if (live) { setError("Couldn't load your watch list. Try again in a moment."); setList((l) => l ?? []); } };
    void db.from("watched_categories").select("category").order("created_at", { ascending: true }).limit(20)
      .returns<{ category: string }[]>()
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { fail(); return; }
        setList((data ?? []).map((r) => r.category).filter((c): c is CategoryId => CATEGORY_IDS.has(c)));
        setError(null);
      }, fail);
    return () => { live = false; };
  }, [db]);

  const setBusyFor = (c: CategoryId, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(c); else n.delete(c); return n; });

  const watch = useCallback(async (c: CategoryId) => {
    if ((listRef.current?.length ?? 0) >= MAX_CATEGORIES) {
      toast({ message: `You're watching ${MAX_CATEGORIES} categories, the most we keep. Stop watching one to add another.` });
      return;
    }
    setBusyFor(c, true);
    setList((l) => [...(l ?? []).filter((x) => x !== c), c]);
    try {
      const r = await watchCategory(c);
      if (!r.ok) { setList((l) => (l ?? []).filter((x) => x !== c)); toast({ message: r.error }); }
    } catch {
      setList((l) => (l ?? []).filter((x) => x !== c));
      toast({ message: `Couldn't watch ${categoryLabel(c)}. Check your connection and try again.` });
    } finally {
      setBusyFor(c, false);
    }
  }, [toast]);

  const unwatch = useCallback(async (c: CategoryId) => {
    const before = listRef.current ?? [];
    setBusyFor(c, true);
    setList((l) => (l ?? []).filter((x) => x !== c));
    let ok = false;
    try {
      const r = await unwatchCategory(c);
      ok = r.ok;
      if (!r.ok) toast({ message: r.error });
    } catch {
      toast({ message: `Couldn't stop watching ${categoryLabel(c)}. Check your connection and try again.` });
    } finally {
      setBusyFor(c, false);
    }
    if (!ok) { setList(before); return; }
    toast({ message: `Stopped watching ${categoryLabel(c)}.`, action: { label: "Undo", onClick: () => void watch(c) } });
  }, [toast, watch]);

  const isWatching = useCallback((c: CategoryId) => !!list?.includes(c), [list]);
  const toggle = useCallback((c: CategoryId) => {
    if (busy.has(c)) return;
    if (listRef.current?.includes(c)) void unwatch(c);
    else void watch(c);
  }, [busy, watch, unwatch]);

  return { list, error, busy, isWatching, toggle };
}
