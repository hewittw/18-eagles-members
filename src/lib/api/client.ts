"use client";
// The browser half: every API feature calls OUR routes (/api/golf/*, /api/weather), never a third party directly.
// One small in-memory memo per page load, so the Clubhouse, a course page, and the hole screens the router keeps
// mounted share one answer instead of asking again (the server caches too; this saves the round trip).
import { useEffect, useState } from "react";
import type { ApiResult, CourseDetail, CourseHit, Forecast } from "./types";

type Outcome<T> = Exclude<ApiResult<T>, { state: "loading" }>;
type Entry = { at: number; ttl: number; promise: Promise<Outcome<unknown>>; value?: Outcome<unknown> };
const memo = new Map<string, Entry>();

/**
 * Development only: add `?api=down` (or `?api=slow`) to any page's address and every API call on it asks our route
 * to simulate an outage (or a slow answer), so each designed state can be seen for real. Production ignores it.
 */
function withSimulation(path: string): string {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return path;
  const s = new URLSearchParams(window.location.search).get("api");
  if (s !== "down" && s !== "slow") return path;
  return `${path}${path.includes("?") ? "&" : "?"}simulate=${s}`;
}

/** Fetch one of our routes. Resolves to ok / empty / down, never throws. */
export function load<T>(path: string, pick: (body: unknown) => T | null, ttlMs: number): Promise<Outcome<T>> {
  const key = withSimulation(path);
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.promise as Promise<Outcome<T>>;
  const entry: Entry = {
    at: Date.now(),
    ttl: ttlMs,
    promise: (async (): Promise<Outcome<T>> => {
      try {
        const res = await fetch(key, { headers: { accept: "application/json" } });
        if (res.status === 404) return { state: "empty" };
        if (!res.ok) return { state: "down" };
        const data = pick(await res.json());
        return data == null ? { state: "empty" } : { state: "ok", data };
      } catch {
        return { state: "down" };
      }
    })(),
  };
  entry.promise.then((v) => {
    entry.value = v;
    // A failure isn't remembered for long: the next look after 20 s tries again.
    if (v.state === "down") entry.ttl = 20_000;
  });
  memo.set(key, entry);
  return entry.promise as Promise<Outcome<T>>;
}

/** What's already known for a path, without waiting (so a remembered answer shows on the first frame). */
function known<T>(path: string): Outcome<T> | undefined {
  const hit = memo.get(withSimulation(path));
  return hit && Date.now() - hit.at < hit.ttl ? (hit.value as Outcome<T> | undefined) : undefined;
}

/** React to a route: `null` path = nothing to ask (e.g. a course with no location). */
export function useApi<T>(path: string | null, pick: (body: unknown) => T | null, ttlMs: number, refreshMs?: number): ApiResult<T> | null {
  const [got, setGot] = useState<{ path: string; result: Outcome<T> } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    load(path, pick, ttlMs).then((result) => live && setGot({ path, result }));
    const timer = refreshMs ? window.setInterval(() => setTick((t) => t + 1), refreshMs) : undefined;
    return () => { live = false; if (timer) window.clearInterval(timer); };
    // `pick` is a module-level function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ttlMs, refreshMs, tick]);
  if (!path) return null;
  if (got?.path === path) return got.result;
  return known<T>(path) ?? { state: "loading" };
}

// ───────── the three calls the app makes ─────────
const TEN_MIN = 10 * 60_000;

const pickForecast = (b: unknown) => ((b as { forecast?: Forecast })?.forecast ?? null);
const pickHits = (b: unknown) => {
  const r = (b as { results?: CourseHit[] })?.results;
  return Array.isArray(r) && r.length ? r : null;
};
const pickCourse = (b: unknown) => ((b as { course?: CourseDetail })?.course ?? null);

export const weatherPath = (geo: { lat: number; lng: number } | null | undefined) => (geo ? `/api/weather?lat=${geo.lat.toFixed(3)}&lng=${geo.lng.toFixed(3)}` : null);

/** The forecast at a spot, refreshed at most every 10 minutes while the page stays open. */
export const useForecast = (geo: { lat: number; lng: number } | null | undefined, refresh = false) => useApi(weatherPath(geo), pickForecast, TEN_MIN, refresh ? TEN_MIN : undefined);
export const loadForecast = (geo: { lat: number; lng: number }) => load(weatherPath(geo)!, pickForecast, TEN_MIN);

export const useCourseFacts = (openGolfId: string | null | undefined) => useApi(openGolfId ? `/api/golf/course/${openGolfId}` : null, pickCourse, 60 * TEN_MIN);
export const loadCourse = (id: string) => load(`/api/golf/course/${id}`, pickCourse, 60 * TEN_MIN);

export function searchPath(q: string, state: string) {
  const p = new URLSearchParams({ q: q.trim() });
  if (state.trim()) p.set("state", state.trim().toUpperCase());
  return `/api/golf/search?${p}`;
}
export const loadSearch = (q: string, state: string) => load(searchPath(q, state), pickHits, 60 * TEN_MIN);
