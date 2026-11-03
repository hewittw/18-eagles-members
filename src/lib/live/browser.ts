"use client";
// The browser's Supabase client, for the live pages only (Realtime and reads of the shared live tables).
// The *publishable* key (safe to ship, grants nothing by itself) plus the signed-in golfer's Clerk token, exactly as
// the server does (src/lib/server/supabase.ts): Supabase verifies the token, RLS decides what exists. There is no
// secret key in the app. Writes (follows) still go through Server Actions (src/lib/server/follow-actions.ts).
import { useClerk, useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// One client (so one Realtime WebSocket) per Clerk session, shared by every component on the page.
let cached: { sessionId: string; client: SupabaseClient } | null = null;

function clientFor(sessionId: string, getToken: () => Promise<string | null>): SupabaseClient {
  if (cached?.sessionId === sessionId) return cached.client;
  // A different golfer (or a new sign-in): close the old one's channels so nothing keeps listening as them.
  if (cached) void cached.client.removeAllChannels();
  if (!URL || !KEY) throw new Error("Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY).");
  const client = createClient(URL, KEY, {
    // Called for every request and Realtime (re)connect, so an expiring Clerk token is always refreshed.
    accessToken: getToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  cached = { sessionId, client };
  return client;
}

/**
 * The browser Supabase client for the signed-in golfer, or null while Clerk loads or when signed out.
 * Stable for the life of the Clerk session (safe in effect dependencies).
 */
export function useSupabaseBrowser(): SupabaseClient | null {
  const { session } = useSession();
  const clerk = useClerk();
  const sessionId = session?.id ?? null;
  return useMemo(() => {
    if (!sessionId) return null;
    // clerk.session is always the live session, so the token is never a stale one captured at creation.
    return clientFor(sessionId, async () => {
      const session = clerk.session;
      if (!session) return null;
      const token = await session.getToken();
      // Clerk's session tokens live 60 s and getToken() may hand back a cached one with only seconds left. Realtime
      // re-sends the token only on its 25 s heartbeat, so a token that lapses between two heartbeats gets every channel
      // closed by the server ("Token has expired", phx_close), silently: the page stops updating. Found on the Pro
      // Shop (5-minute runs never arrived); Tour had the same gap. So never hand over one with < MIN_LIFE_S left.
      if (token && secondsLeft(token) < MIN_LIFE_S) return (await session.getToken({ skipCache: true })) ?? null;
      return token ?? null;
    });
  }, [sessionId, clerk]);
}

/** Longer than Realtime's 25 s heartbeat, with room for latency and clock skew. */
const MIN_LIFE_S = 35;

/** Seconds until a JWT's `exp` (by this device's clock); 0 if it can't be read, which forces a fresh token. */
function secondsLeft(jwt: string): number {
  try {
    const part = jwt.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") ?? "";
    const exp = Number((JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))) as { exp?: unknown }).exp);
    return Number.isFinite(exp) ? exp - Date.now() / 1000 : 0;
  } catch {
    return 0;
  }
}
