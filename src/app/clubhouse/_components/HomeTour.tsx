"use client";
// The live desk's top half (LiveDesk.tsx): this week's PGA TOUR event, its status, and the top three, with a link to
// the full Tour page. One snapshot read of the newest event with its first three leaderboard rows embedded (the same
// query as useTourLive's fetchAll, trimmed); no Realtime here, the Tour page is the live view. LiveDesk provides the
// card, padding, and a flex column, so this renders only the contents and pins the link to the bottom.
import Link from "next/link";
import { useEffect, useState } from "react";
import { shortDate, showToPar, toParTone } from "@/components/golf/tour/format";
import { ArrowIcon, cx } from "@/components/ui";
import { useSupabaseBrowser } from "@/lib/live/browser";
import type { BoardRow, TourEvent } from "../tour/_tour/useTourLive";

const EVENT_COLS = "id, name, short_name, state, status_detail, round, starts_at, ends_at, course, updated_at";
const BOARD_COLS = "player_key, name, position, sort_order, to_par, status";

type Top = Pick<BoardRow, "player_key" | "name" | "position" | "sort_order" | "to_par" | "status">;
type Snap = { state: "loading" } | { state: "none" } | { state: "ok"; event: TourEvent; top: Top[] };

/** Sponsors that write their name as one word read as a typo in a serif title (copied from TourBoard.tsx). */
const SPACED: Record<string, string> = { VidantaWorld: "Vidanta World" };
function eventTitle(name: string): string {
  return name.replace(/\b[A-Za-z]+\b/g, (w) => SPACED[w] ?? w);
}

function statusLine(e: TourEvent): string {
  if (e.state === "post") return "Final";
  if (e.state === "pre") return e.starts_at ? `Starts ${shortDate(e.starts_at)}` : "Starts soon";
  return (e.status_detail ?? (e.round ? `Round ${e.round}` : "In progress")).replace(/\s+-\s+/g, " · ");
}

function useTourTeaser(): Snap {
  const db = useSupabaseBrowser();
  const [snap, setSnap] = useState<Snap>({ state: "loading" });
  useEffect(() => {
    if (!db) return;
    let live = true;
    (async () => {
      try {
        const { data, error } = await db
          .from("tour_events")
          .select(`${EVENT_COLS}, tour_leaderboard(${BOARD_COLS})`)
          .order("starts_at", { ascending: false, nullsFirst: false })
          .order("sort_order", { ascending: true, nullsFirst: false, referencedTable: "tour_leaderboard" })
          .limit(3, { referencedTable: "tour_leaderboard" })
          .limit(1)
          .maybeSingle<TourEvent & { tour_leaderboard: Top[] | null }>();
        if (!live) return;
        if (error || !data) { setSnap({ state: "none" }); return; }
        const { tour_leaderboard: rows, ...event } = data;
        setSnap({ state: "ok", event: event as TourEvent, top: rows ?? [] });
      } catch {
        if (live) setSnap({ state: "none" });
      }
    })();
    return () => { live = false; };
  }, [db]);
  return snap;
}

export function HomeTour() {
  const snap = useTourTeaser();
  const ev = snap.state === "ok" ? snap.event : null;
  const top = snap.state === "ok" && ev && ev.state !== "pre" ? snap.top.filter((r) => r.position) : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col" aria-busy={snap.state === "loading" || undefined}>
      <p className="caps text-label text-gold-ink">On tour</p>

      {snap.state === "loading" ? (
        <div aria-hidden="true" className="mt-2 grid gap-2.5">
          <span className="block h-6 w-3/4 animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none" />
          <span className="block h-4 w-32 animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none" />
          <span className="mt-2 block h-4 w-2/3 animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none" />
          <span className="block h-4 w-3/5 animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none" />
          <span className="sr-only">Loading this week&apos;s event</span>
        </div>
      ) : !ev ? (
        <>
          <h3 className="mt-1 font-display text-[1.35rem] leading-tight text-ink">This week on the PGA TOUR</h3>
          <p className="mt-2 text-[0.98rem] text-ink-2">No event this week.</p>
        </>
      ) : (
        <>
          <h3 className="mt-1 min-w-0 text-balance break-words font-display text-[1.35rem] leading-tight text-ink">{eventTitle(ev.name)}</h3>
          <p className="mt-1 font-numeral text-[0.95rem] font-semibold uppercase tracking-[0.06em] text-ink-2">
            {ev.state === "in" && <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-gold align-middle" />}
            {statusLine(ev)}
          </p>
          {top.length > 0 ? (
            <ol aria-label={ev.state === "post" ? "Final top three" : "Top three"} className="mt-3 divide-y divide-rule/70 border-y border-rule/70">
              {top.map((r) => (
                <li key={r.player_key} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-1.5">
                  <span className="font-numeral text-[1rem] font-semibold tabular-nums text-ink-2">{r.position}</span>
                  <span className="truncate font-serif text-[1rem] text-ink">{r.name}</span>
                  <span className={cx("font-numeral text-[1.05rem] font-semibold tabular-nums", toParTone(r.to_par))}>{showToPar(r.to_par)}</span>
                </li>
              ))}
            </ol>
          ) : (
            ev.course && <p className="mt-2 truncate text-[0.98rem] text-ink-2">{ev.course}</p>
          )}
        </>
      )}

      <Link href="/clubhouse/tour" className="link mt-auto inline-flex min-h-tap items-center gap-2 self-start pt-3 text-[0.98rem] font-semibold">
        <span>Check out Tour stats</span>
        <ArrowIcon />
      </Link>
    </div>
  );
}
