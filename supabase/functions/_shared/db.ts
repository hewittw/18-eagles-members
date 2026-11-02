// The workers' database client. It uses the Supabase *secret* key, which Supabase itself puts in the Edge Function's
// environment on its servers. It never appears in code, the repo, or the Next.js app. It bypasses RLS, so only the
// workers (after checkWorkerSecret) use it, and only to write the shared live tables and worker_runs.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** The secret key: the `default` entry of SUPABASE_SECRET_KEYS (new API keys) if present, else SUPABASE_SERVICE_ROLE_KEY. */
export function secretKey(): string {
  const many = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (many) {
    try {
      const parsed = JSON.parse(many) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (typeof key === "string" && key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("No Supabase secret key in the function's environment");
}

/** A Supabase client with the secret key (no session, no refresh). Throws if SUPABASE_URL or the key is missing. */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is missing from the function's environment");
  return createClient(url, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type { SupabaseClient };
