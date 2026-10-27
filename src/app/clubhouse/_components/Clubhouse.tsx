"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BigNumber, HoleIllustration, placeOf, toParText } from "@/components/golf";
import { fmtDate } from "@/components/golf/charts";
import { ActionList, ActionRow, ActionTile, Button, Chevron, ButtonLink, Card, ChoiceGroup, Field, focusInvalid, NumberInput, SectionHeading } from "@/components/ui";
import { defaultHome, holesFor } from "@/lib/courses";
import { formatIndex } from "@/lib/handicap";
import { useClub } from "@/lib/hooks";
import { nextUnplayed } from "@/lib/round-actions";
import { goalTarget, honors as honorsOf, summarize, type RoundSummary } from "@/lib/stats";
import { patchProfile, update } from "@/lib/store";
import type { Goal, Store } from "@/lib/types";
import { parseIndex } from "@/lib/validate";
import { Page, Placeholder } from "./Placeholder";
import { NextChallenge } from "./Challenge";
import { NewGolferShowcase } from "./Showcase";
import { TrophyCase } from "./TrophyCase";
import { BagStep, focusHeading, HomeCourseStep, NameGate, setupStep, SetupSteps } from "./Onboarding";
import { TeeOff } from "./TeeOff";
import { CourseConditions } from "./Conditions";

const GOALS: { value: Goal; label: string }[] = [
  { value: "100", label: "Break 100" },
  { value: "90", label: "Break 90" },
  { value: "80", label: "Break 80" },
  { value: "scratch", label: "Play to scratch" },
];

export function Clubhouse() {
  const { ready, store, handicap, active, course, courses } = useClub();
  const done = useMemo(
    () => store.rounds.filter((r) => r.status === "complete").map((r) => summarize(r, store.customCourses)).filter((s): s is RoundSummary => !!s && s.complete)
      .sort((a, b) => b.round.date.localeCompare(a.round.date) || b.round.createdAt - a.round.createdAt),
    [store.rounds, store.customCourses],
  );

  // Honors not yet celebrated stay on screen for this visit; they're marked seen when the golfer leaves the page.
  const allHonors = useMemo(() => honorsOf(store.rounds, store.customCourses, handicap.history), [store.rounds, store.customCourses, handicap.history]);
  const freshHonors = allHonors.filter((h) => !store.honorsSeen.includes(h.id));
  const freshIds = freshHonors.map((h) => h.id).join(",");
  // Saving the goal turns its question into a short confirmation in the same place (it used to vanish and send
  // focus, and the page, back up to the top).
  const [goalSaved, setGoalSaved] = useState(false);
  useEffect(() => {
    if (!ready) return;
    update((s) => ({ ...s, lastVisit: Date.now() }));
  }, [ready]);
  useEffect(() => {
    if (!ready || !freshIds) return;
    return () => update((s) => ({ ...s, honorsSeen: [...new Set([...s.honorsSeen, ...freshIds.split(",")])] }));
  }, [ready, freshIds]);

  if (!ready) return <Placeholder />;

  const welcomed = store.profile.welcomedAt != null || store.rounds.length > 0;
  const step = setupStep(store);
  const last = done[0];
  const teeCourse = last ? last.course : defaultHome(store.profile.homeCourse, store.customCourses);
  const activeCourse = active ? course(active.courseSlug) : undefined;
  // The very first visit: nothing but the name question.
  // (A screen tall behind the modal, like the placeholder before it, so nothing shifts as it opens.)
  if (!store.profile.name && !welcomed) return <div className="min-h-dvh"><NameGate photo={course("augusta-national")?.hero ?? null} /></div>;
  const lastHere = last && done.find((d) => d.course.slug === teeCourse.slug && d.holes.length === 18);
  const resumeAt = active && activeCourse ? nextUnplayed(active, activeCourse) : null;
  // A round in progress comes first; a golfer with no cards yet sees Tee off before the (empty) trophy case.
  const caseFirst = step === 3 && done.length > 0;
  const caseLast = step === 3 && done.length === 0;

  return (
    <>
      <Hero
        store={store} welcomed={welcomed} step={step} handicap={handicap} done={done}
        live={active && activeCourse && resumeAt != null ? { hole: resumeAt, course: activeCourse.shortName } : null}
        photo={((activeCourse ?? teeCourse).hero ?? course("augusta-national")?.hero) || null}
      />

      <Page className="grid grid-cols-[minmax(0,1fr)] gap-14 md:gap-20">
        {active && activeCourse && resumeAt != null && (
          <section aria-labelledby="in-progress">
            <Card tone="green" padding="lg" className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="caps text-label text-gold">Round in progress</p>
                <h2 id="in-progress" className="mt-1 text-balance font-display text-title text-on-green">{activeCourse.name}</h2>
                <p className="mt-2 font-numeral text-lg text-paper-3">
                  {progressLine(active.entries, holesFor(activeCourse, active.holes))}
                </p>
              </div>
              <ButtonLink href={`/clubhouse/rounds/${active.id}/${resumeAt}`} tone="green" variant="primary" size="lg" className="whitespace-nowrap">
                Resume at hole {resumeAt}
              </ButtonLink>
            </Card>
          </section>
        )}
        {caseFirst && <TrophyCase />}

        {step === 0 && <NewGolferShowcase />}
        {step === 1 && <HomeCourseStep />}
        {step === 2 && <BagStep />}

        {step === 3 && <section aria-labelledby="tee-off" className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0">
            <SectionHeading
              id="tee-off"
              eyebrow={active ? "Not this one?" : last ? "Coming back" : "Your first round · you're set"}
              title={active ? "Start a different round" : lastHere ? `Last time at ${teeCourse.shortName}: ${lastHere.gross}. Beat it.` : `Tee off at ${teeCourse.shortName}`}
              lede={
                active ? (
                  <>Your round in progress stays saved; Resume is at the top of the Clubhouse.</>
                ) : lastHere ? (
                  <>Your best here is {Math.min(...done.filter((d) => d.course.slug === teeCourse.slug && d.holes.length === 18).map((d) => d.gross))}. Your tees are remembered.</>
                ) : (
                  <>Pick your tees and go. On each hole, tap the clubs you hit (they count your score) or just tap the score; putts and notes are optional.</>
                )
              }
            />
            {last?.round.note && (
              <figure className="mt-6 border-l-2 border-link pl-4">
                <blockquote className="font-serif text-lg italic text-link">“{last.round.note}”</blockquote>
                <figcaption className="mt-1 text-sm text-ink-2">Your note from {fmtDate(last.round.date)} at {last.course.shortName}</figcaption>
              </figure>
            )}
            <div className="mt-8">
              {active ? (
                <details className="rounded-xl border border-rule/70 bg-paper-2 p-5 shadow-card">
                  <summary className="flex min-h-tap cursor-pointer items-center font-semibold text-green">Tee off at {teeCourse.shortName} instead</summary>
                  <div className="mt-5"><TeeOff course={teeCourse} rememberedTee={store.profile.lastTee[teeCourse.slug]} label="Start a new round" /></div>
                </details>
              ) : (
                <TeeOff course={teeCourse} rememberedTee={store.profile.lastTee[teeCourse.slug]} />
              )}
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-3" aria-label="Other ways to start">
              <li><ActionTile href="/clubhouse/courses" icon="map" title="Choose another course" detail={`${courses.length} courses`} /></li>
              <li><ActionTile href="/clubhouse/rounds/new" icon="pencil" title="Log a past round" detail="Already played it" /></li>
            </ul>
          </div>
          <div className="grid min-w-0 content-start gap-6">
            <CoursePlate course={teeCourse} />
            <CourseConditions course={teeCourse} />
          </div>
        </section>}

        {step === 3 && <NextChallenge />}

        {step === 3 && (!store.profile.goal || goalSaved) && <GoalQuestion goal={goalSaved ? store.profile.goal : null} onSaved={() => setGoalSaved(true)} />}

        {caseLast && <TrophyCase />}

        {done.length > 0 && (
          <section aria-labelledby="recent">
            <SectionHeading id="recent" eyebrow="The card file" title="Recent cards" action={<ButtonLink href="/clubhouse/rounds" size="sm">See all {done.length}</ButtonLink>} />
            <ActionList className="mt-6" label="Your three most recent cards">
              {done.slice(0, 3).map((d) => (
                <ActionRow
                  key={d.round.id}
                  href={`/clubhouse/rounds/${d.round.id}`}
                  leading={
                    <span className="grid w-12 shrink-0 place-items-center rounded-sm bg-paper-3 py-1.5 leading-none">
                      <span className="caps text-[0.62rem] text-ink-2">{fmtDate(d.round.date, { month: "short" }).split(" ")[0]}</span>
                      <span className="mt-0.5 font-numeral text-xl font-semibold text-ink">{d.round.date.slice(8, 10).replace(/^0/, "")}</span>
                    </span>
                  }
                  title={<span className="font-serif text-lg font-normal">{d.course.shortName}</span>}
                  detail={`${d.round.teeName} tees · ${d.holes.length === 18 ? "18 holes" : d.round.holes === "front" ? "Front 9" : "Back 9"}`}
                  trailing={
                    <span className="flex items-baseline gap-2 font-numeral tabular-nums">
                      <span className="text-2xl font-semibold text-ink sm:text-3xl">{d.gross}</span>
                      <span className={`w-9 text-right text-base ${d.toPar < 0 ? "text-under" : "text-ink-2"}`}>{toParText(d.toPar)}</span>
                    </span>
                  }
                />
              ))}
            </ActionList>
            <ActionList className="mt-4" label="More">
              <ActionRow href="/clubhouse/stats" icon="chart" title="See how you play" detail="Every breakdown, filtered by course and season" />
              <ActionRow href="/clubhouse/locker" icon="bag" title="Your locker" detail="Bag, goal and your saved data" />
            </ActionList>
          </section>
        )}
      </Page>
    </>
  );
}

// ───────────────────────── the hero: the handicap, or the one question ─────────────────────────
function Hero({ store, welcomed, step, handicap, done, photo, live }: { store: Store; welcomed: boolean; step: number; handicap: ReturnType<typeof useClub>["handicap"]; done: RoundSummary[]; photo: { src: string; alt: string; credit: string } | null; live: { hole: number; course: string } | null }) {
  const goal = store.profile.goal;
  const avg18 = done.filter((d) => d.holes.length === 18).slice(0, 5);
  const recentAvg = avg18.length ? avg18.reduce((a, d) => a + d.gross, 0) / avg18.length : null;
  const cardsSoFar = 3 - handicap.roundsToFirst;
  // An odd 9-hole card waits for another nine before it makes one differential.
  const halfWaiting = handicap.roundsToFirst > 0 && done.filter((d) => d.holes.length === 9).length % 2 === 1;

  return (
    <section aria-labelledby="hero-title" className="tex-locker on-green relative isolate overflow-hidden">
      {photo && (
        <>
          <Image src={photo.src} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="-z-20 object-cover" />
          {/* A Masters-green wash, deepest behind the text, so every word keeps its contrast over the photo */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_72_50/0.94)_0%,rgb(0_88_61/0.86)_45%,rgb(0_103_71/0.72)_100%)] max-md:bg-[linear-gradient(180deg,rgb(0_72_50/0.9)_0%,rgb(0_88_61/0.92)_100%)]" />
          <p className="absolute bottom-2 right-3 rounded-xs bg-black/55 px-1.5 py-0.5 text-[0.7rem] text-white">Photo: {photo.credit}</p>
        </>
      )}
      <div className="mx-auto grid max-w-ledger gap-10 px-4 pb-12 pt-10 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:pb-16 md:pt-14 lg:px-8">
        <div className="min-w-0">
          <p className="caps text-balance text-label text-gold">{live ? "Round in progress" : "The Clubhouse"}</p>
          <h1 id="hero-title" className="mt-2 text-balance font-display text-display-2 text-on-green">
            {live
              ? greeting(`Hole ${live.hole} at ${live.course} is waiting`, store.profile.name)
              : greeting(welcomed ? (done.length ? "Welcome back" : step < 3 ? "Let\u2019s set up your locker" : "Your locker is ready") : "Welcome to 18 Eagles", store.profile.name)}
          </h1>
          {welcomed && step < 3 ? (
            <p className="mt-5 max-w-xl font-serif text-lede text-paper-3">
              {step === 1 ? "Pick the course you play most, and it opens ready to play every time." : "Last one: the clubs you carry become your buttons on every hole."}
              {store.profile.enteredIndex != null && <> Your index of {formatIndex(store.profile.enteredIndex)} is saved.</>}
            </p>
          ) : welcomed ? (
            <div className="mt-8">
              {handicap.display != null ? (
                <BigNumber
                  tone="green"
                  label={handicap.source === "computed" ? "Handicap Index" : "Handicap Index · as you entered it"}
                  value={formatIndex(handicap.display)}
                  spoken={`Handicap Index ${formatIndex(handicap.display)}`}
                  sub={<IndexLine handicap={handicap} cardsSoFar={cardsSoFar} />}
                />
              ) : (
                <div>
                  <p className="caps text-label text-gold">Earning your Handicap Index</p>
                  <Tracker n={cardsSoFar} half={halfWaiting} />
                  <p className="mt-4 max-w-md text-pretty font-serif text-lede text-paper-3">
                    {cardsSoFar === 0 ? "Post three 18-hole cards and your index appears here." : `${3 - cardsSoFar} more ${3 - cardsSoFar === 1 ? "card" : "cards"} and your index appears here.`}
                    {" "}{halfWaiting ? "Your 9-hole card is half of one: play another nine to complete it." : "A 9-hole card counts as half: two nines make one."}
                  </p>
                </div>
              )}
              {goal && (
                <p className="mt-6 font-numeral text-lg text-paper-3">
                  <span className="caps mr-2 text-[0.75rem] text-gold">Playing for</span>
                  {GOALS.find((g) => g.value === goal)?.label}
                  {recentAvg != null && (
                    <> · your last {avg18.length} average {recentAvg.toFixed(1)}{toGo(recentAvg, goal) <= 0 ? ", already there" : `, ${toGo(recentAvg, goal).toFixed(1)} strokes to go`}</>
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-5 max-w-xl font-serif text-lede text-paper-3">
              A golf journal that keeps every card and works out your handicap from them. Three quick questions (your index, your course, your bag), then play your first hole.
            </p>
          )}
        </div>
        {!welcomed ? <IndexQuestion /> : step < 3 ? <SetupSteps step={step} homeCourse={store.profile.homeCourse} /> : <MiniBoard done={done} className={live ? "max-md:hidden" : undefined} />}
      </div>
    </section>
  );
}

function IndexLine({ handicap, cardsSoFar }: { handicap: ReturnType<typeof useClub>["handicap"]; cardsSoFar: number }) {
  if (handicap.source === "entered") {
    return <p>Calculated from your own cards after three rounds · {cardsSoFar} of 3 posted</p>;
  }
  const ch = handicap.change;
  const last = handicap.history[handicap.history.length - 1];
  return (
    <div className="grid gap-1">
      <p>
        {ch == null ? "Your first calculated index" : ch === 0 ? "No change" : ch < 0 ? `Down ${Math.abs(ch).toFixed(1)}` : `Up ${ch.toFixed(1)}`}
        {last && <> since {fmtDate(last.date)}</>}
        {handicap.low && <> · Low {formatIndex(handicap.low.value)} ({fmtDate(handicap.low.date)})</>}
      </p>
      {handicap.nextToDrop && (
        <p className="text-paper-3/90">
          Your next card replaces the {handicap.nextToDrop.gross} at {handicap.nextToDrop.courseName} from {fmtDate(handicap.nextToDrop.date)}
          {handicap.nextToDropCounts ? ", one that counts" : ""}.
        </p>
      )}
    </div>
  );
}

function Tracker({ n, half }: { n: number; half?: boolean }) {
  return (
    <ol className="mt-3 flex gap-2" aria-label={`${n} of 3 cards posted${half ? ", and half of the next one: a 9-hole card" : ""}`}>
      {[0, 1, 2].map((i) => {
        const halfHere = half && i === n;
        return (
          <li
            key={i}
            className={`grid size-16 place-items-center rounded-xs border font-numeral text-3xl font-semibold ${i < n ? "border-gold bg-gold text-green-3" : halfHere ? "border-gold bg-[linear-gradient(90deg,var(--color-gold)_50%,transparent_50%)] text-green-3" : "border-gold/60 text-gold"}`}
            aria-hidden="true"
          >
            {halfHere ? <span className="rounded-xs bg-green-3 px-1 text-xl text-gold">½</span> : i + 1}
          </li>
        );
      })}
    </ol>
  );
}

/** The first visit's one question, asked in the hero itself (no wizard, no tour). */
function IndexQuestion() {
  const { store } = useClub();
  // Coming back with "Back to your index" shows what was typed before.
  const [raw, setRaw] = useState(store.profile.enteredIndex != null ? formatIndex(store.profile.enteredIndex) : "");
  const [error, setError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = parseIndex(raw);
    if (r.error) {
      setError(r.error);
      focusInvalid(input.current);
      return;
    }
    patchProfile({ enteredIndex: r.value, welcomedAt: Date.now() });
    focusHeading("setup-home", "setup-bag", "tee-off");
  };
  return (
    <Card padding="lg" className="w-full max-w-md justify-self-start md:justify-self-end">
      <form onSubmit={submit} noValidate className="grid gap-5">
        <div>
          <p className="caps text-label text-gold-ink">Step 1 of 3</p>
          <h2 id="index-q" className="mt-1 font-serif text-xl font-bold text-ink">Do you have a Handicap Index?</h2>
          <p className="mt-1 text-ink-2">We&apos;ll use it until your own cards take over.</p>
        </div>
        <Field label="Your Handicap Index" hint="About how many strokes over par you usually shoot, from your GHIN or club card. Like 12.4; a plus handicap is written +1.2." error={error}>
          {(a) => <NumberInput ref={input} decimal inputMode="text" pattern={undefined} {...a} value={raw} onChange={(e) => { setRaw(e.target.value); if (error) setError(undefined); }} autoComplete="off" enterKeyHint="done" className="max-w-[10rem]" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" block>Use this index</Button>
        <div className="border-t border-rule pt-4">
          <Button type="button" variant="secondary" block onClick={() => { patchProfile({ enteredIndex: null, welcomedAt: Date.now() }); focusHeading("setup-home", "setup-bag", "tee-off"); }}>
            Not yet: I&apos;ll earn one
          </Button>
          <p className="mt-2 text-center text-sm text-ink-2">It takes three cards. Your first can be today.</p>
        </div>
      </form>
    </Card>
  );
}

function GoalQuestion({ goal, onSaved }: { goal: Goal | null; onSaved: () => void }) {
  const saved = useRef<HTMLHeadingElement>(null);
  // Focus the confirmation where the question was, without scrolling: the golfer stays where they are.
  useEffect(() => { if (goal) saved.current?.focus({ preventScroll: true }); }, [goal]);
  // Held locally until saved, so arrow keys can move through the choices without committing the first one.
  const [g, setG] = useState<Goal | null>(null);
  // Never a disabled button with no reason: Save stays enabled and says what's missing next to the choices.
  const [error, setError] = useState<string | undefined>();
  if (goal) {
    return (
      <section aria-labelledby="goal-saved" className="max-w-2xl rounded-xl border border-rule/70 bg-paper-2 p-5 shadow-card sm:p-6 motion-safe:animate-fade">
        <p className="caps text-label text-gold-ink">Goal saved</p>
        <h2 id="goal-saved" ref={saved} tabIndex={-1} className="mt-1 font-serif text-xl font-bold text-ink outline-none">{GOALS.find((x) => x.value === goal)?.label}</h2>
        <p className="mt-1 text-ink-2">Your stats measure against it from now on. Change it anytime in the <Link href="/clubhouse/locker" className="link">Locker</Link>.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="goal-q">
      <SectionHeading id="goal-q" eyebrow="Optional" title="What are you playing for?" lede="Your stats will measure against it. Change it anytime in the Locker." />
      <div className="mt-6 max-w-2xl">
        <ChoiceGroup legend="Your goal" hideLegend layout="grid" size="lg" value={g} onChange={(v) => { setG(v); setError(undefined); }} options={GOALS} error={error} name="goal-q" />
        <Button variant="primary" size="md" className="mt-4" onClick={() => {
          if (!g) { setError("Choose a goal first. It's optional: you can leave this and set one in the Locker."); focusInvalid(document.querySelector<HTMLElement>("input[name=goal-q]")); return; }
          patchProfile({ goal: g }); onSaved();
        }}>
          Save my goal
        </Button>
      </div>
    </section>
  );
}

/** The last few cards as hung leaderboard tiles, or the first card's place on the board. */
function MiniBoard({ done, className }: { done: RoundSummary[]; className?: string }) {
  const recent = done.slice(0, 5).reverse();
  if (!recent.length) {
    return (
      <div className={`justify-self-start rounded-xs border border-gold/40 p-5 md:justify-self-end ${className ?? ""}`}>
        <p className="caps text-label text-gold">The board</p>
        <p className="mt-2 max-w-xs font-serif text-paper-3">Your first card hangs here, hole by hole, the way the old scoreboards did it.</p>
      </div>
    );
  }
  return (
    <div className={`min-w-0 max-md:w-full md:justify-self-end ${className ?? ""}`}>
      <p className="caps text-label text-gold">Last {recent.length} {recent.length === 1 ? "card" : "cards"}</p>
      <ol className="mt-3 grid grid-cols-5 gap-2 md:flex md:gap-1.5">
        {recent.map((d, i) => (
          <li key={d.round.id} className="hang" style={{ ["--i" as string]: i }}>
            <Link href={`/clubhouse/rounds/${d.round.id}`} className="tile grid w-full place-items-center gap-0.5 rounded-xs px-1 pb-1.5 pt-2 text-ink is-hover:border-ink md:w-16" aria-label={`${d.gross} ${toParText(d.toPar)} ${fmtDate(d.round.date, { month: "short" })}: ${d.course.shortName}, ${fmtDate(d.round.date)}`}>
              <span className="font-numeral text-2xl font-semibold tabular-nums sm:text-3xl">{d.gross}</span>{" "}
              <span className={`font-numeral text-sm tabular-nums ${d.toPar < 0 ? "text-under" : "text-green"}`}>{toParText(d.toPar)}</span>{" "}
              <span className="caps text-[0.6rem] text-ink-2">{fmtDate(d.round.date, { month: "short" })}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CoursePlate({ course }: { course: NonNullable<ReturnType<ReturnType<typeof useClub>["course"]>> }) {
  const sig = course.holes.find((h) => h.n === course.signatureHole) ?? course.holes[0];
  return (
    <Link href={`/clubhouse/courses/${course.slug}`} className="group/plate block min-w-0 self-start overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card transition-transform is-pressed:scale-[0.99]">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-rule bg-paper-3">
        {course.hero ? (
          <Image src={course.hero.src} alt={course.hero.alt} fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
        ) : (
          <HoleIllustration hole={sig} seed={course.slug} orientation="landscape" detail="plain" className="h-full w-full" decorative />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-4 p-4">
        <span className="min-w-0">
          <span className="block text-balance font-serif text-lg text-ink">{course.name}</span>
          <span className="block text-sm text-ink-2">{placeOf(course)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3 font-numeral text-ink-2 tabular-nums">Par {course.tees[0].par}<Chevron className="text-rule-strong" /></span>
      </div>
      {course.hero && <p className="px-4 pb-3 text-xs text-ink-2">Photo: {course.hero.credit}, {course.hero.license}</p>}
    </Link>
  );
}

/** "Welcome back, Hewitt." (or just "Welcome back." before there's a name). */
const greeting = (text: string, name: string | null) => (name ? `${text}, ${name}.` : `${text}.`);

/** Strokes from a recent average to the goal: "Break 90" means 89 or better; scratch means par 72. */
const toGo = (avg: number, g: Goal) => avg - (g === "scratch" ? goalTarget[g] : goalTarget[g] - 1);

function progressLine(entries: Store["rounds"][number]["entries"], holes: { n: number; par: number }[]) {
  const played = holes.filter((h) => entries[h.n]?.strokes != null);
  if (!played.length) return `Hole 1 of ${holes.length} · not started`;
  const toPar = played.reduce((a, h) => a + (entries[h.n]!.strokes! - h.par), 0);
  return `Through ${played.length} of ${holes.length} · ${toParText(toPar)}`;
}

