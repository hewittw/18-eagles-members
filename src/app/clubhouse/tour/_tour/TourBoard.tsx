"use client";
// /clubhouse/tour: this week's PGA TOUR event (ESPN) and the world ranking (OWGR), with the golfer's own players
// first. Everything arrives through Supabase: a snapshot, then Realtime pushes of only the rows the worker changed.
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ApiState, Freshness, LivePauseNotice, PageHeader, PhotoBand } from "@/components/golf";
import { FollowToggle } from "@/components/golf/FollowToggle";
import { isOut, OUT_LABEL, OUT_WORDS, sayThru, sayToPar, shortDate, showThru, showToPar, toParTone } from "@/components/golf/tour/format";
import { Button, cx, Field, SectionHeading, TextInput } from "@/components/ui";
import { useSupabaseBrowser } from "@/lib/live/browser";
import { MAX_PLAYERS } from "@/lib/live/limits";
import { playerKey } from "@/lib/live/playerKey";
import { useFlash } from "@/lib/live/useFlash";
import { useWorkerHealth, type WorkerHealth } from "@/lib/live/useWorkerHealth";
import { Page } from "../../_components/Placeholder";
import { useFollows, type FollowsState } from "./useFollows";
import { useTourLive, type BoardRow, type RankRow, type TourEvent, type TourLive } from "./useTourLive";

// Both lists open on their top 25 with a "Show all N" toggle (a search always shows every match).
const RANK_PREVIEW = 25;
const BOARD_PREVIEW = 25;
// The band's photo: Augusta's 18th green beside the white LEADERS board (docs/credits.md, Augusta National g2.jpg).
const BAND_PHOTO = { src: "/courses/augusta-national/graded/g2.jpg", credit: "Dan Perry, CC BY 2.0" };

export function TourBoard() {
  const db = useSupabaseBrowser();
  // Freshness first: these subscribe to worker_runs before the tables' snapshots are read.
  const tourHealth = useWorkerHealth("tour", 10);
  const rankHealth = useWorkerHealth("rankings", 3600);
  const live = useTourLive(db);
  const follows = useFollows(db);
  const [query, setQuery] = useState("");
  // "Show all" on either list (lifted here so the ranking knows whether to hold still beside the leaderboard).
  const [boardAll, setBoardAll] = useState(false);
  const [rankAll, setRankAll] = useState(false);

  const rankByKey = useMemo(() => new Map(live.rankings.map((r) => [r.player_key, r])), [live.rankings]);
  const boardByKey = useMemo(() => new Map(live.board.map((r) => [r.player_key, r])), [live.board]);

  return (
    <>
      <PhotoBand aria-label="Tour" photo={BAND_PHOTO}>
        <div className="mx-auto max-w-ledger px-4 pb-12 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:px-8">
          <PageHeader
            tone="green"
            className="bg-transparent"
            eyebrow="On tour this week"
            title="Tour"
            lede={`The PGA TOUR leaderboard as it's posted, and the world ranking. Follow up to ${MAX_PLAYERS} players and they come first.`}
          />
        </div>
      </PhotoBand>
      <Page className="grid gap-10 md:gap-14">

        <EventBand live={live} health={tourHealth} />

        <YourPlayers follows={follows} boardByKey={boardByKey} rankByKey={rankByKey} live={live} />

        <FollowAnnouncer live={live} follows={follows} />

        <div className="grid gap-6">
          <div className="max-w-md">
            <Field label="Find a player" hint="Searches the leaderboard and the world ranking.">
              {(a) => (
                <TextInput {...a} type="search" autoComplete="off" spellCheck={false} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Scheffler, Åberg, Kim…" />
              )}
            </Field>
          </div>
          <div className="grid gap-14 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:gap-10 [&>*]:min-w-0">
            <Leaderboard live={live} health={tourHealth} follows={follows} query={query} onClear={() => setQuery("")} rankByKey={rankByKey} all={boardAll} setAll={setBoardAll} />
            <WorldRanking live={live} health={rankHealth} follows={follows} query={query} onClear={() => setQuery("")} all={rankAll} setAll={setRankAll} hold={!boardAll && !rankAll} />
          </div>
        </div>

        <p className="max-w-measure text-[0.85rem] leading-relaxed text-ink-2">
          Leaderboard data from{" "}
          <a className="link" href="https://www.espn.com/golf/leaderboard" target="_blank" rel="noreferrer">ESPN<span className="sr-only"> (opens in a new tab)</span></a>.
          World ranking from the{" "}
          <a className="link" href="https://www.owgr.com/" target="_blank" rel="noreferrer">Official World Golf Ranking<span className="sr-only"> (opens in a new tab)</span></a>.
          Our server checks both on a schedule and saves only what changed; your browser never calls them.
        </p>

        <LivePauseNotice what="the leaderboard and the ranking" />
      </Page>
    </>
  );
}

// ───────── The event band ─────────

function statusLine(e: TourEvent): string {
  if (e.state === "post") return "Final";
  if (e.state === "pre") return e.starts_at ? `Starts ${shortDate(e.starts_at)}` : "Starts soon";
  return (e.status_detail ?? (e.round ? `Round ${e.round}` : "In progress")).replace(/\s+-\s+/g, " · ");
}

function EventBand({ live, health }: { live: TourLive; health: WorkerHealth }) {
  const e = live.event;
  const leader = live.board.find((r) => !isOut(r.status) && r.position);
  const dates = e?.starts_at ? `${shortDate(e.starts_at)}${e.ends_at ? ` – ${shortDate(e.ends_at)}` : ""}` : null;

  let body: ReactNode;
  if (live.eventLoad === "loading") {
    body = <ApiState kind="loading" tone="green" shape="line" label="Loading this week's event" className="py-2" />;
  } else if (live.eventLoad === "error" && !e) {
    body = (
      <ApiState kind="down" tone="green" title="We couldn’t read this week’s event">
        Reload the page in a moment. Your players and the world ranking are below.
      </ApiState>
    );
  } else if (!e) {
    body = (
      <div>
        <p className="caps text-label text-gold">PGA TOUR</p>
        <h2 className="mt-1 font-display text-display-2 text-on-green">No tournament this week</h2>
        <p className="mt-2 max-w-measure font-serif text-lede text-paper-3">The board goes up when ESPN posts the next field. Your players and the world ranking are below.</p>
      </div>
    );
  } else {
    const final = e.state === "post";
    body = (
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-10">
        <div className="min-w-0">
          <p className="caps text-label text-gold">
            PGA TOUR{e.round && e.state !== "pre" ? ` · Round ${e.round}` : ""}
          </p>
          <h2 className="mt-1 font-display text-display-2 text-balance text-on-green">{e.name}</h2>
          <p className="mt-2 text-[1rem] text-paper-3">
            {[e.course, dates].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-4 inline-flex min-h-8 items-center gap-2 rounded-full border border-gold/70 px-3.5 font-numeral text-[0.95rem] font-semibold uppercase tracking-[0.08em] text-gold">
            {e.state === "in" && <span aria-hidden="true" className="size-2 rounded-full bg-gold" />}
            {statusLine(e)}
          </p>
        </div>
        {leader && (
          <div className="flex min-w-0 items-center gap-4">
            <div className="min-w-0 text-right">
              <p className="caps text-label text-gold">{final ? "Winner" : leader.position?.startsWith("T") ? "Tied for the lead" : "Leader"}</p>
              <p className="mt-1 font-serif text-[1.25rem] leading-tight text-on-green">{leader.name}</p>
            </div>
            <p className="tile grid min-h-tile min-w-[4.5rem] place-items-center rounded-xs px-3 font-numeral text-[2.2rem] font-semibold leading-none tabular-nums">
              <span className={toParTone(leader.to_par)} aria-hidden="true">{showToPar(leader.to_par)}</span>
              <span className="sr-only">{sayToPar(leader.to_par)}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-label="This week's event" className="tex-locker on-green rounded-2xl px-5 py-7 shadow-card sm:px-8">
      {body}
      <div className="mt-6 border-t border-gold/35 pt-4">
        <Freshness health={health} what="The leaderboard" tone="green" />
      </div>
    </section>
  );
}

// ───────── Your players ─────────

function YourPlayers({ follows, boardByKey, rankByKey, live }: { follows: FollowsState; boardByKey: Map<string, BoardRow>; rankByKey: Map<string, RankRow>; live: TourLive }) {
  const list = follows.list;
  const n = list?.length ?? 0;
  // In the field first, in board order; then the rest by world rank.
  const sorted = useMemo(() => {
    if (!list) return [];
    return [...list].sort((a, b) => {
      const ra = boardByKey.get(a.key), rb = boardByKey.get(b.key);
      if (ra && rb) return (ra.sort_order ?? 9999) - (rb.sort_order ?? 9999);
      if (ra || rb) return ra ? -1 : 1;
      return (rankByKey.get(a.key)?.rank ?? 9999) - (rankByKey.get(b.key)?.rank ?? 9999) || a.name.localeCompare(b.name);
    });
  }, [list, boardByKey, rankByKey]);

  return (
    <section aria-labelledby="yours-h" className="grid gap-5">
      <SectionHeading
        id="yours-h"
        eyebrow="Followed"
        title="Your players"
        action={list ? <p className="font-numeral text-[1.05rem] font-medium tabular-nums text-ink-2">{n} of {MAX_PLAYERS}</p> : undefined}
      />
      {follows.error && <p className="text-[0.95rem] text-error" role="status">{follows.error}</p>}
      {!list ? (
        <ApiState kind="loading" shape="list" label="Loading the players you follow" />
      ) : n === 0 ? (
        <ApiState kind="empty" title="Nobody followed yet">
          Press <strong className="font-semibold text-ink">Follow</strong> beside any player on the leaderboard or in the world ranking. They&rsquo;ll
          sit here first, with their score as it&rsquo;s posted.
        </ApiState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {sorted.map((p) => (
            <PlayerCard key={p.key} name={p.name} row={boardByKey.get(p.key) ?? null} rank={rankByKey.get(p.key) ?? null} follows={follows}
              boardReady={live.boardLoad === "ready"} rankReady={live.rankings.length > 0 || live.rankLoad === "ready"} hasEvent={!!live.event} flashAt={live.touched.get(p.key)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlayerCard({ name, row, rank, follows, boardReady, rankReady, hasEvent, flashAt }: { name: string; row: BoardRow | null; rank: RankRow | null; follows: FollowsState; boardReady: boolean; rankReady: boolean; hasEvent: boolean; flashAt?: number }) {
  const ref = useFlash<HTMLLIElement>(flashAt);
  const key = playerKey(name);
  const display = row?.name ?? rank?.name ?? name;
  const out = row && isOut(row.status);
  const pos = row ? (out ? OUT_LABEL[row.status!] : row.position ?? "–") : "–";
  // Only claim "outside the top 200" once the ranking has actually loaded (not while it loads or if it failed).
  const worldRank = rank ? `World No. ${rank.rank}` : rankReady ? "Outside the world top 200" : null;

  return (
    <li ref={ref} className="grid min-w-0 gap-3 rounded-xl border border-rule bg-paper-2 p-4 shadow-card">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 pt-1">
          <h3 className="font-serif text-[1.15rem] font-bold leading-snug text-balance text-ink">{display}</h3>
          <p className="text-[0.88rem] leading-snug text-ink-2">{[row?.country ?? rank?.country, worldRank].filter(Boolean).join(" · ")}</p>
        </div>
        <FollowToggle label={display} following onToggle={() => follows.toggle(display)} busy={follows.busy.has(key)} compact />
      </div>
      <div className="flex min-w-0 items-center gap-3 border-t border-rule pt-3">
        <p className={cx("tile grid min-h-12 min-w-12 shrink-0 place-items-center rounded-xs px-2 font-numeral text-[1.2rem] font-semibold leading-none tabular-nums", out || !row ? "text-ink-2" : "text-ink")}>
          <span aria-hidden="true">{pos}</span>
          <span className="sr-only">{row ? (out ? OUT_WORDS[row.status!] : row.position ? `Position ${row.position}` : "No position yet") : "Not playing"}</span>
        </p>
        {row && !out ? (
          <>
            <p className="shrink-0 font-numeral text-[1.9rem] font-semibold leading-none tabular-nums">
              <span className={toParTone(row.to_par)} aria-hidden="true">{showToPar(row.to_par)}</span>
              <span className="sr-only">{sayToPar(row.to_par)}</span>
            </p>
            <p className="min-w-0 text-[0.92rem] leading-snug text-ink-2">
              <span className="whitespace-nowrap">Today <span className={cx("font-numeral text-[1.02rem] font-semibold tabular-nums", toParTone(row.today))}>{showToPar(row.today)}</span></span>
              <span aria-hidden="true"> · </span>
              <span className="whitespace-nowrap">{row.thru && /^\d{4}-/.test(row.thru) ? "Tees off " : "Thru "}<span className="font-numeral text-[1.02rem] font-semibold tabular-nums text-ink">{showThru(row.thru, row.status)}</span></span>
            </p>
          </>
        ) : (
          <p className="min-w-0 text-[0.95rem] leading-snug text-ink-2">
            {row ? OUT_WORDS[row.status!] : !boardReady ? "Checking this week's field…" : hasEvent ? "Not in this week's field" : "No tournament this week"}
          </p>
        )}
      </div>
    </li>
  );
}

/** One polite announcement when a followed player's position or score changes (never the clock, never others). */
function FollowAnnouncer({ live, follows }: { live: TourLive; follows: FollowsState }) {
  const c = live.lastChange;
  let msg = "";
  if (c && follows.isFollowing(c.key) && (c.before?.position !== c.after.position || c.before?.to_par !== c.after.to_par)) {
    const a = c.after;
    msg = isOut(a.status) ? `${a.name}: ${OUT_WORDS[a.status!]}.` : `${a.name}: ${a.position ? `now ${a.position}, ` : ""}${sayToPar(a.to_par)}, ${sayThru(a.thru, a.status)}.`;
  }
  return <p className="sr-only" aria-live="polite">{msg}</p>;
}

// ───────── The leaderboard ─────────

const matches = (name: string, q: string) => !q || playerKey(name).includes(playerKey(q));

function Leaderboard({ live, health, follows, query, onClear, rankByKey, all, setAll }: { live: TourLive; health: WorkerHealth; follows: FollowsState; query: string; onClear: () => void; rankByKey: Map<string, RankRow>; all: boolean; setAll: (f: (v: boolean) => boolean) => void }) {
  const [showOut, setShowOut] = useState(false);
  const q = query.trim();
  const matched = live.board.filter((r) => matches(r.name, q));
  // Players out of the event (cut, withdrawn) fold away unless asked for, or a search finds them.
  const outCount = matched.filter((r) => isOut(r.status)).length;
  const foldOut = !q && !showOut && outCount > 0 && outCount < matched.length;
  const rows = foldOut ? matched.filter((r) => !isOut(r.status)) : matched;
  // Then the top 25 until "Show all" (the same pattern as the world ranking). A search shows every match.
  const preview = !q && !all && rows.length > BOARD_PREVIEW;
  const shown = preview ? rows.slice(0, BOARD_PREVIEW) : rows;
  const firstOut = shown.findIndex((r) => isOut(r.status));
  const final = live.event?.state === "post";

  let content: ReactNode;
  if (live.boardLoad === "loading") content = <ApiState kind="loading" shape="list" label="Loading the leaderboard" />;
  else if (live.boardLoad === "error" && !live.board.length) content = <ApiState kind="down" title="We couldn't read the leaderboard">Reload the page in a moment. If it keeps happening, the board&rsquo;s feed may be down.</ApiState>;
  else if (!live.event) content = <ApiState kind="empty" title="No tournament this week">The leaderboard goes up when ESPN posts the next field.</ApiState>;
  else if (!live.board.length) content = <ApiState kind="empty" title="The field isn't posted yet">Tee times and the field usually go up a day or two before the first round.</ApiState>;
  else if (!matched.length) content = <ApiState kind="empty" title={`No one called “${q}” in this week's field`} action={<Button size="sm" variant="secondary" onClick={onClear}>Clear the search</Button>}>Check the spelling, or look in the world ranking.</ApiState>;
  else {
    content = (
      <div className="scroll-x rounded-xl border border-rule bg-paper-2 shadow-card">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{live.event.name} leaderboard{final ? ", final" : ""}{q ? `, players matching ${q}` : preview ? `, top ${BOARD_PREVIEW}` : ""}</caption>
          <thead>
            <tr className="border-b border-rule-strong">
              <Th className="w-11 pl-3 sm:w-14 sm:pl-4">Pos</Th>
              <Th>Player</Th>
              <Th className="text-right leading-tight sm:whitespace-nowrap">To par</Th>
              <Th className="hidden text-right sm:table-cell">Today</Th>
              <Th className="hidden text-right sm:table-cell">Thru</Th>
              <Th className="w-0 pr-2 sm:pr-4"><span className="sr-only">Follow</span></Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <BoardTr key={r.player_key} r={r} cutLine={i === firstOut && i > 0} follows={follows} flashAt={live.touched.get(r.player_key)} rank={rankByKey.get(r.player_key)?.rank} />
            ))}
          </tbody>
        </table>
        {!q && !preview && outCount > 0 && outCount < matched.length && (
          <div className="border-t border-rule-strong bg-paper-3 px-3 py-2 sm:px-4">
            <Button variant="quiet" size="sm" aria-expanded={!foldOut} onClick={() => setShowOut((v) => !v)}>
              {foldOut ? `Show the ${outCount} who missed the cut or withdrew` : "Hide the players who missed the cut"}
            </Button>
          </div>
        )}
      </div>
    );
    if (!q && rows.length > BOARD_PREVIEW) {
      content = (
        <>
          {content}
          <div>
            <Button variant="secondary" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? `Show the top ${BOARD_PREVIEW}` : `Show all ${rows.length}`}
            </Button>
          </div>
        </>
      );
    }
  }

  return (
    <section aria-labelledby="board-h" className="grid content-start gap-4">
      <SectionHeading id="board-h" eyebrow={final ? "Final results" : "Live scoring"} title="Leaderboard"
        action={live.board.length ? <p role="status" className="font-numeral text-[1.05rem] font-medium tabular-nums text-ink-2">{q ? `${matched.length} of ${live.board.length}` : `${live.board.length} players`}</p> : undefined} />
      <Freshness health={health} what="The leaderboard" />
      {content}
    </section>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th scope="col" className={cx("caps px-2 py-3 text-label font-semibold text-ink-2", className)}>{children}</th>;
}

function BoardTr({ r, cutLine, follows, flashAt, rank }: { r: BoardRow; cutLine: boolean; follows: FollowsState; flashAt?: number; rank?: number }) {
  const ref = useFlash<HTMLTableRowElement>(flashAt);
  const out = isOut(r.status);
  const following = follows.isFollowing(r.player_key);
  return (
    <>
      {cutLine && (
        <tr>
          <td colSpan={6} className="border-y border-rule-strong bg-paper-3 px-4 py-2">
            <span className="caps text-label text-ink-2">Missed the cut · withdrew</span>
          </td>
        </tr>
      )}
      <tr ref={ref} className={cx("border-b border-rule last:border-b-0", following && "bg-tint/60")}>
        <td className={cx("py-2 pl-3 pr-2 font-numeral text-[1.05rem] font-semibold tabular-nums sm:pl-4", out ? "text-ink-2" : "text-ink")}>
          {out ? OUT_LABEL[r.status!] : r.position ?? "–"}
        </td>
        <th scope="row" className="min-w-0 px-2 py-2 text-left font-normal">
          <span className="block font-medium leading-snug text-ink">{r.name}</span>
          <span className="block text-[0.85rem] leading-snug text-ink-2">
            <span className={out ? undefined : "hidden sm:inline"}>{r.country}</span>
            {rank ? <span className="hidden sm:inline">{r.country ? " · " : ""}World No. {rank}</span> : null}
            {!out && (
              <span className="sm:hidden">
                <span className="whitespace-nowrap">Today <span className={cx("font-numeral font-semibold", toParTone(r.today))}>{showToPar(r.today)}</span></span>
                {" · "}<span className="whitespace-nowrap">{r.thru && /^\d{4}-/.test(r.thru) ? "" : "Thru "}{showThru(r.thru, r.status)}</span>
              </span>
            )}
          </span>
        </th>
        <td className="px-2 py-2 text-right font-numeral text-[1.25rem] font-semibold tabular-nums">
          <span className={out ? "text-ink-2" : toParTone(r.to_par)} aria-hidden="true">{showToPar(r.to_par)}</span>
          <span className="sr-only">{sayToPar(r.to_par)}</span>
        </td>
        <td className="hidden px-2 py-2 text-right font-numeral text-[1.05rem] font-medium tabular-nums sm:table-cell">
          <span className={toParTone(r.today)} aria-hidden="true">{out ? "–" : showToPar(r.today)}</span>
          <span className="sr-only">{out || !r.today ? "no score today" : sayToPar(r.today)}</span>
        </td>
        <td className="hidden whitespace-nowrap px-2 py-2 text-right font-numeral text-[1.05rem] font-medium tabular-nums text-ink sm:table-cell">
          <span aria-hidden="true">{showThru(r.thru, r.status)}</span>
          <span className="sr-only">{sayThru(r.thru, r.status)}</span>
        </td>
        <td className="py-1.5 pl-1 pr-2 text-right sm:pl-2 sm:pr-4">
          <FollowToggle label={r.name} following={following} onToggle={() => follows.toggle(r.name)} busy={follows.busy.has(r.player_key)} compact />
        </td>
      </tr>
    </>
  );
}

// ───────── The world ranking ─────────

function WorldRanking({ live, health, follows, query, onClear, all, setAll, hold }: { live: TourLive; health: WorkerHealth; follows: FollowsState; query: string; onClear: () => void; all: boolean; setAll: (f: (v: boolean) => boolean) => void; hold: boolean }) {
  // From xl the ranking sits beside the (usually longer) leaderboard. When it fits on screen it stays in view
  // (sticky, clear of the top bar) instead of ending early beside an empty column; with either list open in full,
  // or when it's taller than the window, both columns scroll normally.
  const ref = useRef<HTMLElement>(null);
  const fits = useFitsWindow(ref, STICKY_TOP_PX);
  const q = query.trim();
  const matched = live.rankings.filter((r) => matches(r.name, q));
  const shown = q || all ? matched : matched.slice(0, RANK_PREVIEW);

  let content: ReactNode;
  if (live.rankLoad === "loading") content = <ApiState kind="loading" shape="list" label="Loading the world ranking" />;
  else if (live.rankLoad === "error" && !live.rankings.length) content = <ApiState kind="down" title="We couldn't read the world ranking">Reload the page in a moment.</ApiState>;
  else if (!live.rankings.length) content = <ApiState kind="empty" title="The world ranking isn't in yet">It&rsquo;s checked every hour. It will appear here on its own.</ApiState>;
  else if (!matched.length) content = <ApiState kind="empty" title={`No one called “${q}” in the top 200`} action={<Button size="sm" variant="secondary" onClick={onClear}>Clear the search</Button>}>Check the spelling.</ApiState>;
  else {
    content = (
      <>
        <div className="scroll-x rounded-xl border border-rule bg-paper-2 shadow-card">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Official World Golf Ranking{q ? `, players matching ${q}` : all ? ", top 200" : `, top ${RANK_PREVIEW}`}</caption>
            <thead>
              <tr className="border-b border-rule-strong">
                <Th className="w-11 pl-3 sm:w-14 sm:pl-4">Rank</Th>
                <Th className="w-10 sm:w-16">Move</Th>
                <Th>Player</Th>
                <Th className="hidden text-right sm:table-cell">Avg pts</Th>
                <Th className="w-0 pr-2 sm:pr-4"><span className="sr-only">Follow</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => <RankTr key={r.player_key} r={r} follows={follows} flashAt={live.touched.get(`rank:${r.player_key}`)} />)}
            </tbody>
          </table>
        </div>
        {!q && matched.length > RANK_PREVIEW && (
          <div>
            <Button variant="secondary" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? `Show the top ${RANK_PREVIEW}` : `Show all ${matched.length}`}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <section ref={ref} aria-labelledby="owgr-h" className={cx("grid content-start gap-4 xl:self-start", hold && fits && "xl:sticky xl:top-24")}>
      <SectionHeading id="owgr-h" eyebrow="Official World Golf Ranking" title="World ranking" />
      <Freshness health={health} what="The world ranking" />
      {content}
    </section>
  );
}

function RankTr({ r, follows, flashAt }: { r: RankRow; follows: FollowsState; flashAt?: number }) {
  const ref = useFlash<HTMLTableRowElement>(flashAt);
  const following = follows.isFollowing(r.player_key);
  const pts = r.points == null ? null : Number(r.points);
  return (
    <tr ref={ref} className={cx("border-b border-rule last:border-b-0", following && "bg-tint/60")}>
      <td className="py-2 pl-3 pr-2 font-numeral text-[1.05rem] font-semibold tabular-nums text-ink sm:pl-4">{r.rank}</td>
      <td className="px-2 py-2"><Movement rank={r.rank} prev={r.prev_rank} /></td>
      <th scope="row" className="min-w-0 px-2 py-2 text-left font-normal">
        <span className="block font-medium leading-snug text-ink">{r.name}</span>
        <span className="block text-[0.85rem] leading-snug text-ink-2">
          {r.country}
          {pts != null && <span className="sm:hidden">{r.country ? " · " : ""}{pts.toFixed(2)} avg</span>}
        </span>
      </th>
      <td className="hidden px-2 py-2 text-right font-numeral text-[1.05rem] font-medium tabular-nums text-ink sm:table-cell">{pts == null ? "–" : pts.toFixed(2)}</td>
      <td className="py-1.5 pl-1 pr-2 text-right sm:pl-2 sm:pr-4">
        <FollowToggle label={r.name} following={following} onToggle={() => follows.toggle(r.name)} busy={follows.busy.has(r.player_key)} compact />
      </td>
    </tr>
  );
}

/** Up: a Fairway triangle and the places gained. Down: an ink triangle pointing down. Words for screen readers. */
function Movement({ rank, prev }: { rank: number; prev: number | null }) {
  if (prev == null) return <span className="caps text-label text-ink-2">New</span>;
  const d = prev - rank;
  if (d === 0) return <span className="font-numeral text-ink-2"><span aria-hidden="true">–</span><span className="sr-only">No change</span></span>;
  const up = d > 0;
  return (
    <span className={cx("inline-flex items-center gap-1 font-numeral text-[0.98rem] font-semibold tabular-nums", up ? "text-green" : "text-ink-2")}>
      <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
        <path d={up ? "M5 1 L9.5 8.5 H0.5 Z" : "M5 9 L9.5 1.5 H0.5 Z"} fill="currentColor" />
      </svg>
      <span aria-hidden="true">{Math.abs(d)}</span>
      <span className="sr-only">{up ? "Up" : "Down"} {Math.abs(d)} from {prev} last week</span>
    </span>
  );
}

// xl:top-24 (6rem) clears the sticky top bar; the extra 1rem keeps the ranking's last row off the window's edge.
const STICKY_TOP_PX = 96 + 16;

/** Whether the element is short enough to stay stuck `top` px down without its bottom running off the window. */
function useFitsWindow(ref: RefObject<HTMLElement | null>, top: number): boolean {
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setFits(el.offsetHeight <= window.innerHeight - top);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => { ro.disconnect(); window.removeEventListener("resize", check); };
  }, [ref, top]);
  return fits;
}
