"use client";
// /clubhouse/shop: the Pro Shop. What six golf brands have marked down right now, read from their own public store
// feeds by our worker (supabase/functions/poll-deals), saved in shop_deals, and pushed here by Realtime: a new sale,
// a price drop, selling out. Every deal is in one grid, with one row of category chips to narrow it. Kept deliberately plain: a grid of cards, each a link to the brand's own page.
import { useMemo, useState, type ReactNode } from "react";
import { ApiState, Freshness, LivePauseNotice, PageHeader, PhotoBand } from "@/components/golf";
import { Button, cx, SectionHeading, ToggleChip } from "@/components/ui";
import { useSupabaseBrowser } from "@/lib/live/browser";
import { BRANDS, brandName, CATEGORIES, categoryLabel, type CategoryId } from "@/lib/live/shop";
import { useFlash } from "@/lib/live/useFlash";
import { useNow } from "@/lib/live/useNow";
import { useWorkerHealth, type WorkerHealth } from "@/lib/live/useWorkerHealth";
import { Page } from "../../_components/Placeholder";
import { useShopLive, type Deal, type DealChange, type ShopLive } from "./useShopLive";

/** The worker's schedule (supabase/migrations/20261102170300_cron_deals.sql): fresh = a good run within 15 minutes. */
const EVERY_SEC = 300;
const REST_PREVIEW = 24;
// The band's photo: Winged Foot's gate, "Members and Guests Only" (docs/credits.md, Winged Foot g1.jpg).
const BAND_PHOTO = { src: "/courses/winged-foot-west/graded/g1.jpg", credit: "Anthony22, CC BY-SA 3.0" };

/** In stock first, then the deepest cut, then the lower price, then by name (stable as rows arrive). */
const order = (a: Deal, b: Deal) =>
  Number(b.available) - Number(a.available) || b.pct_off - a.pct_off || Number(a.price) - Number(b.price) || a.title.localeCompare(b.title);

/** "a, b and c" */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
// The section's lede, from the catalog: every category but "Other", every brand by its short name ("Good Good Golf" → "Good Good").
const SHOP_LEDE = `Markdowns on ${andList(CATEGORIES.filter((c) => c.id !== "other").map((c) => c.label.toLowerCase()))}, straight from each brand’s own store: ${andList(BRANDS.map((b) => b.name.replace(/ Golf$/, "")))}.`;

export function ShopBoard() {
  const db = useSupabaseBrowser();
  // Freshness first: it subscribes to worker_runs before the deals' snapshot is read.
  const health = useWorkerHealth("deals", EVERY_SEC);
  const live = useShopLive(db);

  const sorted = useMemo(() => [...live.deals].sort(order), [live.deals]);
  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    for (const d of live.deals) m.set(d.category, (m.get(d.category) ?? 0) + 1);
    return m;
  }, [live.deals]);
  // "New": arrived after the shop's first fill, within the last two days (every row of the first run is "first seen" then).
  const isNew = useNewCheck(live.deals);

  return (
    <>
      <PhotoBand aria-label="Pro Shop" photo={BAND_PHOTO}>
        <div className="mx-auto max-w-ledger px-4 pb-10 pt-10 sm:px-6 md:pb-16 md:pt-16 lg:px-8">
          <PageHeader
            tone="green"
            className="bg-transparent"
            eyebrow="Members’ pro shop"
            title="Pro Shop"
            lede={`On sale now from golf brands’ own stores. New markdowns appear as they’re posted.`}
          />
          <ShopSummary health={health} />
        </div>
      </PhotoBand>
      <Announcer change={live.lastChange} />
      <Page className="grid gap-12 md:gap-16">
        <TheRest live={live} sorted={sorted} counts={counts} isNew={isNew} />

        <p className="max-w-measure text-[0.85rem] leading-relaxed text-ink-2">
          Sale prices and stock from each brand&rsquo;s own public store:{" "}
          {BRANDS.map((b, i) => (
            <span key={b.slug}>
              <a className="link" href={`https://${b.domain}/`} target="_blank" rel="noreferrer">{b.name}<span className="sr-only"> (opens in a new tab)</span></a>
              {(counts.size || live.load === "ready") && !live.deals.some((d) => d.brand === b.slug) ? " (nothing on sale right now)" : ""}
              {i < BRANDS.length - 2 ? ", " : i === BRANDS.length - 2 ? " and " : "."}
            </span>
          ))}{" "}
          Our server checks them every five minutes and saves only what changed; your browser never calls them. Prices are the
          brands&rsquo;, in US dollars: check the store before you buy.
        </p>

        <LivePauseNotice what="the sale prices" />
      </Page>
    </>
  );
}

// ───────── The band's summary ─────────

/** Just the freshness line, under a brass rule: the counts live with the cards below. */
function ShopSummary({ health }: { health: WorkerHealth }) {
  return (
    <div className="mt-6 border-t border-gold/35 pt-4 md:mt-8">
      <Freshness health={health} what="The Pro Shop" tone="green" />
    </div>
  );
}

type SectionProps = { live: ShopLive; sorted: Deal[]; counts: Map<CategoryId, number>; isNew: (d: Deal) => boolean };

// ───────── Everything else ─────────

function TheRest({ live, sorted, counts, isNew }: SectionProps) {
  const [pick, setPick] = useState<CategoryId | null>(null);
  const [all, setAll] = useState(false);
  const cats = CATEGORIES;
  const chosen = pick;
  const rest = sorted;
  const matched = chosen ? rest.filter((d) => d.category === chosen) : rest;
  const shown = all ? matched : matched.slice(0, REST_PREVIEW);
  const choose = (c: CategoryId | null) => { setPick(c); setAll(false); };

  let body: ReactNode;
  if (live.load === "loading") body = <ApiState kind="loading" shape="list" label="Loading what's on sale" />;
  else if (live.load === "error" && !live.deals.length) {
    body = (
      <ApiState kind="down" title="We couldn’t read the shop">
        Reload the page in a moment. If it keeps happening, our side is down, not the brands&rsquo;.
      </ApiState>
    );
  } else if (!live.deals.length) {
    body = (
      <ApiState kind="empty" title="Nothing on sale right now">
        None of the {BRANDS.length} brands has a markdown up. We check every five minutes; the first one appears here on its own.
      </ApiState>
    );
  } else if (!matched.length) {
    body = (
      <ApiState kind="empty" title={`Nothing in ${chosen ? categoryLabel(chosen) : "this category"} on sale right now`}
        action={<Button size="sm" variant="secondary" onClick={() => choose(null)}>Show every category</Button>}>
        The moment one of the {BRANDS.length} brands marks one down, it appears here on its own.
      </ApiState>
    );
  } else {
    body = (
      <div className="grid gap-5">
        <DealGrid deals={shown} live={live} isNew={isNew} label={chosen ? `${categoryLabel(chosen)} on sale` : "Everything on sale"} />
        {matched.length > REST_PREVIEW && (
          <div>
            <Button variant="secondary" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? `Show the first ${REST_PREVIEW}` : `Show all ${matched.length}`}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="rest-h" className="grid content-start gap-5">
      <SectionHeading id="rest-h" eyebrow="Every brand" title="On sale now" lede={SHOP_LEDE}
        action={live.deals.length ? <p role="status" className="font-numeral text-[1.05rem] font-medium tabular-nums text-ink-2">{matched.length} {matched.length === 1 ? "item" : "items"}</p> : undefined} />
      {rest.length > 0 && cats.length > 1 && (
        <div role="group" aria-label="Show one category" className="flex flex-wrap gap-2">
          <ToggleChip pressed={!chosen} onPressedChange={() => choose(null)}>All <Count n={rest.length} on={!chosen} /></ToggleChip>
          {cats.map((c) => (
            <ToggleChip key={c.id} pressed={chosen === c.id} onPressedChange={(p) => choose(p ? c.id : null)}>
              {c.label} <Count n={counts.get(c.id) ?? 0} on={chosen === c.id} />
            </ToggleChip>
          ))}
        </div>
      )}
      {body}
    </section>
  );
}

function Count({ n, on }: { n: number; on: boolean }) {
  return <span className={cx("font-numeral tabular-nums", on ? "text-on-green/85" : "text-ink-2")}><span className="sr-only">, </span>{n}</span>;
}

// ───────── The cards ─────────

function DealGrid({ deals, live, isNew, label }: { deals: Deal[]; live: ShopLive; isNew: (d: Deal) => boolean; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {deals.map((d) => <DealCard key={d.id} d={d} flashAt={live.touched.get(d.id)} fresh={isNew(d)} />)}
    </ul>
  );
}

const usd = (v: number | string) => {
  const n = Number(v);
  return `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;
};

function DealCard({ d, flashAt, fresh }: { d: Deal; flashAt?: number; fresh: boolean }) {
  const ref = useFlash<HTMLLIElement>(flashAt);
  const out = !d.available;
  const brand = brandName(d.brand);
  return (
    <li ref={ref} className="min-w-0 rounded-xl">
      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        className={cx(
          "group grid h-full min-w-0 content-start overflow-hidden rounded-xl border bg-paper-2 shadow-card transition-[border-color,transform] duration-150",
          "border-rule is-hover:border-green is-pressed:translate-y-px",
        )}
      >
        <div className="relative aspect-square border-b border-rule bg-white">
          {d.image ? (
            // The brand's own product photo, straight from Shopify's CDN at 480 px (the worker fixes the width), lazy.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.image} alt="" width={480} height={480} loading="lazy" decoding="async"
              className={cx("size-full object-contain p-2 sm:p-3", out && "opacity-55 grayscale")} />
          ) : null}
          {/* The markdown, as the hand-operated board shows a score under par: red numerals on a white tile. */}
          <p className="tile absolute bottom-2 left-2 grid min-h-9 place-items-center rounded-xs px-2 font-numeral text-[1.15rem] font-semibold leading-none tabular-nums text-under sm:bottom-3 sm:left-3 sm:min-h-11 sm:text-[1.4rem]">
            <span aria-hidden="true">−{d.pct_off}%</span>
          </p>
          {fresh && !out && (
            <p className="caps absolute right-2 top-2 rounded-full bg-green-3 px-2 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-on-green sm:right-3 sm:top-3">New</p>
          )}
        </div>
        <div className="grid min-w-0 gap-1.5 p-3 sm:p-4">
          <p className="caps text-label text-gold-ink [overflow-wrap:anywhere]">{brand}</p>
          <h3 className="line-clamp-2 font-serif text-[1rem] font-bold leading-snug text-ink group-hover:underline group-data-[force~=hover]:underline sm:text-[1.08rem]">{d.title}</h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cx("font-numeral text-[1.35rem] font-semibold leading-none tabular-nums sm:text-[1.55rem]", out ? "text-ink-2" : "text-ink")}>{usd(d.price)}</span>
            <s className="font-numeral text-[0.98rem] tabular-nums text-ink-2"><span className="sr-only">was </span>{usd(d.was_price)}</s>
            <span className="sr-only">, {d.pct_off}% off</span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[0.85rem] leading-snug text-ink-2">
            <StockMark out={out} />
            <span>{out ? "Sold out" : "In stock"}</span>
            {/* The category on wider cards only: on a phone the chips above already say it. */}
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden truncate sm:inline">{categoryLabel(d.category)}</span>
          </p>
          <span className="sr-only">{fresh && !out ? "New markdown. " : ""}Opens {brand}&rsquo;s store in a new tab.</span>
        </div>
      </a>
    </li>
  );
}

/** In stock: a filled Fairway dot. Sold out: an open ring with a stroke through it. Words beside it, always. */
function StockMark({ out }: { out: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={cx("size-3 shrink-0", out ? "text-ink-2" : "text-green")} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      {out ? (<><circle cx="8" cy="8" r="5.5" /><path d="M4.2 11.8 L11.8 4.2" /></>) : <circle cx="8" cy="8" r="4.5" fill="currentColor" />}
    </svg>
  );
}

// ───────── Live bits ─────────

/** A card is "new" if it arrived after the shop's first fill (more than 15 minutes after the earliest row) and in the last 2 days. */
function useNewCheck(deals: Deal[]) {
  const now = useNow();
  const first = useMemo(() => deals.reduce((m, d) => Math.min(m, Date.parse(d.first_seen_at)), Infinity), [deals]);
  return (d: Deal) => {
    const t = Date.parse(d.first_seen_at);
    return Number.isFinite(first) && t - first > 15 * 60_000 && (!now || now - t < 2 * 86_400_000);
  };
}

/** Says a pushed change out loud (screen readers, polite): a new markdown, a price move, a sell-out. */
const SAID: Record<DealChange["kind"], string | null> = {
  new: "New markdown", cheaper: "Price drop", pricier: "Price up", "sold-out": "Sold out", back: "Back in stock", other: null,
};
function Announcer({ change }: { change: DealChange | null }) {
  const what = change && SAID[change.kind];
  return <p className="sr-only" aria-live="polite">{what ? `${what}: ${change.after.title}, $${change.after.price}.` : ""}</p>;
}
