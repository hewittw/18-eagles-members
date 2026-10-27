"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ClubPicker, FairwayPicker, HoleIllustration, ScorecardTable, ScoreTiles, toParText } from "@/components/golf";
import { ArrowIcon, Button, ButtonLink, Callout, ErrorIcon, Field, SkipTo, Stepper, TextArea, cx, useToast } from "@/components/ui";
import { holesFor, yardsAt } from "@/lib/courses";
import { swallowStrayTap, useClub } from "@/lib/hooks";
import { finishRound } from "@/lib/round-actions";
import { emptyEntry, setEntry, update } from "@/lib/store";
import type { HoleEntry } from "@/lib/types";
import { puttsError } from "@/lib/validate";
import { Page, Placeholder } from "../../../_components/Placeholder";
import { HoleWind } from "../../../_components/Conditions";

const count = (xs: string[], id: string) => xs.filter((x) => x === id).length;
// iOS inset grouping: a small caps caption above a rounded white card.
const caption = "caps mb-2 px-1 text-[0.74rem] text-ink-2";
// One half of the phone action bar (equal columns, see below): one line, a little tighter on phones.
const half = "whitespace-nowrap max-sm:gap-2 max-sm:px-3 max-sm:text-base";
const ordinal = (k: number) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][k % 10] ?? "th")}`;
const group = "rounded-xl border border-rule/70 bg-paper-2 p-4 shadow-card sm:p-5";

export function HoleScreen({ id, holeParam }: { id: string; holeParam: string }) {
  const { ready, store, course } = useClub();
  const router = useRouter();
  const toast = useToast();
  const [keep, setKeep] = useState(false); // "Keep 4" on the shots-vs-score question
  const [finishing, setFinishing] = useState(false);
  // The shots-vs-score question goes away once answered: put focus back on the chosen score, not on <body>.
  const scoreRef = useRef<HTMLDivElement>(null);
  // A quick double tap on Next would land its second tap on the next hole's Next (same spot) and skip a hole.
  // The bar ignores taps for a moment after a hole appears (this also runs when the router reshows a kept hole).
  const shownAt = useRef(0);
  useLayoutEffect(() => { shownAt.current = performance.now(); }, []);
  const settle = (ev: { preventDefault(): void }) => {
    if (performance.now() - shownAt.current > 500) return true;
    ev.preventDefault();
    return false;
  };
  const focusScore = () => requestAnimationFrame(() => scoreRef.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus());

  if (!ready) return <Placeholder label="Walking to the tee" />;
  const round = store.rounds.find((r) => r.id === id);
  const c = round && course(round.courseSlug);
  if (!round || !c) return <Missing />;

  const holes = holesFor(c, round.holes);
  const n = Number(holeParam);
  const idx = holes.findIndex((h) => h.n === n);
  if (idx < 0) return <Missing what="hole" roundId={round.id} />;
  const hole = holes[idx];
  const prev = holes[idx - 1];
  const next = holes[idx + 1];
  const e: HoleEntry = { ...emptyEntry(), ...round.entries[n] };
  const tee = c.tees.find((t) => t.name === round.teeName) ?? c.tees[0];
  const yards = yardsAt(c, tee, hole);
  const patch = (p: Partial<HoleEntry>) => setEntry(round.id, n, p);

  const played = holes.filter((h) => round.entries[h.n]?.strokes != null);
  const toPar = played.reduce((a, h) => a + (round.entries[h.n]!.strokes! - h.par), 0);
  const gross = played.reduce((a, h) => a + round.entries[h.n]!.strokes!, 0);
  const shotsTotal = e.shots.length + e.penalties;
  const mismatch = e.shots.length > 0 && e.strokes != null && shotsTotal !== e.strokes && !keep;
  const puttsErr = puttsError(e.putts, e.strokes);
  const lastNote = [...store.rounds]
    .filter((r) => r.id !== round.id && r.courseSlug === c.slug && r.entries[n]?.note)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.entries[n]?.note;

  // Clubs can count the score: the first time shots are logged on an unscored hole, the score follows them,
  // and putts follow the putter taps until the golfer sets putts by hand.
  // Clearing every shot clears a score (and putts) that were only counting them; Undo clear brings them back.
  const onShots = (shots: string[]) => {
    const p: Partial<HoleEntry> = { shots };
    const followed = e.strokes == null || e.strokes === e.shots.length + e.penalties;
    if (followed) p.strokes = shots.length ? shots.length + e.penalties : null;
    if (e.putts == null || e.putts === count(e.shots, "pt")) p.putts = !shots.length ? null : count(shots, "pt") || (e.putts == null ? null : 0);
    setKeep(false);
    patch(p);
  };
  // A penalty is part of the score: while the score is counting the clubs, it counts the penalty too.
  const onPenalties = (v: number) => {
    const p: Partial<HoleEntry> = { penalties: v };
    if (e.shots.length && e.strokes === e.shots.length + e.penalties) p.strokes = e.shots.length + v;
    patch(p);
  };

  const missing = holes.filter((h) => round.entries[h.n]?.strokes == null && h.n !== n).concat(e.strokes == null ? [hole] : []);
  const frontDone = round.holes === "18" && c.holes.length === 18 && holes.slice(0, 9).every((h) => round.entries[h.n]?.strokes != null) && holes.slice(9).every((h) => round.entries[h.n]?.strokes == null);

  const finish = (asFront = false) => {
    swallowStrayTap();
    if (asFront) update((s) => ({ ...s, rounds: s.rounds.map((r) => (r.id === round.id ? { ...r, holes: "front" } : r)) }));
    finishRound(round.id);
    toast({ message: `Card saved: ${gross} at ${c.shortName}` });
    router.push(`/clubhouse/rounds/${round.id}`);
  };

  // Unique per hole: the router keeps the holes you just left mounted (hidden), and a shared id would find one of those.
  const nextId = `hole-next-${n}`;
  const back = round.status === "complete" ? { href: `/clubhouse/rounds/${round.id}`, label: "Back to the card" } : { href: "/clubhouse", label: "Clubhouse" };

  return (
    <>
      <DocTitle title={`Hole ${n}${hole.name ? ` · ${hole.name}` : ""} · ${c.shortName} · 18 Eagles`} />
      <Page className="!pt-3 md:!pt-8">
        <Link href={back.href} className="-ml-1 mb-3 inline-flex sm:mb-4 min-h-tap items-center gap-1.5 rounded-full bg-tint py-1 pl-2.5 pr-4 text-[0.95rem] font-semibold text-green transition-[background-color,transform] duration-150 is-hover:bg-tint-2 is-pressed:scale-[0.98]">
          <svg viewBox="0 0 10 16" className="h-4 w-2.5 shrink-0" aria-hidden="true"><path d="M8 2 L2 8 L8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {back.label}
        </Link>

        {/* Where you are: the course, the hole, and the running score, on a Masters-green card.
            Phones: the score chip sits beside the hole number, so the score tiles start on the first screen. */}
        <header className="tex-locker on-green grid grid-cols-[minmax(0,1fr)] rounded-2xl px-5 py-4 shadow-card sm:px-7 sm:py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-x-10 md:[grid-template-areas:'e_c'_'h_c'_'d_c']">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 md:[grid-area:e]">
            <p className="caps text-balance text-label text-gold max-sm:tracking-[0.1em]">{c.shortName} · {round.teeName} tees{round.status === "complete" ? " · editing a finished card" : ""}</p>
            {round.status === "playing" && <HoleWind course={c} round={round} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:contents">
          <h1 className="min-w-0 font-display text-display-2 text-on-green md:mt-1 md:[grid-area:h]">
            Hole {n}
            {hole.name && <span className="font-serif text-[0.55em] italic text-paper-3"> · {hole.name}</span>}
          </h1>
          <p className="ml-auto flex min-w-0 flex-col items-end rounded-xl bg-black/15 px-3.5 py-2 text-right font-numeral tabular-nums text-paper-3 md:self-end md:[grid-area:c] md:px-4 md:py-3 md:text-lg" aria-live="polite">
            {played.length ? (
              <>
                <span className="caps text-[0.66rem] text-gold md:text-[0.7rem]">Through {played.length}<span className="sr-only">, </span></span>
                <span className="text-[1.6rem] font-semibold leading-none text-on-green md:text-[2rem]">{toParText(toPar)}<span className="sr-only">, </span></span>
                <span className="text-[0.92rem] md:text-lg">{gross} strokes</span>
              </>
            ) : (
              // The same three lines as once scored, so the first tile tap doesn't push the tiles down.
              <>
                <span className="caps text-[0.66rem] text-gold md:text-[0.7rem]">Hole {idx + 1} of {holes.length}<span className="sr-only">, </span></span>
                <span className="text-[1.6rem] font-semibold leading-none text-on-green md:text-[2rem]" aria-hidden="true">E</span>
                <span className="text-[0.92rem] md:text-lg">No strokes yet</span>
              </>
            )}
          </p>
          </div>
          {/* One row of three; under 18em of width (large text on a phone) the three stack instead. */}
          <dl className="mt-3 grid max-w-md grid-cols-3 divide-x divide-white/25 max-[18em]:grid-cols-1 max-[18em]:gap-3 max-[18em]:divide-x-0 sm:mt-4 md:[grid-area:d]">
            {([["Par", String(hole.par)], ["Yards", String(yards)], ["Stroke index", String(hole.hcp)]] as const).map(([k, v]) => (
              <div key={k} className="min-w-0 px-2.5 first:pl-0 max-[18em]:px-0 sm:px-4">
                <dt className="caps whitespace-nowrap text-[0.62rem] tracking-[0.04em] text-gold sm:text-[0.68rem] sm:tracking-[0.08em]">{k}</dt>
                <dd className="mt-0.5 font-numeral text-[1.9rem] font-semibold leading-none tabular-nums text-on-green">{v}</dd>
                {/* Plain words for the jargon: where the hole ranks, hardest (1) to easiest */}
                {k === "Stroke index" && <dd className="mt-1 whitespace-nowrap text-[0.78rem] leading-tight text-paper-3 max-[18em]:whitespace-normal">{ordinal(hole.hcp)}<span className="max-sm:hidden">-hardest hole</span><span className="sm:hidden"> hardest</span></dd>}
              </div>
            ))}
          </dl>
        </header>


        <div className="mt-5 grid gap-7 sm:mt-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-7">
            <section aria-labelledby="score-h">
              <h2 id="score-h" className={caption}>Your score</h2>
              <div ref={scoreRef} className={group}>
                <ScoreTiles par={hole.par} value={e.strokes} label={`Score for hole ${n}`} holeLabel={`Hole ${n}`} onChange={(v) => { setKeep(false); patch({ strokes: v }); }} />
              </div>
              {/* The putts, clubs, note and the 18-hole card come before the bottom bar in Tab order: a way past them. */}
              <div className="mt-2 empty:hidden"><SkipTo href={`#${nextId}`}>{next ? `Skip to Hole ${next.n}` : round.status === "complete" ? "Skip to Back to card" : "Skip to Finish round"}</SkipTo></div>
            </section>

            {/* Always mounted, so the question is announced when it appears */}
            <div aria-live="polite" className="contents">
            {mismatch && (
              <Callout title={`You logged ${e.shots.length} ${e.shots.length === 1 ? "shot" : "shots"}${e.penalties ? ` and ${e.penalties} penalty` : ""} but scored ${e.strokes}.`}
                action={<div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { patch({ strokes: shotsTotal }); focusScore(); }}>Use {shotsTotal} as my score</Button>
                  <Button size="sm" variant="quiet" onClick={() => { setKeep(true); focusScore(); }}>Keep {e.strokes}</Button>
                </div>}>
                Which is right?
              </Callout>
            )}
            </div>

            <section aria-labelledby="detail-h">
              <h2 id="detail-h" className={caption}>Putts, tee shot, and penalties</h2>
              <div className={cx(group, "grid grid-cols-[minmax(0,1fr)] gap-6 p-0! sm:grid-cols-2 sm:gap-0")}>
                <div className="px-4 pt-4 sm:px-5 sm:py-5">
                  <Stepper label="Putts" value={e.putts} min={0} max={10} start={2} clearable size="lg" unit={{ one: "putt", many: "putts" }} hint="Optional. Counts toward putting and greens stats." onChange={(v) => patch({ putts: v })} />
                  {puttsErr && (
                    <p className="mt-2 flex items-start gap-2 text-[0.95rem] font-medium text-error" aria-live="polite"><ErrorIcon /><span>{puttsErr}</span></p>
                  )}
                </div>
                <div className="border-t border-rule/80 px-4 pb-4 pt-4 sm:border-l sm:border-t-0 sm:px-5 sm:py-5">
                  <Stepper label="Penalty strokes" value={e.penalties} min={0} max={6} size="lg" unit={{ one: "penalty stroke", many: "penalty strokes" }} hint="Already part of your score." onChange={(v) => onPenalties(v ?? 0)} />
                </div>
                {hole.par >= 4 && (
                  <div className="border-t border-rule/80 px-4 pb-4 pt-4 sm:col-span-2 sm:px-5 sm:pb-5">
                    <FairwayPicker legend="Tee shot" value={e.fairway} onChange={(v) => patch({ fairway: v })} />
                  </div>
                )}
              </div>
            </section>

            <section aria-labelledby="clubs-h">
              <h2 id="clubs-h" className={caption}>Clubs, shot by shot <span className="font-sans normal-case tracking-normal">(optional)</span></h2>
              <div className={group}>
                <p className="mb-4 text-[0.95rem] text-ink-2">Tap the club for each shot. On an unscored hole, your score counts itself.</p>
                <ClubPicker bag={store.bag} shots={e.shots} holeLabel={`Hole ${n}`} onChange={onShots} />
              </div>
            </section>

            <div className={group}>
              <Field label="Note for this hole" optional hint="It shows up the next time you play this hole.">
                {(a) => <TextArea {...a} voice rows={2} value={e.note} onChange={(ev) => patch({ note: ev.target.value })} placeholder="Laid up short of the bunker" />}
              </Field>
            </div>
          </div>

          <aside aria-label={`Hole ${n} plan`} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <p className={caption} aria-hidden="true">The hole</p>
            <div className="overflow-hidden rounded-xl border border-rule/70 bg-paper-3 p-3 shadow-card">
              <HoleIllustration hole={{ ...hole, yards }} seed={c.slug} orientation="portrait" detail="full" note={lastNote} className="mx-auto max-h-[70vh] w-full max-w-sm rounded-lg" />
            </div>
            {lastNote && <p className="mt-2 px-1 text-sm text-ink-2">The pencilled note is from your last round here.</p>}
          </aside>
        </div>

        {/* After the entry controls, so Tab reaches the score tiles first */}
        <details className="group mt-8" open>
          <summary className="inline-flex min-h-tap cursor-pointer list-none items-center gap-2 rounded-full bg-tint px-4 text-[0.95rem] font-semibold text-green transition-colors is-hover:bg-tint-2 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 10 16" className="h-3.5 w-2 shrink-0 transition-transform group-open:rotate-90" aria-hidden="true"><path d="M2 2 L8 8 L2 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            The card so far
          </summary>
          <div className="mt-3">
            <ScorecardTable holes={holes} entries={round.entries} currentHole={n} compact caption={`Scorecard, ${c.shortName}`} teeName={round.teeName} onSelectHole={(h) => { swallowStrayTap(); router.push(`/clubhouse/rounds/${round.id}/${h}`); }} />
          </div>
        </details>
      </Page>

      {/* Moving on: an app's bottom action bar, sticky above the phone tab bar, at the bottom on desktop */}
      <div data-obscures className="sticky bottom-[var(--tabbar)] z-30 max-[18em]:static border-t border-rule bg-paper/92 shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)] md:bottom-0">
        {/* Two equal halves on phones, the same width on every hole (Finish round too); one column once large text needs it. */}
        <div className="mx-auto grid max-w-ledger grid-cols-[repeat(auto-fit,minmax(min(100%,8em),1fr))] items-center gap-2.5 px-4 py-2.5 sm:px-6 md:flex md:justify-between md:py-3 lg:px-8">
          {prev ? (
            <ButtonLink href={`/clubhouse/rounds/${round.id}/${prev.n}`} onClick={settle} variant="secondary" size="lg" className={half} icon={<ArrowIcon dir="left" />}>Hole {prev.n}</ButtonLink>
          ) : <span className={half} aria-hidden="true" />}
          {next ? (
            <ButtonLink id={nextId} href={`/clubhouse/rounds/${round.id}/${next.n}`} onClick={settle} variant="primary" size="lg" className={cx(half, "flex-row-reverse md:min-w-60")} icon={<ArrowIcon />}>Hole {next.n}</ButtonLink>
          ) : round.status === "complete" ? (
            <ButtonLink id={nextId} href={`/clubhouse/rounds/${round.id}`} onClick={settle} variant="primary" size="lg" className={cx(half, "md:min-w-60")}>Back to card</ButtonLink>
          ) : (
            <Button id={nextId} variant="primary" size="lg" className={cx(half, "md:min-w-60")} onClick={(ev) => settle(ev) && (missing.length ? setFinishing(true) : finish())}>Finish round</Button>
          )}
        </div>
        <div aria-live="polite">
        {finishing && missing.length > 0 && (
          <div className="mx-auto max-w-ledger px-4 pb-4 sm:px-6 lg:px-8" role="region" aria-label="Unscored holes">
            <Callout title={`${missing.length === 1 ? "Hole" : "Holes"} ${missing.map((h) => h.n).join(", ")} ${missing.length === 1 ? "has" : "have"} no score yet.`}
              action={<div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href={`/clubhouse/rounds/${round.id}/${missing[0].n}`} size="sm" variant="secondary" onClick={() => { swallowStrayTap(); setFinishing(false); }}>Score hole {missing[0].n}</ButtonLink>
                {frontDone && <Button size="sm" variant="secondary" onClick={() => finish(true)}>Finish as the front nine</Button>}
                <ButtonLink href="/clubhouse" size="sm" variant="quiet" onClick={() => swallowStrayTap()}>Save and finish later</ButtonLink>
              </div>}>
              Score every hole to post the card, so it can count toward your handicap.
            </Callout>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

function Missing({ what = "round", roundId }: { what?: "round" | "hole"; roundId?: string }) {
  return (
    <Page>
      <h1 className="font-display text-display-2 text-ink">{what === "round" ? "This round isn't in your journal" : "That hole isn't part of this round"}</h1>
      <p className="mt-4 max-w-measure font-serif text-lede text-ink-2">
        {what === "round" ? "It may have been deleted, or it belongs to another account. Rounds are private to the golfer who played them." : "Pick a hole from the card."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {roundId && <ButtonLink href={`/clubhouse/rounds/${roundId}`} variant="primary">Open the card</ButtonLink>}
        <ButtonLink href="/clubhouse" variant={roundId ? "secondary" : "primary"}>Back to the clubhouse</ButtonLink>
        <ButtonLink href="/clubhouse/rounds" variant="quiet">All cards</ButtonLink>
      </div>
    </Page>
  );
}

/** A descriptive tab title per hole ("Hole 7 · Torrey South · 18 Eagles"); route metadata can't know the hole. */
export function DocTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
    // After a client-side navigation Next writes the route's metadata title a moment later; put this one back.
    const keep = new MutationObserver(() => { if (document.title !== title) document.title = title; });
    keep.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => keep.disconnect();
  }, [title]);
  return null;
}
