"use client";
// The Trophy Room band at the top of a returning golfer's Clubhouse: this week's three trophies (won, or open with
// the days left), the week's rank line, the latest career wins, and the way into the full room.
// Everything comes from src/lib/trophies.ts, derived from the cards on every render (never stored).
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtDate } from "@/components/golf/charts";
import { TrophyArt } from "@/components/golf/TrophyArt";
import { ButtonLink, cx } from "@/components/ui";
import { useClub } from "@/lib/hooks";
import { computeTrophies, isFresh, TIER_WORD, trophyDef, type EarnedTrophy, type ThisWeek, type TrophyState } from "@/lib/trophies";

/** The trophy state for the saved cards, the goal and the index history. */
export function useTrophies(): TrophyState {
  const { ready, store, handicap } = useClub();
  // "Now" is read only once the journal has loaded (on the client), never during the server render.
  return useMemo(
    () => computeTrophies(store.rounds, store.customCourses, store.profile.goal, handicap.history, ready ? new Date() : new Date(0), handicap.display),
    [ready, store.rounds, store.customCourses, store.profile.goal, handicap.history, handicap.display],
  );
}

/** What "new since your last visit" compares against: lastVisit as it was when this visit began. */
export function useVisitStart() {
  const { ready, store } = useClub();
  const [since, setSince] = useState<number | null | undefined>(undefined);
  if (ready && since === undefined) setSince(store.lastVisit ?? null);
  return since ?? null;
}

const weekRange = (w: ThisWeek) => {
  const a = fmtDate(w.start, { month: "short", day: "numeric" });
  const b = w.start.slice(0, 7) === w.end.slice(0, 7) ? fmtDate(w.end, { day: "numeric" }) : fmtDate(w.end, { month: "short", day: "numeric" });
  return `${a}–${b}`;
};
export const daysLeftText = (n: number) => (n === 1 ? "Last day" : `${n} days left`);

/** The sheen that runs once across a trophy just won. Off under reduced motion. */
export function SheenStyle() {
  return (
    <style>{`
      @media (prefers-reduced-motion: no-preference) {
        .trophy-sheen { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
        .trophy-sheen::after { content: ""; position: absolute; inset: -40% auto -40% -60%; width: 45%;
          background: linear-gradient(100deg, transparent, rgb(255 255 255 / 0.28), transparent);
          transform: skewX(-18deg); animation: trophy-sheen 1.6s 0.5s cubic-bezier(0.3, 0, 0.2, 1) both; }
        /* Starts and ends well outside the tile (the skew leans the band's ends sideways) and fades at both ends,
           so nothing is left showing once it has passed. */
        @keyframes trophy-sheen { from { left: -110%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } to { left: 180%; opacity: 0; } }
        .trophy-rise { animation: trophy-rise 520ms var(--ease-hang) both; animation-delay: calc(var(--i, 0) * 70ms); }
        @keyframes trophy-rise { from { transform: translateY(8px) scale(0.96); opacity: 0; } to { transform: none; opacity: 1; } }
      }
    `}</style>
  );
}

/** This week's three trophies: niches in the green cabinet. Shared by the Clubhouse band and the Trophy Room. */
export function WeekSlots({ week, honorsSeen, since, headingLevel = 3 }: { week: ThisWeek; honorsSeen: string[]; since: number | null; headingLevel?: 3 | 4 }) {
  const H = headingLevel === 3 ? "h3" : "h4";
  return (
    <ul className="grid grid-cols-3 gap-2 md:gap-3">
      {week.slots.map((slot, i) => {
        const won = slot.won;
        const tier = won?.tier ?? slot.def.tier;
        const fresh = won ? isFresh(won, honorsSeen, since) : false;
        const isLow = slot.def.id === "week-low";
        return (
          <li
            key={slot.def.id}
            style={{ ["--i" as string]: i }}
            className={cx(
              "trophy-rise relative flex min-w-0 flex-col items-center rounded-xl px-2 pb-3 pt-3 text-center md:px-5 md:pb-5 md:pt-5",
              won ? "border border-gold/60 bg-white/[0.05]" : "border border-dashed border-white/40 bg-black/[0.14]",
            )}
          >
            {won && <span aria-hidden="true" className="trophy-sheen" />}
            {fresh && <span className="caps absolute right-1.5 top-1.5 rounded-xs bg-gold px-1.5 py-0.5 text-[0.62rem] text-green-3 md:right-3 md:top-3">New</span>}
            <div className={cx("relative size-14 shrink-0 sm:size-16 md:size-24", !won && "text-white/70")}>
              <TrophyArt art={slot.def.art} tier={tier} locked={!won} className="size-full" />
            </div>
            <p className="caps mt-2 text-[0.62rem] text-gold md:mt-3 md:text-[0.7rem]">
              {won ? <>Won · {TIER_WORD[won.tier]}</> : <>Open<span className="max-md:sr-only"> · {daysLeftText(week.daysLeft)}</span></>}
            </p>
            <H className="mt-1 text-balance font-serif text-[0.98rem] leading-tight text-on-green md:text-xl">{slot.def.name}</H>
            {isLow && week.rank && (
              <p className="mt-1.5 font-numeral text-[1.35rem] font-semibold leading-none tabular-nums text-on-green md:mt-2 md:text-[2rem]">
                #{week.rank.rank} <span className="text-[0.82rem] font-medium text-paper-3 md:text-base">of {week.rank.of}</span>
              </p>
            )}
            <p aria-hidden="true" className="mt-1 text-[0.8rem] leading-snug text-paper-3 md:hidden">{slot.short}</p>
            <p className="mt-1.5 text-pretty text-[0.92rem] leading-snug text-paper-3 max-md:sr-only">{slot.note}</p>
            {won?.roundId && (
              <Link href={`/clubhouse/rounds/${won.roundId}`} className="link mt-1.5 inline-flex min-h-6 items-center text-[0.82rem] font-medium after:absolute after:inset-0 after:rounded-xl md:text-[0.92rem]">
                See the card<span className="sr-only"> for {slot.def.name}, {fmtDate(won.date)}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The latest career and crystal wins (weekly ones live in the slots above). */
export function latestCareer(state: TrophyState, n: number): EarnedTrophy[] {
  return state.earned.filter((e) => trophyDef(e.id).category !== "weekly").slice(0, n);
}

export function TrophyCase({ className }: { className?: string }) {
  const { ready, store } = useClub();
  const state = useTrophies();
  const since = useVisitStart();
  if (!ready) return null;
  const week = state.thisWeek;
  const latest = latestCareer(state, 3);
  const wonThisWeek = week.slots.filter((s) => s.won).length;

  return (
    <section aria-labelledby="trophy-case" className={className}>
      <SheenStyle />
      <div className="tex-locker on-green overflow-hidden rounded-2xl border border-green-3 shadow-card">
        <div className="grid gap-5 px-4 pb-5 pt-6 sm:px-7 sm:pt-7 md:pb-7">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="caps text-balance text-label text-gold">Trophy Room · week of {weekRange(week)}</p>
              <h2 id="trophy-case" className="mt-1 text-balance font-display text-title text-on-green">
                {wonThisWeek ? `${wonThisWeek} of 3 won this week` : "Three trophies to play for this week"}
              </h2>
              <p className="mt-1 max-w-xl font-serif text-paper-3">
                {week.cards ? `${week.cards} ${week.cards === 1 ? "card" : "cards"} posted since Monday · ${daysLeftText(week.daysLeft).toLowerCase()} in the week.` : `The case empties every Monday. ${daysLeftText(week.daysLeft)} to fill it.`}
              </p>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="font-numeral text-4xl font-semibold leading-none tabular-nums text-on-green">{state.wonCount}</span>
              <span className="font-serif text-paper-3">of {state.total} trophies won</span>
            </p>
          </div>
          <WeekSlots week={week} honorsSeen={store.honorsSeen} since={since} />
        </div>

        <div className="grid gap-4 border-t border-white/15 bg-black/[0.12] px-4 py-5 sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          {latest.length ? (
            <div className="min-w-0">
              <h3 className="caps text-[0.72rem] text-gold">Latest on the shelf</h3>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {latest.map((e) => {
                  const d = trophyDef(e.id);
                  const fresh = isFresh(e, store.honorsSeen, since);
                  const body = (
                    <>
                      <TrophyArt art={d.art} tier={e.tier} className="size-11 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-on-green group-hover/l:underline">{d.name}</span>
                        <span className="block truncate text-[0.85rem] text-paper-3">
                          {fresh ? "New · " : ""}{TIER_WORD[e.tier]} · {fmtDate(e.date)}
                        </span>
                      </span>
                    </>
                  );
                  const face = "flex min-h-16 min-w-0 items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-2.5";
                  return (
                    <li key={e.key} className="min-w-0 max-lg:[&:nth-child(3)]:hidden">
                      {e.roundId ? (
                        <Link href={`/clubhouse/rounds/${e.roundId}`} className={cx(face, "group/l transition-colors duration-150 is-hover:bg-white/[0.12] is-pressed:bg-white/[0.16]")}>{body}</Link>
                      ) : (
                        <div className={face}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="font-serif text-paper-3">Your first card puts the first trophy on the shelf.</p>
          )}
          <ButtonLink href="/clubhouse/trophies" tone="green" variant="primary" className="justify-self-start lg:self-end">
            Trophy Room
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
