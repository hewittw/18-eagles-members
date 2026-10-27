import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/golf";
import { tokens } from "@/components/tokens";
import { SkipLink, ToastProvider } from "@/components/ui";
import { Section } from "./ds";
import { ColorTokens, Principles, SpaceShape, TypeScale } from "./foundations";
import { ChartSpecs, ClubPickerSpec, CourseSpecs, FairwaySpec, ScoreMarkSpec, ScoreTilesSpec, ScorecardSpec, ShellSpec } from "./golf-gallery";
import { ApiStateSpecs, WeatherNowSpec, WindSpecs } from "./api-gallery";
import { ButtonLinkSpec, ButtonSpec, ChoiceSpec, FeedbackSpecs, FieldSpec, MotionDemo, StepperSpec, SurfaceSpecs, ToggleSpec } from "./ui-gallery";

export const metadata: Metadata = {
  title: "Design system · The Members' Ledger",
  description: "The 18 Eagles component library: tokens with measured contrast, the type scale, and every component in every state, live.",
};

const TOC: { id: string; n: string; label: string; items?: [string, string][] }[] = [
  { id: "principles", n: "I", label: "Principles" },
  { id: "color", n: "II", label: "Color" },
  { id: "type", n: "III", label: "Type" },
  { id: "space", n: "IV", label: "Space, shape, motion" },
  { id: "controls", n: "V", label: "Controls", items: [["button", "Button"], ["buttonlink", "ButtonLink"], ["field", "Field + inputs"], ["choicegroup", "ChoiceGroup"], ["togglechip", "ToggleChip"], ["stepper", "Stepper"]] },
  { id: "surfaces", n: "VI", label: "Surfaces and messages", items: [["card", "Card"], ["sectionheading", "SectionHeading"], ["tag", "Tag"], ["callout", "Callout"], ["toast", "Toast"], ["confirmdialog", "ConfirmDialog"], ["skiplink", "SkipLink"]] },
  { id: "course", n: "VII", label: "On the course", items: [["scoremark", "ScoreMark"], ["scoretiles", "ScoreTiles"], ["clubpicker", "ClubPicker"], ["fairwaypicker", "FairwayPicker"], ["scorecardtable", "ScorecardTable"]] },
  { id: "clubhouse", n: "VIII", label: "The clubhouse", items: [["appshell", "AppShell"], ["appnav", "AppNav"], ["pageheader", "PageHeader"], ["wordmark", "Wordmark"], ["bignumber", "BigNumber"], ["coursecard", "CourseCard"], ["holeillustration", "HoleIllustration"], ["teeswatch", "TeeSwatch"]] },
  { id: "charts-s", n: "IX", label: "Charts" },
  { id: "outside", n: "X", label: "Outside data", items: [["weathernow", "WeatherNow"], ["windarrow", "WindArrow"], ["weatherglyph", "WeatherGlyph"], ["forecaststrip", "ForecastStrip"], ["teesheetforecast", "TeeSheetForecast"], ["apistate", "ApiState"], ["coursehits", "CourseHits"], ["apicredit", "ApiCredit"]] },
];

export default function DesignSystemPage() {
  const colorCount = Object.keys(tokens).length;
  return (
    <ToastProvider bottomOffset="1.25rem">
      <SkipLink />
      <header className="tex-locker on-green">
        <div className="mx-auto flex max-w-ledger flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-gold/40 px-4 py-3 sm:px-8">
          <Link href="/" className="caps -mx-2 inline-flex min-h-tap items-center px-2 text-[0.78rem] text-paper-3 hover:text-on-green">18 Eagles · Process hub</Link>
          <nav aria-label="Process pages" className="flex flex-wrap gap-x-1">
            <Link href="/mood-board" className="caps inline-flex min-h-tap items-center px-2 text-[0.78rem] text-paper-3 hover:text-on-green">Mood board</Link>
            <span aria-current="page" className="caps inline-flex min-h-tap items-center px-2 text-[0.78rem] text-gold">Design system</span>
            <Link href="/clubhouse" className="caps inline-flex min-h-tap items-center px-2 text-[0.78rem] text-paper-3 hover:text-on-green">The tool</Link>
          </nav>
        </div>
        <div className="mx-auto grid max-w-ledger gap-10 px-4 pb-14 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end lg:pb-20">
          <div className="min-w-0">
            <p className="caps text-label text-gold">Design system · Ceremonial · Tailored · Sunlit</p>
            <h1 className="mt-4 font-display text-[clamp(3rem,9vw,7.5rem)] leading-[0.92] text-on-green text-balance">The Members&apos; Ledger, in parts</h1>
            <p className="mt-6 max-w-[38rem] font-serif text-lede text-paper-3">
              The working component library for 18 Eagles. The tool imports these exact files, so what&apos;s on this page is what
              a golfer touches on the course. Every component is shown in every state, and every color pair is measured.
            </p>
          </div>
          <div className="min-w-0 border-t border-gold/40 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <Wordmark size="lg" tone="green" />
            <dl className="mt-8 grid grid-cols-3 gap-4">
              {[[String(colorCount), "color tokens"], ["4", "type families"], ["32", "parts + 5 charts"]].map(([v, l]) => (
                <div key={l} className="flex min-w-0 flex-col">
                  <dt className="caps order-2 text-[0.7rem] text-gold">{l}</dt>
                  <dd className="font-numeral text-[2.6rem] font-semibold leading-none tabular-nums text-on-green">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-ledger gap-10 px-4 py-10 sm:px-8 sm:py-14 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="On this page" className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto">
          <p className="caps text-[0.72rem] text-gold-ink">On this page</p>
          <ol className="mt-3 grid grid-cols-2 gap-x-4 border-t border-ink pt-2 sm:grid-cols-3 lg:grid-cols-1">
            {TOC.map((t) => (
              <li key={t.id} className="min-w-0">
                <a href={`#${t.id}`} className="flex min-h-tap items-baseline gap-2 py-1 text-[0.98rem] text-ink hover:underline lg:min-h-9">
                  <span className="w-7 shrink-0 font-display text-[0.95rem] text-gold-ink">{t.n}</span>
                  <span className="min-w-0">{t.label}</span>
                </a>
                {t.items && (
                  <ul className="mb-2 ml-9 hidden gap-0.5 lg:grid">
                    {t.items.map(([id, label]) => (
                      <li key={id}><a href={`#${id}`} className="block py-0.5 font-numeral text-[0.92rem] text-ink-2 hover:text-ink hover:underline">{label}</a></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <main id="main" className="grid min-w-0 gap-20 outline-none sm:gap-28">
          <Section id="principles" numeral="I" eyebrow="Week 3, applied" title="Six rules the parts keep" lede="Patterns and flows from the lecture, turned into defaults, so a page built from these parts gets them for free.">
            <Principles />
          </Section>
          <Section id="color" numeral="II" eyebrow="Tokens · @theme" title="Card stock, ink, green, brass" lede={<>Tailwind classes from the tokens: <code className="font-numeral">bg-paper</code>, <code className="font-numeral">text-ink-2</code>, <code className="font-numeral">border-rule-strong</code>. Brass lives on Locker Green; on paper it becomes Old Brass. Red is for under par, nothing else.</>}>
            <ColorTokens />
          </Section>
          <Section id="type" numeral="III" eyebrow="Four families, one voice each" title="Engraved, pencilled, printed" lede="Caslon Display for titles and the handicap (28px and up), Caslon Text for prose and, in italic, the golfer's own notes, Barlow for the interface, and Barlow Condensed with tabular figures for every number.">
            <TypeScale />
          </Section>
          <Section id="space" numeral="IV" eyebrow="Space, shape, motion" title="Room to breathe, nothing rounded" lede="Grouping by space, square corners, a tile's lip instead of a shadow, and one signature motion.">
            <SpaceShape />
            <MotionDemo />
          </Section>
          <Section id="controls" numeral="V" eyebrow="src/components/ui" title="Controls" lede="Real buttons, labels, and radios, each in rest, hover, focus-visible, pressed, selected, disabled, error, loading, and empty, with a live demo beside the specimens.">
            <ButtonSpec />
            <ButtonLinkSpec />
            <FieldSpec />
            <ChoiceSpec />
            <ToggleSpec />
            <StepperSpec />
          </Section>
          <Section id="surfaces" numeral="VI" eyebrow="src/components/ui" title="Surfaces and messages" lede="Where things sit, and how the app talks back: quietly, in words, with Undo.">
            <SurfaceSpecs />
            <FeedbackSpecs />
          </Section>
          <Section id="course" numeral="VII" eyebrow="src/components/golf" title="On the course" lede="The hole screen's parts, sized for one thumb in the sun: score tiles, the club board, the fairway, and the card.">
            <ScoreMarkSpec />
            <ScoreTilesSpec />
            <ClubPickerSpec />
            <FairwaySpec />
            <ScorecardSpec />
          </Section>
          <Section id="clubhouse" numeral="VIII" eyebrow="src/components/golf" title="The clubhouse" lede="The frame, the mark, the big number, and the course library, drawn from real course data.">
            <ShellSpec />
            <CourseSpecs />
          </Section>
          <Section id="charts-s" numeral="IX" eyebrow="src/components/golf/charts" title="Breakdowns, read like a board" lede="One example of each chart with a sample season. Every one can become a table.">
            <ChartSpecs />
          </Section>
          <Section id="outside" numeral="X" eyebrow="src/components/golf · Week 4" title="Weather and the course book, from outside" lede="Open-Meteo and OpenGolfAPI, called only by our own server routes. Each part in every state: loading, found, nothing found, and the service resting.">
            <WeatherNowSpec />
            <WindSpecs />
            <ApiStateSpecs />
          </Section>
        </main>
      </div>
      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-ledger flex-wrap items-center justify-between gap-4 px-4 py-8 text-[0.95rem] text-ink-2 sm:px-8">
          <p className="caps text-[0.72rem] text-gold-ink">18 Eagles · The Members&apos; Ledger · Design system</p>
          <p>Tokens: <code className="font-numeral">src/app/globals.css</code> · Contrast: <code className="font-numeral">src/components/tokens.ts</code> · Rules: <code className="font-numeral">docs/styles/clubhouse.md</code></p>
        </div>
      </footer>
    </ToastProvider>
  );
}
