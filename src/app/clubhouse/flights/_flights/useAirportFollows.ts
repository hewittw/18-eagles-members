"use client";
// The airports this golfer follows, through the follow Server Actions (Clerk token + publishable key → RLS).
// Optimistic: the button flips at once; if the server says no (the 6-airport limit, a dropped connection) it flips
// back and a toast says why. Unfollowing offers Undo instead of a confirm.
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import { MAX_AIRPORTS } from "@/lib/live/limits";
import { followAirport, listFollows, unfollowAirport } from "@/lib/server/follow-actions";

export type FollowedAirport = { code: string; since: string };

export type AirportFollows = {
  /** Oldest first; null until the first answer. */
  list: FollowedAirport[] | null;
  error: string | null;
  busy: ReadonlySet<string>;
  isFollowing: (code: string) => boolean;
  toggle: (code: string) => void;
};

export function useAirportFollows(enabled: boolean): AirportFollows {
  const toast = useToast();
  const [list, setList] = useState<FollowedAirport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; }, [list]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    listFollows()
      .then((r) => {
        if (!live) return;
        if (r.ok) { setList(r.airports.map((a) => ({ code: a.airport, since: a.createdAt }))); setError(null); }
        else { setError(r.error); setList((l) => l ?? []); }
      })
      .catch(() => { if (live) { setError("Couldn't load your airports. Try again in a moment."); setList((l) => l ?? []); } });
    return () => { live = false; };
  }, [enabled]);

  const mark = (code: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(code); else n.delete(code); return n; });

  const follow = useCallback(async (code: string) => {
    if ((listRef.current?.length ?? 0) >= MAX_AIRPORTS) {
      toast({ message: `You're following ${MAX_AIRPORTS} airports, the most we watch. Unfollow one to add another.` });
      return;
    }
    mark(code, true);
    setList((l) => [...(l ?? []).filter((a) => a.code !== code), { code, since: new Date().toISOString() }]);
    try {
      const r = await followAirport(code);
      if (!r.ok) { setList((l) => (l ?? []).filter((a) => a.code !== code)); toast({ message: r.error }); }
    } catch {
      setList((l) => (l ?? []).filter((a) => a.code !== code));
      toast({ message: `Couldn't follow ${code}. Check your connection and try again.` });
    } finally {
      mark(code, false);
    }
  }, [toast]);

  const unfollow = useCallback(async (code: string) => {
    const before = listRef.current ?? [];
    mark(code, true);
    setList((l) => (l ?? []).filter((a) => a.code !== code));
    let ok = false;
    try {
      const r = await unfollowAirport(code);
      ok = r.ok;
      if (!r.ok) toast({ message: r.error });
    } catch {
      toast({ message: `Couldn't unfollow ${code}. Check your connection and try again.` });
    } finally {
      mark(code, false);
    }
    if (!ok) { setList(before); return; }
    toast({ message: `Stopped following ${code}.`, action: { label: "Undo", onClick: () => void follow(code) } });
  }, [toast, follow]);

  const isFollowing = useCallback((code: string) => !!list?.some((a) => a.code === code), [list]);
  const toggle = useCallback((code: string) => {
    if (busy.has(code)) return;
    if (listRef.current?.some((a) => a.code === code)) void unfollow(code);
    else void follow(code);
  }, [busy, follow, unfollow]);

  return { list, error, busy, isFollowing, toggle };
}
