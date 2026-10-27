"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { ApiCredit, BigNumber, PageHeader, ScorecardTable, WeatherGlyph, scoreShort, toParText } from "@/components/golf";
import { weatherLine, weatherSpoken } from "@/lib/api/conditions";
import { fmtDate } from "@/components/golf/charts";
import { Button, ButtonLink, Callout, Field, SectionHeading, TextArea, useToast } from "@/components/ui";
import type { Course, Hole } from "@/lib/course-types";
import { teeOf, yardsAt } from "@/lib/courses";
import { formatIndex, keyOf } from "@/lib/handicap";
import { swallowStrayTap, useClub } from "@/lib/hooks";
import { deleteRound, nextUnplayed, setRoundNote } from "@/lib/round-actions";
import { honors as honorsOf, summarize, type RoundSummary } from "@/lib/stats";
import type { Round, RoundWeather } from "@/lib/types";
import { useVerdict, VerdictMark } from "../../_components/Challenge";
import { Page, Placeholder } from "../../_components/Placeholder";
import { DocTitle } from "./[hole]/HoleScreen";

export function RoundCard({ id }: { id: string }) {
  const { ready, store, course, handicap } = useClub();
  const router = useRouter();
  const toast = useToast();
  const round = store.rounds.find((r) => r.id === id);
  const c = round ? course(round.courseSlug) : undefined;
  const s = useMemo(() => (round && c ? summarize(round, store.customCourses) : null), [round, c, store.customCourses]);
  const story = useMemo(() => (s && round ? tell(s, store.rounds, store.customCourses) : []), [s, round, store.rounds, store.customCourses]);
  const verdict = useVerdict(id);
  const deleting = useRef(false); // a second tap must not "delete" again and replace the toast with an empty Undo
  useEffect(() => { deleting.current = false; }, []); // also when the router reshows this card after an Undo

  if (!ready) return <Placeholder label="Fetching the card" />;
  if (!round || !c || !s) return <Gone />;

  const diff = handicap.differentials.find((d) => d.roundIds.includes(round.id));
  const counts = diff ? handicap.counting.has(keyOf(diff)) : false;
  const isLatest = diff && handicap.differentials[0] && keyOf(handicap.differentials[0]) === keyOf(diff);
  const earned = honorsOf(store.rounds, store.customCourses, handicap.history).filter((h) => h.roundId === round.id);
  const playing = round.status === "playing";
  const nineLabel = round.holes === "18" ? `${s.holes.length} holes` : round.holes === "front" ? "Front nine" : "Back nine";
  // The yards row names the tees played, so show that tee's yards (the course lists the first tee's).
  const tee = teeOf(c, round.teeName);
  const cardHoles = s.holes.map((h) => ({ ...h, yards: yardsAt(c, tee, h) }));

  const remove = () => {
    if (deleting.current) return;
    deleting.current = true;
    swallowStrayTap();
    const undo = deleteRound(round.id);
    toast({ message: `Deleted the card from ${c.shortName}`, action: { label: "Undo", onClick: undo }, duration: 8000 });
    router.push("/clubhouse/rounds");
  };

  return (
    <Page className="grid gap-10 md:gap-14">
      <DocTitle title={`${c.shortName}, ${fmtDate(round.date)}: ${round.totalOnly ?? s.gross} · 18 Eagles`} />
      <PageHeader
        back={{ href: "/clubhouse/rounds", label: "Cards" }}
        eyebrow={`${fmtDate(round.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${round.teeName} tees · ${nineLabel}`}
        title={c.name}
        lede={
          round.mode === "logged" ? (round.totalOnly != null ? "Logged after the round, as a total score." : "Logged after the round, hole by hole.")
            : round.weather ? <PlayedIn w={round.weather} /> : undefined
        }
        actions={<ButtonLink href={`/clubhouse/courses/${c.slug}`} variant="secondary">Play here again</ButtonLink>}
      />

      {playing && (
        <Callout title={`In progress: through ${s.played} of ${s.holes.length}`} action={<div className="mt-3"><ButtonLink href={`/clubhouse/rounds/${round.id}/${nextUnplayed(round, c)}`} variant="primary">Resume at hole {nextUnplayed(round, c)}</ButtonLink></div>}>
          The card below is what you&apos;ve scored so far. Finish the last hole to post it.
        </Callout>
      )}

      <section aria-labelledby="totals" className="tex-locker on-green grid gap-7 rounded-2xl px-5 py-7 shadow-card sm:px-8 sm:py-8 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
        <h2 id="totals" className="sr-only">Totals</h2>
        <BigNumber tone="green" face="numeral" label={playing ? "So far" : "Total"} value={String(s.gross)} spoken={`${s.gross} strokes, ${toParText(s.toPar)} to par`} sub={<span className={s.toPar < 0 ? "text-[#f0b3a8]" : ""}>{toParText(s.toPar)} · par {s.par}</span>} />
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Out", s.front != null ? String(s.front) : "—"],
            ["In", s.back != null ? String(s.back) : "—"],
            [s.putts != null && s.puttHoles < s.played ? `Putts · ${s.puttHoles} holes` : "Putts", s.putts != null ? String(s.putts) : "—"],
            ["Greens", s.girHoles ? `${s.gir} of ${s.girHoles}` : "—"],
            ["Fairways", s.fairwayHoles ? `${s.fairways} of ${s.fairwayHoles}` : "—"],
            ["Penalties", round.totalOnly != null ? "—" : String(s.penalties)],
            ["Birdies or better", round.totalOnly != null ? "—" : String(s.types.birdie + s.types.eagle + s.types.albatross)],
            ["Differential", diff ? diff.value.toFixed(1) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-lg bg-black/15 px-3.5 py-3">
              <dt className="caps truncate text-[0.68rem] text-gold">{k}</dt>
              <dd className="mt-1 font-numeral text-[1.75rem] font-semibold leading-none tabular-nums text-on-green">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {story.length > 0 && (
        <section aria-labelledby="story" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-8">
          <div>
            <SectionHeading id="story" eyebrow="Attested" title="The story of the round" />
            <ul className="mt-5 divide-y divide-rule/80 overflow-hidden rounded-xl border border-rule/70 bg-paper-2 font-serif text-[1.1rem] leading-snug text-ink shadow-card">
              {story.map((line) => (
                <li key={line} className="flex items-start gap-3.5 px-4 py-3.5 sm:px-5">
                  <span aria-hidden="true" className="mt-[0.45em] size-2 shrink-0 rounded-full bg-green" />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-4">
            {!diff && handicap.pendingNine === round.id && (
              <div className="rounded-xl border border-rule/70 bg-paper-2 p-5 shadow-card">
                <p className="caps text-label text-gold-ink">Toward your index</p>
                <p className="mt-2 text-ink">A 9-hole card counts in pairs: your next 9-hole card joins this one to make one 18-hole differential.</p>
              </div>
            )}
            {diff && (
              <div className="rounded-xl border border-rule/70 bg-paper-2 p-5 shadow-card">
                <p className="caps text-label text-gold-ink">Toward your index</p>
                <p className="mt-2 text-ink">
                  Score differential <strong className="font-numeral text-xl tabular-nums">{diff.value.toFixed(1)}</strong>
                  {diff.adjusted !== diff.gross && <> (adjusted gross {diff.adjusted}: holes capped at net double bogey)</>}.{" "}
                  {counts ? "It counts: one of the best that make up your index." : handicap.index != null ? "It doesn't count right now; better cards make up your index." : `${handicap.roundsToFirst} more ${handicap.roundsToFirst === 1 ? "card" : "cards"} to your first index.`}
                </p>
                {isLatest && handicap.change != null && handicap.history.length >= 2 && (
                  <p className="mt-2 text-ink-2">
                    {handicap.change === 0
                      ? `Your index held at ${formatIndex(handicap.history[handicap.history.length - 1].index)}.`
                      : `Your index moved ${formatIndex(handicap.history[handicap.history.length - 2].index)} → ${formatIndex(handicap.history[handicap.history.length - 1].index)}.`}
                  </p>
                )}
              </div>
            )}
            {verdict && (
              <div className="rounded-xl border border-rule/70 bg-paper-2 p-5 shadow-card">
                <p className="caps text-label text-gold-ink">The challenge</p>
                <p className="mt-1 font-display text-xl leading-snug text-ink">{verdict.challenge.title}</p>
                <p className="mt-3 flex items-start gap-3 text-ink">
                  <VerdictMark status={verdict.status} size="sm" tone="paper" />
                  <span className="min-w-0">
                    <strong className="font-semibold">{verdict.status === "met" ? "Met" : verdict.status === "missed" ? "Missed" : "Skipped"}:</strong> {verdict.text}.
                  </span>
                </p>
              </div>
            )}
            {earned.length > 0 && (
              <ul className="flex flex-wrap gap-3" aria-label="Honors from this round">
                {earned.map((h) => (
                  <li key={h.id} className="brass-plate rounded-lg px-5 py-3">
                    <p className="font-display text-xl leading-tight">{h.title}</p>
                    <p className="caps mt-1 text-[0.72rem]">{h.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {round.totalOnly == null && (
        <section aria-labelledby="card-h" className="min-w-0">
          <SectionHeading id="card-h" eyebrow="Hole by hole" title="The card" lede="Select a hole number to change it." />
          <div className="mt-6">
            <ScorecardTable holes={cardHoles} entries={round.entries} teeName={round.teeName} caption={`Scorecard, ${c.shortName}, ${fmtDate(round.date)}`} onSelectHole={(n) => { swallowStrayTap(); router.push(`/clubhouse/rounds/${round.id}/${n}`); }} />
          </div>
        </section>
      )}

      <section aria-labelledby="note-h" className="max-w-2xl">
        <SectionHeading id="note-h" title="Your note on the round" level={2} />
        <div className="mt-4 rounded-xl border border-rule/70 bg-paper-2 p-4 shadow-card sm:p-5">
          <Field label="Note" optional hideLabel hint="It shows on the clubhouse the next time you play.">
            {(a) => <TextArea {...a} voice rows={3} value={round.note} onChange={(e) => setRoundNote(round.id, e.target.value)} placeholder="Lag putting was the difference." />}
          </Field>
        </div>
      </section>

      <section aria-labelledby="manage" className="max-w-2xl">
        <h2 id="manage" className="sr-only">Manage this card</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-rule/70 bg-paper-2 p-4 shadow-card sm:p-5">
          <Button variant="danger" onClick={remove}>Delete this card</Button>
          <p className="text-sm text-ink-2">You&apos;ll have a few seconds to undo.</p>
        </div>
      </section>
    </Page>
  );
}

/** A few plain sentences about the round, in the order a golfer would tell it. */
function tell(s: RoundSummary, rounds: Round[], custom: Course[]): string[] {
  const out: string[] = [];
  const r = s.round;
  const e = (h: Hole) => r.entries[h.n]?.strokes;
  if (r.totalOnly == null && s.played) {
    if (s.front != null && s.back != null) out.push(`Out in ${s.front}, back in ${s.back}${s.back < s.front ? ", stronger coming home" : s.back > s.front ? "" : ", even halves"}.`);
    const unders = s.holes.filter((h) => e(h) != null && e(h)! < h.par);
    if (unders.length) out.push(`${unders.map((h) => scoreShort(e(h)!, h.par)).every((x) => x === "Birdie") ? (unders.length === 1 ? "A birdie" : "Birdies") : "Under par"} on ${list(unders.map((h) => (h.name ? `${h.n} (${h.name})` : String(h.n))))}.`);
    // the best stretch of par or better
    let best: Hole[] = [], run: Hole[] = [];
    for (const h of s.holes) { if (e(h) != null && e(h)! <= h.par) { run = [...run, h]; if (run.length > best.length) best = run; } else run = []; }
    if (best.length >= 3) out.push(`Par or better on ${best[0].n} through ${best[best.length - 1].n}: ${best.length} in a row.`);
    const worst = [...s.holes].filter((h) => e(h) != null).sort((a, b) => e(b)! - b.par - (e(a)! - a.par))[0];
    if (worst && e(worst)! - worst.par >= 2) out.push(`The ${ordinal(worst.n)}${worst.name ? `, ${worst.name},` : ""} cost the most: ${e(worst)} on a par ${worst.par}.`);
    if (s.putts != null && s.puttHoles === s.played) {
      const threes = s.holes.filter((h) => (r.entries[h.n]?.putts ?? 0) >= 3).length;
      out.push(`${s.putts} putts${threes ? `, with ${threes} three-putt${threes > 1 ? "s" : ""}` : ", no three-putts"}.`);
    }
  }
  if (r.status === "complete") {
    const before = rounds
      .filter((x) => x.id !== r.id && x.status === "complete" && x.courseSlug === r.courseSlug && x.holes === r.holes && (x.date < r.date || (x.date === r.date && x.createdAt < r.createdAt)))
      .map((x) => summarize(x, custom)).filter((x): x is RoundSummary => !!x && x.complete)
      .sort((a, b) => b.round.date.localeCompare(a.round.date));
    if (before[0]) {
      const d = s.gross - before[0].gross;
      out.push(d === 0 ? `The same score as last time here (${fmtDate(before[0].round.date)}).` : `${Math.abs(d)} ${Math.abs(d) === 1 ? "stroke" : "strokes"} ${d < 0 ? "better" : "more"} than last time here (${before[0].gross} on ${fmtDate(before[0].round.date)}).`);
      const best = Math.min(...before.map((b) => b.gross));
      if (s.gross < best) out.push(`A new best at ${s.course.shortName}, beating your ${best}.`);
    } else out.push(`Your first card at ${s.course.shortName}.`);
  }
  return out;
}

const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

function Gone() {
  return (
    <Page>
      <h1 className="font-display text-display-2 text-ink">This card isn&apos;t on this device</h1>
      <p className="mt-4 max-w-measure font-serif text-lede text-ink-2">Cards are saved in the browser where they were made. It may have been deleted.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/clubhouse/rounds" variant="primary">All cards</ButtonLink>
        <ButtonLink href="/clubhouse" variant="secondary">Back to the clubhouse</ButtonLink>
      </div>
    </Page>
  );
}

/** The conditions the card was played in, captured from Open-Meteo when the round started. */
function PlayedIn({ w }: { w: RoundWeather }) {
  return (
    <span className="grid gap-1">
      <span className="flex items-center gap-2.5">
        <WeatherGlyph code={w.code} isDay={!/clear/i.test(w.summary)} className="size-7 text-green" />
        <span className="min-w-0"><span className="sr-only">Played in {weatherSpoken(w)}.</span><span aria-hidden="true">Played in {weatherLine(w)}</span></span>
      </span>
      <ApiCredit source="open-meteo" live={false} as="span" />
    </span>
  );
}
