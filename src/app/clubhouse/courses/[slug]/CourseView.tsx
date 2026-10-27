"use client";
import Image from "next/image";
import { useEffect } from "react";
import { HoleIllustration, PageHeader, ScorecardTable, TeeSwatch, placeOf } from "@/components/golf";
import { ActionList, ActionRow, ButtonLink, Callout, Card, SectionHeading } from "@/components/ui";
import type { CourseImage } from "@/lib/course-types";
import { useClub } from "@/lib/hooks";
import { nextUnplayed } from "@/lib/round-actions";
import { Page, Placeholder } from "../../_components/Placeholder";
import { TeeOff } from "../../_components/TeeOff";
import { CourseConditions, CourseFacts, CourseForecast } from "../../_components/Conditions";
import { formatDay, recordAt } from "../_lib/record";

const ACCESS = { public: "Public", resort: "Resort (guests and the public)", private: "Private (members and guests)" } as const;

export function CourseView({ slug }: { slug: string }) {
  const { ready, store, active, course } = useClub();
  const c = course(slug);

  // Custom courses aren't known on the server, so their title is set here.
  useEffect(() => {
    if (ready) document.title = `${c ? c.name : "Course not found"} · 18 Eagles`;
  }, [ready, c]);

  if (!ready) return <Placeholder label="Opening the course book" />;
  if (!c) return <NotFound slug={slug} />;

  const back = c.tees[0];
  const sig = c.holes.find((h) => h.n === c.signatureHole) ?? c.holes[0];
  const rec = recordAt(c.slug, store.rounds, store.customCourses);
  const activeCourse = active ? course(active.courseSlug) : undefined;
  const estimated = c.tees.filter((t) => t.source === "estimated");
  const photos = [c.hero, ...c.gallery].filter((p): p is CourseImage => !!p);

  const facts: [string, string][] = [
    ["Par", String(back.par)],
    ["Yards", `${back.yards.toLocaleString("en-US")} from the ${back.name}`],
    ...(c.architect ? [["Architect", c.architect] as [string, string]] : []),
    ...(c.established ? [["Established", String(c.established)] as [string, string]] : []),
    ["Access", c.tags.includes("yours") ? "Added by you" : ACCESS[c.access]],
    ["Holes", String(c.holes.length)],
  ];

  return (
    <Page>
      <PageHeader back={{ href: "/clubhouse/courses", label: "Courses" }} eyebrow={placeOf(c)} title={c.name} lede={c.blurb} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)] lg:gap-10">
        {/* The hero: the photograph, or a drawing of the signature hole */}
        <div className="min-w-0">
          <figure className="min-w-0 overflow-hidden rounded-2xl border border-rule/70 bg-paper-2 shadow-card">
            {c.hero ? (
              <div className="relative aspect-[3/2] overflow-hidden bg-paper-3">
                <Image src={c.hero.src} alt={c.hero.alt} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
              </div>
            ) : (
              <HoleIllustration hole={sig} seed={c.slug} orientation="landscape" className="block h-auto w-full" />
            )}
            <figcaption className="caps flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-[0.72rem] text-ink-2">
              <span>
                {c.hero ? `${c.shortName} · photograph` : `Hole ${sig.n}${sig.name ? ` · ${sig.name}` : ""} · drawn, not surveyed`}
              </span>
              <span className="text-ink">{c.hero ? `${c.hero.credit} · ${c.hero.license}` : `Par ${sig.par} · ${sig.yards} yds`}</span>
            </figcaption>
          </figure>

          {c.gallery.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" role="list" aria-label="More photographs">
              {c.gallery.map((g) => (
                <li key={g.src} className="min-w-0">
                  <figure className="overflow-hidden rounded-lg border border-rule/70 bg-paper-2">
                    <div className="relative aspect-[4/3] overflow-hidden bg-paper-3">
                      <Image src={g.src} alt={g.alt} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover" />
                    </div>
                  </figure>
                </li>
              ))}
            </ul>
          )}

          <p className="caps mt-8 px-1 text-label text-ink-2">About the course</p>
          <dl className="mt-2 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-rule/70 bg-rule/70 shadow-card sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex min-h-13 items-baseline justify-between gap-4 bg-paper-2 px-4 py-3">
                <dt className="shrink-0 text-ink">{k}</dt>
                <dd className="min-w-0 text-right text-ink-2">{v}</dd>
              </div>
            ))}
            {facts.length % 2 === 1 && <div aria-hidden="true" className="hidden bg-paper-2 sm:block" />}
          </dl>
        </div>

        {/* Your record, and the start */}
        <div className="grid min-w-0 content-start gap-6">
          <section aria-labelledby="record-h">
            <SectionHeading id="record-h" title="Your record here" level={2} />
            {rec.rounds === 0 ? (
              <p className="mt-3 font-serif text-lede text-ink-2">Your first round here. The card below is ready when you are.</p>
            ) : (
              <>
                <dl className="mt-4 grid grid-cols-3 divide-x divide-rule/80 overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card">
                  <Stat label="Rounds" value={String(rec.rounds)} />
                  <Stat label="Best" value={rec.best != null ? String(rec.best) : rec.bestNine != null ? `${rec.bestNine}` : "—"} sub={rec.best == null && rec.bestNine != null ? "for 9" : undefined} />
                  <Stat label="Average" value={rec.average != null ? rec.average.toFixed(1) : "—"} sub={rec.average == null ? "18 holes" : undefined} />
                </dl>
                {rec.last && (
                  <ActionList className="mt-3" label="Your last card here">
                    <ActionRow
                      href={`/clubhouse/rounds/${rec.last.id}`}
                      icon="cards"
                      title={`Last time · ${formatDay(rec.last.date)}`}
                      detail={rec.last.note ? <span className="font-serif italic">“{rec.last.note}”</span> : "No note on that card"}
                    />
                  </ActionList>
                )}
              </>
            )}
          </section>

          <Card as="section" aria-labelledby="teeoff-h" padding="md">
            <h2 id="teeoff-h" className="font-display text-title text-ink">Tee off</h2>
            <p className="mt-1 text-[0.95rem] text-ink-2">Choose your tees, then score as you play. Every tap is saved.</p>
            {active && (
              <Callout
                className="mt-4"
                title={active.courseSlug === c.slug ? "You have a round going here" : "A round is already in progress"}
                action={
                  activeCourse && (
                    <ButtonLink href={`/clubhouse/rounds/${active.id}/${nextUnplayed(active, activeCourse)}`} variant="secondary" size="sm">
                      Resume at hole {nextUnplayed(active, activeCourse)}
                    </ButtonLink>
                  )
                }
              >
                {active.courseSlug === c.slug ? "Pick up where you left off, or start a new card below." : `You started a card at ${activeCourse?.shortName ?? "another course"} on ${formatDay(active.date)}.`}
              </Callout>
            )}
            <div className="mt-5">
              <TeeOff course={c} rememberedTee={store.profile.lastTee[c.slug]} />
            </div>
          </Card>

          <CourseConditions course={c} />
        </div>
      </div>

      {/* Outside data: the week's weather and OpenGolfAPI's facts (each hides itself when there's nothing to ask) */}
      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
        <CourseForecast course={c} />
        <CourseFacts course={c} />
      </div>

      <section aria-labelledby="card-h" className="mt-14">
        <SectionHeading id="card-h" title="The card" eyebrow={`${c.holes.length} holes · par ${back.par}`} lede={`Yards from the ${back.name} tees, the longest. Your score goes in the bottom row as you play.`} />
        <div className="mt-5">
          <ScorecardTable holes={c.holes} entries={{}} teeName={back.name} caption={`${c.name} scorecard`} />
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem] text-ink" role="list" aria-label="Tees">
          {c.tees.map((t) => (
            <li key={t.name}>
              <TeeSwatch color={t.color} name={t.name} meta={`${t.yards.toLocaleString("en-US")} yds · ${t.rating.toFixed(1)}/${t.slope}${t.source === "estimated" ? " est." : ""}`} />
            </li>
          ))}
        </ul>
      </section>

      <details className="group mt-10 max-w-measure overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold text-ink -outline-offset-2 is-hover:bg-paper-3 sm:px-5 [&::-webkit-details-marker]:hidden">
          About this data
          <svg viewBox="0 0 10 16" className="h-4 w-2.5 shrink-0 text-rule-strong transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true"><path d="M2 2 L8 8 L2 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        <div className="grid gap-4 border-t border-rule/80 px-4 pb-5 pt-4 text-[0.95rem] leading-relaxed text-ink-2 sm:px-5">
          <p>{c.dataNotes}</p>
          {estimated.length > 0 && (
            <p>
              <strong className="font-medium text-ink">Estimated ratings:</strong> {estimated.map((t) => `${t.name} (${t.rating.toFixed(1)} / ${t.slope})`).join(", ")}. No published rating exists for{" "}
              {estimated.length === 1 ? "this tee" : "these tees"}, so the numbers are our estimate.
            </p>
          )}
          {photos.length > 0 && (
            <div>
              <p className="font-medium text-ink">Photographs</p>
              <ul className="mt-1 grid gap-1" role="list">
                {photos.map((p) => (
                  <li key={p.src}>
                    {p.credit}, {p.license}.{" "}
                    <a className="link inline-flex min-h-6 items-center" href={p.sourceUrl} target="_blank" rel="noreferrer">Source<span className="sr-only"> for the photo by {p.credit} (opens in a new tab)</span></a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.sources.length > 0 && (
            <div>
              <p className="font-medium text-ink">Sources</p>
              <ul className="mt-1 grid gap-1" role="list">
                {c.sources.map((s) => (
                  <li key={s} className="min-w-0 break-words">
                    <a className="link inline-flex min-h-6 items-center" href={s} target="_blank" rel="noreferrer">{s.replace(/^https?:\/\/(www\.)?/, "")}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </Page>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-2 py-3.5 text-center">
      <dt className="caps text-label text-ink-2">{label}</dt>
      <dd className="mt-1 font-numeral text-[2.2rem] font-semibold leading-none tabular-nums text-ink">
        {value}
        {sub && <span className="block pt-1 text-[0.8rem] font-medium tracking-wide text-ink-2">{sub}</span>}
      </dd>
    </div>
  );
}

function NotFound({ slug }: { slug: string }) {
  const custom = slug.startsWith("custom-");
  return (
    <Page>
      <PageHeader back={{ href: "/clubhouse/courses", label: "Courses" }} eyebrow="Course book" title="Course not found" />
      <div className="mt-6 max-w-measure">
        <p className="font-serif text-lede text-ink-2">
          {custom
            ? "That course was added on another device, or the data here was erased. Courses you add are saved in this browser only."
            : "There's no course at this address. It may have been renamed."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/clubhouse/courses" variant="primary">See every course</ButtonLink>
          <ButtonLink href="/clubhouse/courses/new" variant="secondary">Add a course</ButtonLink>
        </div>
      </div>
    </Page>
  );
}

