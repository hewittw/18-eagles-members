"use client";
// The Realtime budget guard. A live tab nobody is looking at still receives every push (a Tour tab in a live
// round: ~900 messages an hour; the retired Flights board's first build: ~5–9k, past Supabase Free's 2M in a month). So the live pages stop listening when:
//   • hidden: the tab has been in the background for over 60 s (resumes by itself when it's visible again), or
//   • idle:   the tab is visible but nobody has touched it (pointer, key, scroll, focus) for 30 minutes
//             (resumes only when the golfer presses "Resume live updates": see golf/LivePauseNotice).
// Every live subscription (useWorkerHealth, useTourLive, useShopLive) puts `paused` in its effect's
// dependencies and returns early while paused, so the cleanup removes its channel (supabase.removeChannel; with
// no channels left, realtime-js closes the socket itself ~50 s later). Resuming re-runs the effect: subscribe
// FIRST, then refetch the snapshot on SUBSCRIBED, the same order as on mount, so no change falls in the gap.
// One module-level store, shared by every hook on the page; listeners exist only while something is subscribed.
import { useSyncExternalStore } from "react";

export const HIDDEN_MS = 60_000;
export const IDLE_MS = 30 * 60_000;
const CHECK_MS = 15_000;
const ACTIVITY = ["pointerdown", "pointermove", "keydown", "scroll", "wheel", "touchstart", "focus"] as const;

export type PauseReason = "hidden" | "idle";
export type LivePause = { paused: boolean; reason: PauseReason | null; resume: () => void };

let reason: PauseReason | null = null;
let lastActive = 0;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
let idleTimer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();

function set(next: PauseReason | null) {
  if (next === reason) return;
  reason = next;
  for (const f of subs) f();
}

const onActivity = () => { lastActive = Date.now(); };

function onVisibility() {
  if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
  if (document.visibilityState === "hidden") {
    hiddenTimer = setTimeout(() => { if (reason === null) set("hidden"); }, HIDDEN_MS);
  } else {
    onActivity(); // coming back to the tab is looking at it
    if (reason === "hidden") set(null);
  }
}

function checkIdle() {
  if (reason === null && document.visibilityState === "visible" && Date.now() - lastActive > IDLE_MS) set("idle");
}

function start() {
  lastActive = Date.now();
  for (const e of ACTIVITY) window.addEventListener(e, onActivity, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  idleTimer = setInterval(checkIdle, CHECK_MS);
  if (document.visibilityState === "hidden") onVisibility(); // opened in a background tab
}

function stop() {
  for (const e of ACTIVITY) window.removeEventListener(e, onActivity, { capture: true });
  document.removeEventListener("visibilitychange", onVisibility);
  if (hiddenTimer) clearTimeout(hiddenTimer);
  if (idleTimer) clearInterval(idleTimer);
  hiddenTimer = idleTimer = null;
  reason = null; // the next page that listens starts live
}

function subscribe(cb: () => void) {
  if (!subs.size) start();
  subs.add(cb);
  return () => { subs.delete(cb); if (!subs.size) stop(); };
}

function resume() {
  lastActive = Date.now();
  set(null);
}

/** Whether the live pages should be listening right now, why not, and the way back. */
export function useLivePause(): LivePause {
  const r = useSyncExternalStore(subscribe, () => reason, () => null);
  return { paused: r !== null, reason: r, resume };
}
