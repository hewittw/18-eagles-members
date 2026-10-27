"use client";
import Link from "next/link";
import { useMemo } from "react";
import { PageHeader, TeeSwatch, WeatherGlyph, toParSpoken, toParText } from "@/components/golf";
import { weatherLine } from "@/lib/api/conditions";
import { ButtonLink, Chevron, Icon, Tag, cx } from "@/components/ui";
import { teeOf } from "@/lib/courses";
import { keyOf } from "@/lib/handicap";
import { swallowStrayTap, useClub } from "@/lib/hooks";
import { nextUnplayed } from "@/lib/round-actions";
import { summarize, type RoundSummary } from "@/lib/stats";
import { Page, Placeholder } from "../../_components/Placeholder";

const NINE_LABEL = { "18": "18 holes", front: "Front 9", back: "Back 9" } as const;
const NINE_SPOKEN = { "18": "18 holes", front: "front nine", back: "back nine" } as const;

export function Cards() {
  const { ready } = useClub();
  if (!ready) return <Placeholder label="Fetching your cards" />;
  return <CardsBody />;
}

function CardsBody() {
  const { store, handicap, active, course } = useClub();

  const counting = useMemo(() => {
    const ids = new Set<string>();
    for (const d of handicap.differentials) if (handicap.counting.has(keyOf(d))) d.roundIds.forEach((id) => ids.add(id));
    return ids;
  }, [handicap]);

  // Finished cards, newest first, grouped by month.
  const months = useMemo(() => {
    const done = store.rounds
      .filter((r) => r.status === "complete")
      .sort((a, b) => b.date.localeCompare(a.date) || (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
      .map((r) => summarize(r, store.customCourses))
      .filter((s): s is RoundSummary => !!s);
    const groups: { key: string; label: string; rows: RoundSummary[] }[] = [];
    for (const s of done) {
      const key = s.round.date.slice(0, 7);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: new Date(s.round.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }), rows: [] };
        groups.push(g);
      }
      g.rows.push(s);
    }
    return groups;
  }, [store.rounds, store.customCourses]);

  // Older rounds left unfinished when a new one was started: still saved, still resumable, never lost from view.
  const unfinished = useMemo(
    () => store.rounds
      .filter((r) => r.status === "playing" && r.id !== active?.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => summarize(r, store.customCourses))
      .filter((s): s is RoundSummary => !!s),
    [store.rounds, store.customCourses, active?.id],
  );
  const total = months.reduce((a, g) => a + g.rows.length, 0);
  const activeCourse = active ? course(active.courseSlug) : undefined;

  return (
    <Page className="grid gap-10 md:gap-14">
      <PageHeader
        eyebrow="Every round"
        title="Cards"
        lede={total ? `${total} ${total === 1 ? "card" : "cards"} in the book, newest first. The ones tagged Counts make up your index.` : undefined}
        actions={<ButtonLink href="/clubhouse/rounds/new" size="sm" icon={<Icon name="plus" className="size-5" />} variant={active || !total ? "secondary" : "primary"}>Log a past round</ButtonLink>}
      />

      {active && activeCourse && <InProgress roundId={active.id} courseName={activeCourse.name} next={nextUnplayed(active, activeCourse)} nine={active.holes} holeCount={activeCourse.holes.length} played={Object.values(active.entries).filter((e) => e.strokes != null).length} />}

      {unfinished.length > 0 && (
        <section aria-labelledby="unfinished-h" className="min-w-0 max-w-3xl">
          <div className="flex items-baseline justify-between gap-4 px-1 pb-2.5">
            <h2 id="unfinished-h" className="font-display text-[1.45rem] leading-tight text-ink">Unfinished</h2>
            <p className="caps text-[0.74rem] text-ink-2">Not posted</p>
          </div>
          <ol className="divide-y divide-rule/80 overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card">
            {unfinished.map((s) => <CardRow key={s.round.id} s={s} counts={false} />)}
          </ol>
        </section>
      )}

      {total === 0 ? (
        <section aria-labelledby="empty-h" className="grid justify-items-center gap-5 rounded-2xl border border-rule/70 bg-paper-2 px-5 py-12 text-center shadow-card sm:px-10 sm:py-16">
          <span className="grid size-16 place-items-center rounded-xl bg-tint text-green" aria-hidden="true"><Icon name="cards" className="size-8" /></span>
          <h2 id="empty-h" className="font-display text-title text-ink">Your first card goes here</h2>
          <p className="max-w-measure font-serif text-lede text-ink-2">
            Play a round on the hole screen, or add one you&apos;ve already played. Every card you finish is kept here, with its score, tees, and your note.
          </p>
          <div className="grid w-full max-w-sm gap-2.5 sm:flex sm:max-w-none sm:justify-center">
            {!active && <ButtonLink href="/clubhouse" variant="primary" size="lg" icon={<Icon name="play" />}>Tee off</ButtonLink>}
            <ButtonLink href="/clubhouse/rounds/new" variant="secondary" size="lg" icon={<Icon name="pencil" />}>Log a round</ButtonLink>
          </div>
        </section>
      ) : (
        // One column, newest month first, so the book reads straight down (two columns zigzagged the months).
        <div className="grid max-w-3xl gap-8 lg:gap-10">
          {months.map((g) => (
            <section key={g.key} aria-labelledby={`m-${g.key}`} className="min-w-0">
              <div className="flex items-baseline justify-between gap-4 px-1 pb-2.5">
                <h2 id={`m-${g.key}`} className="font-display text-[1.45rem] leading-tight text-ink">{g.label}</h2>
                <p className="caps text-[0.74rem] text-ink-2">{g.rows.length} {g.rows.length === 1 ? "card" : "cards"}</p>
              </div>
              <ol className="divide-y divide-rule/80 overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card">
                {g.rows.map((s) => <CardRow key={s.round.id} s={s} counts={counting.has(s.round.id)} />)}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function InProgress({ roundId, courseName, next, nine, holeCount, played }: { roundId: string; courseName: string; next: number; nine: "18" | "front" | "back"; holeCount: number; played: number }) {
  const of = holeCount === 9 || nine === "18" ? holeCount : 9;
  const position = nine === "back" && holeCount === 18 ? next - 9 : next;
  return (
    <section aria-labelledby="playing-h" className="tex-locker on-green flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl px-5 py-6 shadow-card sm:px-7">
      <div className="min-w-0">
        <p className="caps text-label text-gold">In progress</p>
        <h2 id="playing-h" className="mt-1 font-display text-title text-on-green">{courseName}</h2>
        <p className="mt-1 font-numeral text-[1.05rem] text-paper-3 tabular-nums">
          {played} of {of} holes scored{nine !== "18" && holeCount === 18 ? ` · ${NINE_SPOKEN[nine]}` : ""}
        </p>
      </div>
      <ButtonLink href={`/clubhouse/rounds/${roundId}/${next}`} onClick={() => swallowStrayTap()} variant="primary" tone="green" size="lg" className="max-sm:w-full">
        Hole {position} of {of} · Resume
      </ButtonLink>
    </section>
  );
}

function CardRow({ s, counts }: { s: RoundSummary; counts: boolean }) {
  const r = s.round;
  const d = new Date(r.date + "T12:00:00");
  const tee = teeOf(s.course, r.teeName);
  const under = s.toPar < 0;
  return (
    <li>
      <Link
        href={`/clubhouse/rounds/${r.id}`}
        onClick={() => swallowStrayTap()}
        className="group/row flex min-h-20 items-center gap-3.5 px-3.5 py-3 transition-colors duration-150 -outline-offset-2 is-hover:bg-paper-3 is-pressed:bg-tint sm:gap-4 sm:px-5"
      >
        <span className="grid w-12 shrink-0 place-items-center rounded-sm bg-paper-3 py-1.5 leading-none" aria-hidden="true">
          <span className="caps text-[0.62rem] text-ink-2">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
          <span className="mt-0.5 font-numeral text-[1.4rem] font-semibold tabular-nums text-ink">{d.getDate()}</span>
        </span>
        {/* The row's name is its visible text, with the short date and score spelled out for screen readers. */}
        <span className="sr-only">{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[1.15rem] leading-snug text-ink">{s.course.shortName}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9rem] text-ink-2">
            <TeeSwatch color={tee.color} name={tee.name} />
            <span aria-hidden="true">·</span>
            <span><span className="sr-only">tees, </span>{s.holes.length === 9 && r.holes === "18" ? "9 holes" : NINE_LABEL[r.holes]}</span>
            {r.mode === "logged" && <><span aria-hidden="true">·</span><span>Logged</span></>}
            {r.weather && <><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1"><WeatherGlyph code={r.weather.code} isDay={!/clear/i.test(r.weather.summary)} className="size-5 text-green" /><span className="sr-only">Played in </span>{weatherLine(r.weather)}</span></>}
            {r.status === "playing" && <Tag className="ml-0.5">Through {s.played} of {s.holes.length}</Tag>}
            {counts && <Tag tone="gold" className="ml-0.5">Counts</Tag>}
          </span>
          {r.note && <span className="mt-1 block truncate font-serif text-[0.98rem] italic text-link">“{r.note}”</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end leading-none" aria-hidden="true">
          <span className="font-numeral text-[1.9rem] font-semibold tabular-nums text-ink">{s.gross}</span>
          <span className={cx("mt-1 font-numeral text-[1rem] font-semibold tabular-nums", under ? "text-under" : "text-ink-2")}>{toParText(s.toPar)}</span>
        </span>
        <span className="sr-only">. Score {s.gross}, {toParSpoken(s.toPar)}{counts ? ". Counts toward your index" : ""}.</span>
        <Chevron className="text-rule-strong transition-transform group-hover/row:translate-x-0.5" />
      </Link>
    </li>
  );
}
