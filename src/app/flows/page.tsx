import fs from "fs";
import path from "path";
import Image from "next/image";
import type { Metadata } from "next";
import { inline, Markdown, readDoc } from "@/lib/md";
import { ProcessHeader } from "../process-header";

export const metadata: Metadata = { title: "Flows: first visit, playing a round, coming back" };

// flows.md is the source of truth (also shown in the README). Diagrams are pre-rendered SVGs
// (scripts/render-mermaid.mjs), and the Mermaid source sits underneath each one as the text alternative.
// The rendered SVG's own size (its viewBox), so the A5 charts need no hand-kept numbers.
function svgSize(src: string): [number, number] {
  const svg = fs.readFileSync(path.join(process.cwd(), "public", src), "utf8");
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number) ?? [0, 0, 1200, 800];
  return [Math.round(vb[2]), Math.round(vb[3])];
}

const A5_HEADING = "## Assignment 5: the live system";

export default function Flows() {
  const all = readDoc("flows.md");
  // flows.md holds the Assignment 3 flows, then the Assignment 5 section. Each part is read on its own.
  const [md, a5md = ""] = all.split(A5_HEADING);
  const sentence = md.match(/^> (.+)$/m)?.[1] ?? "";
  const list = md.match(/## The three flows\n\n([\s\S]*?)\n\n###/)?.[1] ?? "";
  const diagrams = [...md.matchAll(/### (.+)\n```mermaid\n([\s\S]*?)```/g)].map((m, i) => ({ title: m[1], code: m[2], src: `/flows/flow-${i + 1}.svg` }));
  const routes = md.match(/## Routes[^\n]*\n([\s\S]*?)\n## /)?.[1] ?? "";
  const rows = routes.split("\n").filter((l) => l.startsWith("| `")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  const states = md.split("## States and errors we design for")[1] ?? "";
  const sizes: Record<number, [number, number]> = { 0: [791, 1125], 1: [1119, 1412], 2: [1539, 736] };

  // Assignment 5: the as-built system chart (docs/data-flow.md, rendered to /flows/system/), then the trace, the
  // freshness states and the two new user flows from flows.md (rendered after the three above: flow-4 onwards).
  const a5Intro = a5md.trim().split("\n\n")[0] ?? "";
  const a5Flows = a5md.split("\n### ").slice(1).map((part, i) => {
    const m = part.match(/^(.+)\n```mermaid\n([\s\S]*?)```([\s\S]*)$/);
    return { title: (m?.[1] ?? "").replace(/^\d+ · /, ""), code: m?.[2] ?? "", note: (m?.[3] ?? "").trim(), src: `/flows/flow-${diagrams.length + i + 1}.svg` };
  });
  const dataFlow = readDoc("docs/data-flow.md");
  // The system as it runs now: the chart after the pivot from Flights to the Pro Shop (the third block, flow-3).
  const asBuilt = dataFlow.split("# Pivot: Flights → Pro Shop")[1]?.match(/```mermaid\n([\s\S]*?)```/)?.[1] ?? "";
  const pick = (word: string) => a5Flows.find((f) => f.title.includes(word));
  const a5 = [
    { title: "The system, as built", code: asBuilt, note: "Drawn before any code in docs/data-flow.md, redrawn from the code once it ran, and redrawn again when the Pro Shop replaced Flights. The tables of what changed, and why, are in the same file.", src: "/flows/system/flow-3.svg" },
    pick("Trace"), pick("Freshness"), pick("tour player"), pick("Browse the Pro Shop"),
  ].filter((d): d is NonNullable<typeof d> => !!d && !!d.code).map((d) => ({ ...d, size: svgSize(d.src) }));

  return (
    <>
      <ProcessHeader here="Flows" />
      <main id="main" className="mx-auto w-full max-w-[1120px] px-6 pb-32 pt-14 md:px-10">
        <p className="font-numeral text-xs uppercase tracking-[0.16em] text-ink-2">Assignment 3 · Step 2</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.02] text-ink md:text-6xl">The flows</h1>
        <p className="mt-6 max-w-3xl border-l-2 border-green pl-5 font-serif text-xl italic leading-relaxed text-ink">{inline(sentence)}</p>
        <Markdown md={list} className="mt-6 max-w-3xl text-base" />
        {a5.length > 0 && (
          <p className="mt-6 text-base">
            <a href="#a5" className="text-ink underline underline-offset-4 hover:text-green focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus rounded-sm">Assignment 5: the live system</a>
            <span className="text-ink-2">: the Tour and Pro Shop pages, the workers behind them, and how one change reaches the screen.</span>
          </p>
        )}

        {diagrams.map((d, i) => (
          <section key={d.title} aria-labelledby={`flow-${i}`} className="mt-16">
            <h2 id={`flow-${i}`} className="border-t border-rule-strong pt-6 font-display text-3xl text-ink">{d.title.replace(/^\d+ · /, "")}</h2>
            <div className="mt-6 overflow-x-auto rounded-md border border-rule bg-[#ffffff] p-4 md:p-8">
              <Image loading="eager" src={d.src} alt={`Flow diagram: ${d.title}. The same steps are listed in the Mermaid source below.`} width={sizes[i][0]} height={sizes[i][1]} className="mx-auto h-auto w-full" style={{ maxWidth: sizes[i][0] * 1.1 }} unoptimized />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer rounded-sm py-1 text-sm text-ink-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">Mermaid source (text version)</summary>
              <pre tabIndex={0} role="region" aria-label={`Mermaid source: ${d.title}`} className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus rounded-md bg-paper-3 p-4 text-xs leading-relaxed text-ink">{d.code}</pre>
            </details>
          </section>
        ))}

        <section aria-labelledby="routes" className="mt-16">
          <h2 id="routes" className="border-t border-rule-strong pt-6 font-display text-3xl text-ink">A page for each step</h2>
          <div className="mt-6 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus" role="region" aria-label="Routes (scrolls sideways)" tabIndex={0}>
            <table className="w-full min-w-[600px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-rule-strong font-numeral text-xs uppercase tracking-[0.14em] text-ink-2">
                  <th scope="col" className="py-3 pr-6 font-medium">Route</th>
                  <th scope="col" className="py-3 pr-6 font-medium">Step</th>
                  <th scope="col" className="py-3 font-medium">In the nav</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r[0]} className="border-b border-rule align-top">
                    <th scope="row" className="py-3 pr-6 font-normal text-ink">{inline(r[0])}</th>
                    <td className="py-3 pr-6 text-ink-2">{r[1]}</td>
                    <td className="py-3 text-ink-2">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="states" className="mt-16">
          <h2 id="states" className="border-t border-rule-strong pt-6 font-display text-3xl text-ink">States and errors we design for</h2>
          <Markdown md={states} className="max-w-3xl" />
        </section>

        {a5.length > 0 && (
          <section aria-labelledby="a5" className="mt-24">
            <p className="font-numeral text-xs uppercase tracking-[0.16em] text-ink-2">Assignment 5 · Live data</p>
            <h2 id="a5" className="mt-3 max-w-3xl scroll-mt-8 font-display text-4xl leading-[1.05] text-ink md:text-5xl">The live system</h2>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-ink">{inline(a5Intro)}</p>
            {a5.map((d, i) => (
              <section key={d.title} aria-labelledby={`a5-${i}`} className="mt-16">
                <h3 id={`a5-${i}`} className="border-t border-rule-strong pt-6 font-display text-3xl text-ink">{d.title}</h3>
                {d.note && <Markdown md={d.note} className="mt-3 max-w-3xl text-base" />}
                <div className="mt-6 overflow-x-auto rounded-md border border-rule bg-[#ffffff] p-4 md:p-8">
                  <Image loading="lazy" src={d.src} alt={`Diagram: ${d.title}. The same steps are listed in the Mermaid source below.`} width={d.size[0]} height={d.size[1]} className="mx-auto h-auto w-full" style={{ maxWidth: d.size[0] * 1.1 }} unoptimized />
                </div>
                <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <a href={d.src} className="rounded-sm py-1 text-ink-2 underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">Open the chart full size</a>
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer rounded-sm py-1 text-sm text-ink-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus">Mermaid source (text version)</summary>
                  <pre tabIndex={0} role="region" aria-label={`Mermaid source: ${d.title}`} className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus rounded-md bg-paper-3 p-4 text-xs leading-relaxed text-ink">{d.code}</pre>
                </details>
              </section>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
