import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Image from "next/image";
import { ScorecardTable } from "@/components/golf/ScorecardTable";
import { buttonClasses } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import turnberry from "@/data/courses/turnberry-ailsa.json";
import type { Hole } from "@/lib/course-types";
import type { HoleEntry } from "@/lib/types";

// The lighthouse at sunset: the welcome's mood photo (the course page leads with a daylight green, to match the set).
const photo = turnberry.gallery.find((g) => /sunset/i.test(g.alt)) ?? turnberry.hero;

// The sample card: Turnberry's front nine as a drawing of what a card looks like. Nobody's round: no name, no date.
const front = (turnberry.holes as Hole[]).slice(0, 9);
const SAMPLE: [number, number][] = [[5, 2], [4, 2], [5, 2], [3, 1], [6, 2], [3, 2], [4, 1], [5, 2], [4, 2]];
const entries: Record<number, HoleEntry> = Object.fromEntries(
  front.map((h, i) => [h.n, { strokes: SAMPLE[i][0], putts: SAMPLE[i][1], fairway: null, penalties: 0, shots: [], note: "" }]),
);

const BEATS = [
  {
    n: "1",
    title: "Play it hole by hole",
    body: "Tap the score, the putts and the club off the tee as you walk. The card adds itself up, and keeps your place if the phone goes back in the bag.",
  },
  {
    n: "2",
    title: "A handicap from your own cards",
    body: "Post three cards and your index appears, worked out from your best recent differentials. Every number links back to the card it came from.",
  },
  {
    n: "3",
    title: "Real courses, real conditions",
    body: "Look up the course you're playing and check the wind and temperature at the first tee before you go out.",
  },
];

function Doors({ tone }: { tone: "paper" | "green" }) {
  return (
    <div className="flex flex-wrap gap-3">
      <SignUpButton mode="redirect">
        <button type="button" className={buttonClasses({ variant: "primary", size: "lg", tone })}>Create your locker</button>
      </SignUpButton>
      <SignInButton mode="redirect">
        <button type="button" className={buttonClasses({ variant: "secondary", size: "lg", tone })}>Sign in</button>
      </SignInButton>
    </div>
  );
}

/**
 * The public front door at /clubhouse, what a signed-out visitor sees first. Nobody's data is on it: the card is a
 * drawing of Turnberry's front nine. A photo hero with the two doors in, the three things the journal does beside the
 * sample card, and a plain word on privacy with the doors again.
 */
export function Welcome() {
  return (
    <>
      <section aria-labelledby="welcome-title" className="tex-locker on-green relative isolate overflow-hidden">
        <Image src={photo.src} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[70%_50%]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_64_43/0.95)_0%,rgb(0_80_54/0.82)_42%,rgb(0_90_61/0.28)_100%)] max-md:bg-[linear-gradient(180deg,rgb(0_64_43/0.3)_0%,rgb(0_72_50/0.88)_45%,rgb(0_64_43/0.97)_100%)]" />
        <div className="mx-auto flex min-h-[min(40rem,82svh)] max-w-ledger flex-col justify-end px-4 pb-14 pt-40 sm:px-6 md:justify-center md:pb-20 md:pt-20 lg:px-8">
          <p className="caps text-label text-gold">The members&apos; entrance</p>
          <h1 id="welcome-title" className="mt-4 max-w-[13ch] text-balance font-display text-display-1 text-on-green">
            Your golf journal, kept in your own locker.
          </h1>
          <p className="mt-6 max-w-[34rem] text-pretty font-serif text-lede text-paper-3">
            Play a round hole by hole, keep every card, and watch your handicap move. One account, on every device you sign in on.
          </p>
          <div className="mt-9"><Doors tone="green" /></div>
          <p className="mt-5 text-[0.92rem] text-paper-3">Free. Your cards are private to your account.</p>
        </div>
        <p className="absolute bottom-2 right-3 rounded-xs bg-black/55 px-1.5 py-0.5 text-[0.7rem] text-white">
          Photo: Turnberry lighthouse and the Ailsa course, {photo.credit}, {photo.license}
        </p>
      </section>

      <section aria-labelledby="how-title" className="mx-auto max-w-ledger px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <SectionHeading id="how-title" eyebrow="How it plays" title="A card for every round, and what it says about your game." className="max-w-3xl" />
        <div className="mt-10 grid gap-12 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:gap-8">
          <div className="min-w-0">
            <ol className="border-t border-rule">
              {BEATS.map((b) => (
                <li key={b.n} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-b border-rule py-6 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                  <span aria-hidden="true" className="font-numeral text-[2.6rem] font-medium leading-none text-green">{b.n}</span>
                  <div>
                    <h3 className="font-display text-title text-ink">{b.title}</h3>
                    <p className="mt-2 max-w-measure text-pretty text-[1rem] leading-relaxed text-ink-2">{b.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <figure className="min-w-0 self-start xl:pt-6">
            <div className="overflow-hidden rounded-xl border border-rule bg-paper-2 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-4 sm:px-5">
                <p className="font-display text-[1.35rem] leading-tight text-ink">Turnberry, Ailsa · Front nine</p>
                <p className="caps text-label text-gold-ink">Sample card</p>
              </div>
              <div className="p-2 sm:p-3 xl:p-0">
                <ScorecardTable holes={front} entries={entries} teeName="Black" caption="Sample scorecard: Turnberry's front nine, an illustration, not anyone's round" />
              </div>
            </div>
            <figcaption className="mt-3 text-[0.9rem] text-ink-2">
              An illustration, not anyone&apos;s round. Circles are birdies, squares bogeys, as the old boards mark them.
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="private-title" className="border-t border-rule bg-paper-3">
        <div className="mx-auto grid max-w-ledger gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:py-20 lg:px-8">
          <div className="min-w-0">
            <SectionHeading
              id="private-title"
              eyebrow="Private by design"
              title="Your cards are private to your account."
              lede="Each round is saved against your sign-in, and the database itself refuses a request for anyone else's. Nothing on this page belongs to a golfer: the card above is a drawing."
            />
          </div>
          <Doors tone="paper" />
        </div>
      </section>
    </>
  );
}
