import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import shinnecock from "@/data/courses/shinnecock-hills.json";
import { SkipLink } from "../ui/SkipLink";
import { Wordmark } from "./Wordmark";

const photo = shinnecock.hero;

/** What an account gives you, said plainly. Shown beside the form on wide screens and under it on phones. */
function Perks({ tone }: { tone: "green" | "paper" }) {
  const items = [
    ["Every card, on every device", "Play on your phone at the course, read the card on your laptop at home."],
    ["Private to you", "Your rounds are stored against your account, and the database itself refuses anyone else's request for them."],
    ["Free, and nothing to buy", "An email address is all it asks. No card details, ever."],
  ] as const;
  const green = tone === "green";
  return (
    <ul className="grid gap-4">
      {items.map(([t, d]) => (
        <li key={t} className="grid grid-cols-[1.25rem_1fr] gap-x-3">
          <svg viewBox="0 0 20 20" className={`mt-1 size-4 ${green ? "text-gold" : "text-green"}`} aria-hidden="true">
            <path d="M3.5 10.5 L8 15 L16.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <span className={`block font-semibold ${green ? "text-on-green" : "text-ink"}`}>{t}</span>
            <span className={`mt-0.5 block text-[0.95rem] leading-snug ${green ? "text-paper-3" : "text-ink-2"}`}>{d}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export type MembersEntranceProps = {
  /** The small caps line over the welcome, e.g. "The members' entrance". */
  eyebrow: string;
  /** The welcome on the photo (not the page's <h1>: Clerk's card heads the form). */
  title: string;
  lede: string;
  /** Clerk's <SignIn/> or <SignUp/>, inside its Suspense. */
  children: ReactNode;
};

/**
 * The frame around Clerk's sign-in and sign-up: Shinnecock's clubhouse on the hill, the wordmark back to the
 * Clubhouse, a line on what an account gives you, and the form on white. Wide: photo left, form right. Phones: a short
 * photo band, the form, then the three lines. Works down to 320px.
 */
export function MembersEntrance({ eyebrow, title, lede, children }: MembersEntranceProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(30rem,1fr)]">
      <SkipLink />
      <header className="tex-locker on-green relative isolate overflow-hidden lg:sticky lg:top-0 lg:h-dvh">
        <Image src={photo.src} alt="" fill priority sizes="(min-width: 64rem) 55vw, 100vw" className="-z-20 object-cover object-[50%_35%]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_64_43/0.72)_0%,rgb(0_80_54/0.55)_45%,rgb(0_64_43/0.94)_100%)]" />
        <div className="flex flex-col gap-12 px-5 pb-6 pt-4 sm:px-8 lg:h-full lg:px-12 lg:pb-14 lg:pt-8">
          <Link href="/clubhouse" className="-mx-1 flex min-h-tap w-fit items-center px-1" aria-label="18 Eagles, the clubhouse">
            <Wordmark tone="green" />
          </Link>
          <div className="mt-auto max-w-xl">
            <p className="caps text-label text-gold">{eyebrow}</p>
            <p className="mt-3 text-balance font-display text-display-2 text-on-green">{title}</p>
            <p className="mt-4 max-w-lg text-pretty font-serif text-lede text-paper-3">{lede}</p>
            <div className="mt-8 hidden border-t border-white/25 pt-8 lg:block"><Perks tone="green" /></div>
          </div>
        </div>
        {/* Phones: under the welcome, in the flow (it would sit on the words); wide: a small plate in the corner. */}
        <p className="px-5 pb-3 text-right text-[0.7rem] text-paper-3 sm:px-8 lg:absolute lg:bottom-2 lg:right-3 lg:rounded-xs lg:bg-black/55 lg:px-1.5 lg:py-0.5 lg:text-white">
          Photo: Shinnecock Hills clubhouse, {photo.credit}, {photo.license}
        </p>
      </header>
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-10 px-3 py-10 outline-none sm:px-6 lg:py-16">
        <div className="flex w-full justify-center">{children}</div>
        <div className="w-full max-w-[25rem] px-2 lg:hidden"><Perks tone="paper" /></div>
        <p className="max-w-[25rem] px-2 text-center text-[0.9rem] text-ink-2">
          Just looking? <Link href="/clubhouse" className="link font-semibold">See what 18 Eagles does</Link>
        </p>
      </main>
    </div>
  );
}
