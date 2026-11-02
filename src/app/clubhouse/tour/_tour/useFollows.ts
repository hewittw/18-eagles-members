"use client";
// Who this golfer follows, through the follow Server Actions (Clerk token + publishable key → RLS). Optimistic:
// the button flips at once; if the server says no (the 20-player limit, a dropped connection) it flips back and a
// toast says why. Unfollowing offers Undo instead of a confirm.
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui";
import { MAX_PLAYERS } from "@/lib/live/limits";
import { playerKey } from "@/lib/live/playerKey";
import { followPlayer, listFollows, unfollowPlayer } from "@/lib/server/follow-actions";

export type Followed = { key: string; name: string };

export type FollowsState = {
  /** null until the first answer. */
  list: Followed[] | null;
  error: string | null;
  busy: Set<string>;
  isFollowing: (key: string) => boolean;
  toggle: (name: string) => void;
};

export function useFollows(enabled: boolean): FollowsState {
  const toast = useToast();
  const [list, setList] = useState<Followed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const listRef = useRef(list);
  useEffect(() => { listRef.current = list; }, [list]);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void listFollows().then((r) => {
      if (!live) return;
      if (r.ok) { setList(r.players.map((p) => ({ key: p.playerKey, name: p.name ?? p.playerKey }))); setError(null); }
      else { setError(r.error); setList((l) => l ?? []); }
    }).catch(() => { if (live) { setError("Couldn't load who you follow. Try again in a moment."); setList((l) => l ?? []); } });
    return () => { live = false; };
  }, [enabled]);

  const setBusyKey = (key: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(key); else n.delete(key); return n; });

  const follow = useCallback(async (name: string, key: string) => {
    if ((listRef.current?.length ?? 0) >= MAX_PLAYERS) {
      toast({ message: `You're following ${MAX_PLAYERS} players, the most we keep. Unfollow one to add another.` });
      return;
    }
    setBusyKey(key, true);
    setList((l) => [...(l ?? []).filter((p) => p.key !== key), { key, name }]);
    try {
      const r = await followPlayer(name);
      if (!r.ok) {
        setList((l) => (l ?? []).filter((p) => p.key !== key));
        toast({ message: r.error });
      }
    } catch {
      setList((l) => (l ?? []).filter((p) => p.key !== key));
      toast({ message: `Couldn't follow ${name}. Check your connection and try again.` });
    } finally {
      setBusyKey(key, false);
    }
  }, [toast]);

  const unfollow = useCallback(async (name: string, key: string) => {
    const before = listRef.current ?? [];
    setBusyKey(key, true);
    setList((l) => (l ?? []).filter((p) => p.key !== key));
    let ok = false;
    try {
      const r = await unfollowPlayer(key);
      ok = r.ok;
      if (!r.ok) toast({ message: r.error });
    } catch {
      toast({ message: `Couldn't unfollow ${name}. Check your connection and try again.` });
    } finally {
      setBusyKey(key, false);
    }
    if (!ok) { setList(before); return; }
    toast({ message: `Stopped following ${name}.`, action: { label: "Undo", onClick: () => void follow(name, key) } });
  }, [toast, follow]);

  const isFollowing = useCallback((key: string) => !!list?.some((p) => p.key === key), [list]);
  const toggle = useCallback((name: string) => {
    const key = playerKey(name);
    if (!key || busy.has(key)) return;
    if (listRef.current?.some((p) => p.key === key)) void unfollow(name, key);
    else void follow(name, key);
  }, [busy, follow, unfollow]);

  return { list, error, busy, isFollowing, toggle };
}
