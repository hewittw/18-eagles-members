import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// The one way the server talks to Supabase: the *publishable* key (safe to ship, grants nothing by itself) plus
// the signed-in golfer's Clerk session token. Supabase verifies that token (Third-Party Auth → Clerk), reads
// `sub` as the user and `role: authenticated`, and Row Level Security does the rest. There is no secret /
// service-role key anywhere in this app, so no code path can see past RLS.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export class SignedOutError extends Error {
  constructor() { super("Sign in to see your locker."); }
}

/** Clerk first: no signed-in user, no database client. */
export async function supabaseForUser() {
  const session = await auth();
  if (!session.userId) throw new SignedOutError();
  if (!URL || !KEY) throw new Error("Supabase isn't configured (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY).");
  const db = createClient(URL, KEY, {
    accessToken: async () => (await session.getToken()) ?? null,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { userId: session.userId, db };
}
