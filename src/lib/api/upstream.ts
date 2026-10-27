import "server-only";
import { auth } from "@clerk/nextjs/server";

// Shared by every route handler that calls a third-party API (OpenGolfAPI, Open-Meteo).
// The browser never calls those services itself: it calls our /api/* routes, and they call out from the server.
// That one place is where we check the Clerk session, validate input, time out, cache, and trim the response.

export const TIMEOUT_MS = 6000;

/** Why an upstream call failed. Routes turn all of these into one calm `{ error: "unavailable" }`. */
export class UpstreamError extends Error {
  constructor(public kind: "timeout" | "network" | "status" | "shape" | "not_found", public status?: number) {
    super(`upstream ${kind}${status ? ` ${status}` : ""}`);
  }
}

/** GET a JSON URL with a hard timeout. Throws UpstreamError (never returns a half-answer). */
export async function getJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json", "user-agent": "18-eagles-journal (student project)" } });
  } catch (e) {
    throw new UpstreamError(e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "network");
  }
  if (res.status === 404) throw new UpstreamError("not_found", 404);
  if (!res.ok) throw new UpstreamError("status", res.status);
  try {
    return await res.json();
  } catch {
    throw new UpstreamError("shape");
  }
}

/** A JSON response with our own Cache-Control (the data is per signed-in golfer, so browsers may cache, shared caches may not). */
export function reply(body: unknown, status = 200, maxAge = 0) {
  return Response.json(body, {
    status,
    headers: { "cache-control": status === 200 && maxAge > 0 ? `private, max-age=${maxAge}` : "no-store" },
  });
}

/** Clerk first: the API routes are for signed-in golfers only (proxy.ts passes /api through without protecting it). */
export async function signedIn(): Promise<boolean> {
  const { userId } = await auth();
  return !!userId;
}

export const signedOut = () => reply({ error: "signed_out", message: "Sign in to use course search and weather." }, 401);
export const unavailable = (what: string) => reply({ error: "unavailable", message: `${what} isn't answering right now.` }, 503);
export const badRequest = (message: string) => reply({ error: "bad_request", message }, 400);

/**
 * Development only: `?simulate=down` makes the route call the real upstream with a 1 ms timeout (so the genuine
 * timeout path runs), and `?simulate=slow` waits 2.5 s first (to see the loading state). Ignored in production.
 */
export function simulation(url: URL): "down" | "slow" | null {
  if (process.env.NODE_ENV === "production") return null;
  const s = url.searchParams.get("simulate");
  return s === "down" || s === "slow" ? s : null;
}
export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Small, strict readers for untrusted upstream JSON.
export const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
