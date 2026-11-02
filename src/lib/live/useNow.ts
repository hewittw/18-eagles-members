"use client";
// One shared clock for the live pages, ticking every 5 s. Render stays pure: the time is read in the clock's
// subscribe/tick (outside render), never in a useState initialiser or the render body. The server, and the first
// client render during hydration, see 0, which callers treat as "not known yet" (Cache Components prerenders client
// components, and Next flags a Date.now() read during that render).
import { useSyncExternalStore } from "react";

const TICK_MS = 5000;
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

function emit() {
  now = Date.now();
  for (const f of subs) f();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) {
    // React re-reads the snapshot right after subscribing, so setting it here (not emitting) is enough.
    now = Date.now();
    timer = setInterval(emit, TICK_MS);
  }
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) { clearInterval(timer); timer = null; }
  };
}

/** The time in ms, refreshed every 5 s; 0 on the server and during hydration. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}

/** Move the clock to now at once (a fresh run just arrived), so "fresh" doesn't wait for the next tick. */
export function tickNow() {
  if (subs.size) emit();
}
