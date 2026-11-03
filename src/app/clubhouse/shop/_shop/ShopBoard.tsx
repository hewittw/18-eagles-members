"use client";
// /clubhouse/shop: the Pro Shop. What six golf brands have marked down right now, read from their own public store
// feeds by our worker (supabase/functions/poll-deals), saved in shop_deals, and pushed here by Realtime: a new sale,
// a price drop, selling out. The categories a golfer watches come first ("Your watch list"); everything else is below,
// with one row of category chips. Kept deliberately plain: a grid of cards, each a link to the brand's own page.
import { useMemo, useState, type ReactNode } from "react";
import { ApiState, Freshness, LivePauseNotice, PageHeader, PhotoBand } from "@/components/golf";
import { Button, cx, SectionHeading, ToggleChip } from "@/components/ui";
import { useSupabaseBrowser } from "@/lib/live/browser";
import { MAX_CATEGORIES } from "@/lib/live/limits";
import { BRANDS, brandName, CATEGORIES, categoryLabel, type CategoryId } from "@/lib/live/shop";
import { useFlash } from "@/lib/live/useFlash";
import { useNow } from "@/lib/live/useNow";
import { useWorkerHealth, type WorkerHealth } from "@/lib/live/useWorkerHealth";
import { Page } from "../../_components/Placeholder";
import { useShopLive, type Deal, type ShopLive } from "./useShopLive";
import { useWatched, type WatchedState } from "./useWatched";

/** The worker's schedule (supabase/migrations/20261102170300_cron_deals.sql): fresh = a good run within 15 minutes. */
const EVERY_SEC = 300;
const WATCH_PREVIEW = 8;
const REST_PREVIEW = 24;
// The band's photo: Winged Foot's gate, "Members and Guests Only" (docs/credits.md, Winged Foot g1.jpg).
const BAND_PHOTO = { src: "/courses/winged-foot-west/graded/g1.jpg", credit: "Anthony22, CC BY-SA 3.0" };

/** In stock first, then the deepest cut, then the lower price, then by name (stable as rows arrive). */
const order = (a: Deal, b: Deal) =>
  Number(b.available) - Number(a.available) || b.pct_off - a.pct_off || Number(a.price) - Number(b.price) || a.title.localeCompare(b.title);

export function ShopBoard() {
  const db = useSupabaseBrowser();
  // Freshness first: it subscribes to worker_runs before the deals' snapshot is read.
  const health = useWorkerHealth("deals", EVERY_SEC);
  const live = useShopLive(db);
  const watched = useWatched(db);

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
            lede={`On sale now from golf brands’ own stores. Watch up to ${MAX_CATEGORIES} categories and they come first; new markdowns appear as they’re posted.`}
          />
          <ShopSummary live={live} health={health} />
        </div>
      </PhotoBand>
      <Page className="grid gap-12 md:gap-16">
        <WatchList live={live} watched={watched} sorted={sorted} counts={counts} isNew={isNew} />
        <TheRest live={live} watched={watched} sorted={sorted} counts={counts} isNew={isNew} health={health} />
        <WatchAnnouncer live={live} watched={watched} />

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

function ShopSummary({ live, health }: { live: ShopLive; health: WorkerHealth }) {
  const n = live.deals.length;
  const brands = new Set(live.deals.map((d) => d.brand)).size;
  const deepest = live.deals.reduce((m, d) => Math.max(m, d.pct_off), 0);
  return (
    <div className="mt-8 grid gap-4 border-t border-gold/35 pt-5 md:mt-10">
      {live.load === "loading" ? (
        <ApiState kind="loading" tone="green" shape="line" label="Loading what's on sale" />
      ) : n ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          <Stat label="On sale" value={String(n)} />
          <Stat label="Brands" value={`${brands} of ${BRANDS.length}`} />
          <Stat label="Deepest cut" value={<><span aria-hidden="true">−</span>{deepest}%<span className="sr-only"> off</span></>} />
        </dl>
      ) : null}
      <Freshness health={health} what="The Pro Shop" tone="green" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="caps text-label text-gold">{label}</dt>
      <dd className="mt-1 font-numeral text-[1.9rem] font-semibold leading-none tabular-nums text-on-green">{value}</dd>
    </div>
  );
}

// ───────── Your watch list ─────────

type SectionProps = { live: ShopLive; watched: WatchedState; sorted: Deal[]; counts: Map<CategoryId, number>; isNew: (d: Deal) => boolean };

function WatchList({ live, watched, sorted, counts, isNew }: SectionProps) {
  const [all, setAll] = useState(false);
  const list = watched.list;
  const n = list?.length ?? 0;
  const mine = useMemo(() => (list ? sorted.filter((d) => list.includes(d.category)) : []), [sorted, list]);
  const empty = list?.filter((c) => !counts.get(c)) ?? [];
  const shown = all ? mine : mine.slice(0, WATCH_PREVIEW);

  let body: ReactNode;
  if (!list || live.load === "loading") body = <ApiState kind="loading" shape="list" label="Loading your watch list" />;
  else if (n === 0) {
    body = (
      <ApiState kind="empty" title="Nothing watched yet">
        Pick a category above (Balls, say, or Training aids). Its markdowns will sit here first, and a new one shows up
        while you&rsquo;re looking.
      </ApiState>
    );
  } else if (live.load === "error" && !live.deals.length) {
    body = <ApiState kind="down" title="We couldn’t read the shop">Reload the page in a moment. Your watch list is saved.</ApiState>;
  } else {
    body = (
      <div className="grid gap-5">
        {mine.length > 0 && <DealGrid deals={shown} live={live} isNew={isNew} label="Deals in your watched categories" />}
        {empty.map((c) => (
          <ApiState key={c} kind="empty" title={`Nothing in ${categoryLabel(c)} on sale right now`}>
            The moment one of the {BRANDS.length} brands marks one down, it appears here, at the top.
          </ApiState>
        ))}
        {mine.length > WATCH_PREVIEW && (
          <div>
            <Button variant="secondary" size="sm" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? `Show the first ${WATCH_PREVIEW}` : `Show all ${mine.length}`}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="watch-h" className="grid gap-5">
      <SectionHeading
        id="watch-h"
        eyebrow="Watched"
        title="Your watch list"
        action={list ? <p className="font-numeral text-[1.05rem] font-medium tabular-nums text-ink-2">{n} of {MAX_CATEGORIES} categories</p> : undefined}
      />
      <div role="group" aria-labelledby="watch-chips-label" className="grid gap-2.5">
        <p id="watch-chips-label" className="caps text-label text-ink-2">Watch a category</p>
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = watched.isWatching(c.id);
            return (
              <li key={c.id}>
                <ToggleChip pressed={on} onPressedChange={() => watched.toggle(c.id)} aria-busy={watched.busy.has(c.id) || undefined} disabled={!list}>
                  {c.label}{" "}
                  <span className={cx("font-numeral tabular-nums", on ? "text-on-green/85" : "text-ink-2")}>
                    <span className="sr-only">, </span>{counts.get(c.id) ?? 0}<span className="sr-only"> on sale</span>
                  </span>
                </ToggleChip>
              </li>
            );
          })}
        </ul>
        {watched.error && <p className="text-[0.95rem] text-error" role="status">{watched.error}</p>}
      </div>
      {body}
    </section>
  );
}

// ───────── Everything else ─────────

function TheRest({ live, watched, sorted, counts, isNew, health }: SectionProps & { health: WorkerHealth }) {
  const [pick, setPick] = useState<CategoryId | null>(null);
  const [all, setAll] = useState(false);
  const list = watched.list ?? [];
  const cats = CATEGORIES.filter((c) => !list.includes(c.id));
  const chosen = pick && cats.some((c) => c.id === pick) ? pick : null;
  const rest = sorted.filter((d) => !list.includes(d.category));
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
      <ApiState kind="empty" title={chosen ? `Nothing in ${categoryLabel(chosen)} on sale right now` : "Everything on sale is on your watch list"}
        action={chosen ? <Button size="sm" variant="secondary" onClick={() => choose(null)}>Show every category</Button> : undefined}>
        {chosen ? "Watch it, and the first one marked down will sit at the top of your watch list." : "It’s all above."}
      </ApiState>
    );
  } else {
    body = (
      <div className="grid gap-5">
        <DealGrid deals={shown} live={live} isNew={isNew} label={chosen ? `${categoryLabel(chosen)} on sale` : "Everything else on sale"} />
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
      <SectionHeading id="rest-h" eyebrow="Every brand" title={list.length ? "Everything else on sale" : "On sale now"}
        action={live.deals.length ? <p role="status" className="font-numeral text-[1.05rem] font-medium tabular-nums text-ink-2">{matched.length} {matched.length === 1 ? "item" : "items"}</p> : undefined} />
      <Freshness health={health} what="The Pro Shop" />
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
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
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

/** One polite announcement when something in a watched category changes (never the clock, never other categories). */
function WatchAnnouncer({ live, watched }: { live: ShopLive; watched: WatchedState }) {
  const c = live.lastChange;
  let msg = "";
  if (c && watched.isWatching(c.after.category)) {
    const a = c.after;
    const what = `${a.title} from ${brandName(a.brand)}`;
    if (c.kind === "new") msg = `New in ${categoryLabel(a.category)}: ${what}, ${usd(a.price)}, ${a.pct_off}% off.`;
    else if (c.kind === "cheaper") msg = `Price drop: ${what}, now ${usd(a.price)}.`;
    else if (c.kind === "sold-out") msg = `${what} just sold out.`;
    else if (c.kind === "back") msg = `${what} is back in stock, ${usd(a.price)}.`;
  }
  return <p className="sr-only" aria-live="polite">{msg}</p>;
}
