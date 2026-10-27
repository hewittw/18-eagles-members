import Link from "next/link";
import { checklist, parts, TOOL_HREF, week4, type Part, type Status } from "@/lib/progress";

// The hub: a progress home base for the process. The submitted link is the tool itself (TOOL_HREF).
const ring = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25282A]";

const statusStyle: Record<Status, string> = {
  done: "bg-[#006747] text-white",
  "in progress": "bg-[#FCE300] text-[#00402B]",
  next: "bg-transparent text-[#53565A] ring-1 ring-[#BDBDBD]",
};

function StatusTag({ s }: { s: Status }) {
  return (
    <span className={`inline-block w-fit shrink-0 self-start justify-self-start whitespace-nowrap sm:self-auto rounded-full px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] ${statusStyle[s]}`}>
      {s}
    </span>
  );
}

function PartList({ items }: { items: Part[] }) {
  return (
    <ol className="mt-6 divide-y divide-[#E6E6E6]">
      {items.map((p) => (
        <li key={p.n}>
          <Link href={p.href} className={`group grid gap-2 py-6 sm:grid-cols-[3.5rem_1fr_auto] sm:items-baseline ${ring}`}>
            <span className="font-mono text-sm text-[#6B6F73]">{p.n}</span>
            <span>
              <span className="text-lg font-medium tracking-tight group-hover:underline">{p.title}</span>
              <span className="mt-1 block max-w-2xl text-[15px] leading-relaxed text-[#53565A]">{p.note}</span>
            </span>
            <StatusTag s={p.status} />
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function Hub() {
  return (
    <main id="main" className="mx-auto w-full max-w-[1120px] px-6 pb-32 pt-16 md:px-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-balance text-[#53565A]">
        Design, Build, Ship&nbsp;· Assignment 4&nbsp;· Full Stack
      </p>
      <h1 className="mt-4 font-display text-5xl font-normal leading-[0.95] tracking-[-0.02em] text-[#006747] md:text-7xl">18 Eagles</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#53565A]">
        A personal golf round journal. Play a round hole by hole, keep every card, and watch your handicap move.
        This week it gained accounts: your journal is saved to your own account, private to you. This page tracks how it was made.
      </p>
      <Link
        href={TOOL_HREF}
        className={`mt-8 inline-flex items-center gap-2 rounded-full bg-[#006747] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#00563B] active:scale-[0.97] ${ring}`}
      >
        Open 18 Eagles <span aria-hidden>→</span>
      </Link>

      <section aria-labelledby="week4" className="mt-20">
        <h2 id="week4" className="border-t border-[#D9D9D9] pt-6 text-xl font-medium tracking-tight">
          Week 4: full stack
        </h2>
        <PartList items={week4} />
      </section>

      <section aria-labelledby="parts" className="mt-16">
        <h2 id="parts" className="border-t border-[#D9D9D9] pt-6 text-xl font-medium tracking-tight">
          The work
        </h2>
        <PartList items={parts} />
      </section>

      <section aria-labelledby="checklist" className="mt-16">
        <h2 id="checklist" className="border-t border-[#D9D9D9] pt-6 text-xl font-medium tracking-tight">
          Assignment checklist
        </h2>
        <ul className="mt-6 grid gap-3">
          {checklist.map((c) => (
            <li key={c.item} className="flex items-start justify-between gap-6 text-[15px]">
              <span>{c.item}</span>
              <StatusTag s={c.status} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
