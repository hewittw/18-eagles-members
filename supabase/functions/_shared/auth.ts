// The workers are public URLs (verify_jwt = false, since Cron has no user). The only way in is the
// x-worker-secret header, which Cron reads from the Vault. The database compares it (worker_secret_ok), so the
// secret itself never leaves Postgres and isn't in the function's env either.
import type { SupabaseClient } from "./db.ts";

export const WORKER_SECRET_HEADER = "x-worker-secret";

/** True only if the request carries the Vault's worker secret. Any error (missing header, rpc failure) is false. */
export async function checkWorkerSecret(req: Request, db: SupabaseClient): Promise<boolean> {
  const p = req.headers.get(WORKER_SECRET_HEADER);
  if (!p || p.length > 200) return false;
  const { data, error } = await db.rpc("worker_secret_ok", { p });
  if (error) {
    console.error("worker_secret_ok failed:", error.code ?? "", error.message);
    return false;
  }
  return data === true;
}
