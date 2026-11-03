"use client";
// The live desk's bottom half (LiveDesk.tsx): a quiet Pro Shop teaser. One snapshot of shop_deals, two small reads in
// parallel: every row's brand (to say "138 items on sale from 6 brands") and the single deepest in-stock markdown. No
// Realtime here: the shop page itself is live. LiveDesk gives the card, padding and a flex column; this is the contents.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowIcon, cx } from "@/components/ui";
import { useSupabaseBrowser } from "@/lib/live/browser";
import { brandName } from "@/lib/live/shop";

type Top = { id: string; brand: string; title: string; price: number | string; was_price: number | string; pct_off: number; image: string | null; url: string };
type State = { load: "loading" } | { load: "empty" } | { load: "ready"; items: number; brands: number; top: Top };

const usd = (v: number | string) => {
  const n = Number(v);
  return `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2)}`;
};

export function HomeShop() {
  const db = useSupabaseBrowser();
  const [state, setState] = useState<State>({ load: "loading" });

  useEffect(() => {
    if (!db) return;
    let live = true;
    (async () => {
      try {
        const [all, best] = await Promise.all([
          db.from("shop_deals").select("brand").limit(1000).returns<{ brand: string }[]>(),
          db.from("shop_deals").select("id, brand, title, price, was_price, pct_off, image, url")
            .eq("available", true).order("pct_off", { ascending: false }).order("price", { ascending: true }).limit(1).returns<Top[]>(),
        ]);
        if (!live) return;
        const rows = all.data ?? [];
        const top = best.data?.[0];
        if (all.error || best.error || !rows.length || !top) { setState({ load: "empty" }); return; }
        setState({ load: "ready", items: rows.length, brands: new Set(rows.map((r) => r.brand)).size, top });
      } catch {
        if (live) setState({ load: "empty" });
      }
    })();
    return () => { live = false; };
  }, [db]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <h3 className="caps text-label text-gold-ink">Pro Shop</h3>
      <div aria-live="polite" className="min-w-0">
        {state.load === "loading" ? (
          <Skeleton />
        ) : state.load === "empty" ? (
          <p className="mt-1 font-serif text-[1.15rem] font-bold leading-snug text-ink">Nothing on sale right now</p>
        ) : (
          <>
            <p className="mt-1 text-balance font-serif text-[1.15rem] font-bold leading-snug text-ink sm:text-[1.25rem]">
              <span className="font-numeral tabular-nums">{state.items}</span> {state.items === 1 ? "item" : "items"} on sale from{" "}
              <span className="font-numeral tabular-nums">{state.brands}</span> {state.brands === 1 ? "brand" : "brands"}
            </p>
            <Highlight d={state.top} />
          </>
        )}
      </div>
      <Link
        href="/clubhouse/shop"
        className="mt-auto inline-flex min-h-tap items-center gap-2 self-start pt-4 font-semibold text-green underline-offset-4 is-hover:underline"
      >
        <span>Check out the Pro Shop</span>
        <ArrowIcon />
      </Link>
    </div>
  );
}

/** The deepest cut in stock: a small photo, the brand, the title, and the price against what it was. */
function Highlight({ d }: { d: Top }) {
  const brand = brandName(d.brand);
  return (
    <a
      href={d.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-4 flex min-w-0 items-center gap-3 rounded-lg border border-rule bg-paper-2 p-2 pr-3 transition-colors duration-150 is-hover:border-green"
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-md border border-rule bg-white sm:size-18">
        {d.image ? (
          // The brand's own product photo from Shopify's CDN, as on the shop page (a plain img, lazy). Its alt is empty
          // on purpose: the link's own text already names the product, so a screen reader would hear it twice.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image} alt="" width={480} height={480} loading="lazy" decoding="async" className="size-full object-contain p-1" />
        ) : null}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="caps truncate text-label text-gold-ink">{brand}</span>
        <span className="truncate font-serif text-[1rem] font-bold leading-snug text-ink group-hover:underline">{d.title}</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-numeral text-[1.15rem] font-semibold leading-none tabular-nums text-ink">{usd(d.price)}</span>
          <s className="font-numeral text-[0.92rem] tabular-nums text-ink-2"><span className="sr-only">was </span>{usd(d.was_price)}</s>
          <span className="font-numeral text-[0.98rem] font-semibold tabular-nums text-under">
            <span aria-hidden="true">−{d.pct_off}%</span>
            <span className="sr-only">, {d.pct_off}% off</span>
          </span>
        </span>
        <span className="sr-only">Biggest markdown right now. Opens {brand}&rsquo;s store in a new tab.</span>
      </span>
    </a>
  );
}

function Skeleton() {
  const bar = "animate-pulse rounded-xs bg-paper-3 motion-reduce:animate-none";
  return (
    <div role="status" className="min-w-0">
      <span className="sr-only">Loading what&rsquo;s on sale in the Pro Shop</span>
      <div aria-hidden="true">
        <div className={cx(bar, "mt-2 h-6 w-4/5 max-w-72")} />
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-rule p-2">
          <div className={cx(bar, "size-16 shrink-0 rounded-md sm:size-18")} />
          <div className="grid min-w-0 flex-1 gap-2">
            <div className={cx(bar, "h-3 w-1/3")} />
            <div className={cx(bar, "h-4 w-3/4")} />
            <div className={cx(bar, "h-4 w-1/2")} />
          </div>
        </div>
      </div>
    </div>
  );
}
