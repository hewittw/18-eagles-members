"use client";
// The live pages' freshness line: "Updated 8 seconds ago", or plainly stale, or plainly down (the last good data stays
// on screen, marked). Fed by useWorkerHealth (src/lib/live/useWorkerHealth.ts). The visible time ticks every 5 s, but
// only a change of state is announced (a polite live region), so a screen reader isn't read the clock.
import { useNow } from "@/lib/live/useNow";
import type { WorkerHealth } from "@/lib/live/useWorkerHealth";
import { cx } from "../ui/cx";

export type FreshnessProps = {
  health: WorkerHealth;
  /** What's live, for the announcement and the stale/down lines: "The leaderboard", "Flights". */
  what?: string;
  tone?: "paper" | "green";
  className?: string;
};

/** One quiet line under a live section's heading. A drawn mark and words for every state, never colour alone. */
export function Freshness({ health, what = "The live data", tone = "paper", className }: FreshnessProps) {
  const now = useNow();
  const green = tone === "green";
  const { state, lastOkAt } = health;
  const ago = lastOkAt && now ? since(lastOkAt, now) : null;

  const line =
    state === "loading" ? "Checking for the latest…"
    : state === "fresh" ? `Updated ${ago}`
    : state === "stale" ? (ago ? `Last updated ${ago}. Waiting for the next update.` : "No updates yet. Waiting for the first one.")
    : ago ? `The feed is down. Showing the last update, from ${ago}.` : "The feed is down. We'll show it as soon as it's back.";

  const announce =
    state === "loading" ? ""
    : state === "fresh" ? `${what} is live.`
    : state === "stale" ? `${what} hasn't updated recently.`
    : `${what} is down. Showing the last update.`;

  const color =
    state === "fresh" ? (green ? "text-gold" : "text-green")
    : state === "down" ? (green ? "text-paper-3" : "text-error")
    : green ? "text-paper-3" : "text-gold-ink";

  return (
    <p className={cx("flex min-w-0 items-center gap-2 text-[0.92rem] leading-snug", green ? "text-paper-3" : "text-ink-2", className)}>
      <Mark state={state} className={color} />
      <span className="min-w-0">{line}</span>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </p>
  );
}

/** fresh: a filled pin dot. stale: an open ring. down: a ring with a stroke through it. loading: a dashed ring. */
function Mark({ state, className }: { state: WorkerHealth["state"]; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cx("size-3.5 shrink-0", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {state === "fresh" && <circle cx="8" cy="8" r="4.5" fill="currentColor" />}
      {state === "stale" && <circle cx="8" cy="8" r="5" />}
      {state === "down" && (<><circle cx="8" cy="8" r="5.5" /><path d="M4.2 11.8 L11.8 4.2" /></>)}
      {state === "loading" && <circle cx="8" cy="8" r="5" strokeDasharray="2.2 2.4" />}
    </svg>
  );
}

/** "just now", "8 seconds ago", "4 minutes ago", "2 hours ago", "3 days ago". */
export function since(t: Date, now: number): string {
  const s = Math.max(0, Math.round((now - t.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
