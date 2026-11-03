// poll-deals' pure half: one brand's Shopify /products.json → the rows of what it has on sale. No Deno or npm imports,
// so the Node tests (supabase/functions/tests/deals.test.ts) import it directly. Every field is read defensively: a
// missing or odd field skips that product (or that variant), never throws.
//
// "On sale" = a variant whose compare_at_price is above its price by at least MIN_PCT_OFF (Shopify's own "was" price;
// a 2% "sale" is noise). One row per product: its best on-sale variant, preferring one in stock.
// Coarsened before comparing: prices to the cent, the discount to a whole percent, stock to one boolean, the image to a
// fixed-width CDN URL without its cache-buster, so a store re-saving a product (Shopify bumps updated_at and ?v= all the
// time) is not a change and costs no Realtime message.
import type { Brand, CategoryId } from "./catalog.ts";

export type DealRow = {
  /** `${brand}:${Shopify product id}`, e.g. "bad-birdie:10643538084033". */
  id: string;
  brand: string;
  title: string;
  category: CategoryId;
  /** The sale price, USD (all six stores sell in USD; checked via /meta.json on 2026-11-02). */
  price: number;
  /** Shopify's compare_at_price: what it was. */
  was_price: number;
  /** Whole percent off, 5–90. */
  pct_off: number;
  /** Any on-sale variant in stock. Selling out flips this (a change the page shows), it doesn't delete the row. */
  available: boolean;
  /** https://cdn.shopify.com/…?width=480, or null. */
  image: string | null;
  /** The brand's own product page (we link straight to it). */
  url: string;
};

/** The columns diffRows compares (never first_seen_at / updated_at, which the database and the worker stamp). */
export const DEAL_FIELDS = ["brand", "title", "category", "price", "was_price", "pct_off", "available", "image", "url"] as const;

export const MIN_PCT_OFF = 5;
export const MAX_PCT_OFF = 90;
export const IMAGE_WIDTH = 480;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
};

/** Not something a golfer shops for: gift cards, app subscriptions, digital downloads, and duplicated listings. */
const SKIP_TITLE = /gift ?card|subscription|e-?gift|\(copy\)\s*$/i;
const SKIP_TYPE = /^(digital|gift ?card)$/i;

/** One brand's feed → its sale rows (sorted by id, so the same feed always gives the same array). */
export function parseProducts(json: unknown, brand: Brand): DealRow[] {
  const out = new Map<string, DealRow>();
  for (const p of arr(obj(json).products)) {
    const row = parseProduct(obj(p), brand);
    if (row) out.set(row.id, row);
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function parseProduct(p: Obj, brand: Brand): DealRow | null {
  const pid = typeof p.id === "number" || typeof p.id === "string" ? String(p.id) : null;
  const title = str(p.title)?.replace(/\s+/g, " ");
  const handle = str(p.handle);
  if (!pid || !/^\d{1,20}$/.test(pid) || !title || !handle) return null;
  const type = str(p.product_type) ?? "";
  if (SKIP_TITLE.test(title) || SKIP_TYPE.test(type)) return null;

  // The on-sale variants, each with its discount.
  type Sale = { price: number; was: number; pct: number; available: boolean; image: string | null };
  const sales: Sale[] = [];
  for (const v of arr(p.variants).map(obj)) {
    const price = money(v.price);
    const was = money(v.compare_at_price);
    if (price == null || was == null || was <= price) continue;
    const pct = Math.round(((was - price) / was) * 100);
    if (pct < MIN_PCT_OFF || pct > MAX_PCT_OFF) continue;
    sales.push({ price, was, pct, available: v.available === true, image: str(obj(v.featured_image).src) });
  }
  if (!sales.length) return null;

  // The headline: in stock beats sold out, then the deepest cut, then the lower price.
  sales.sort((a, b) => Number(b.available) - Number(a.available) || b.pct - a.pct || a.price - b.price);
  const best = sales[0];
  const image = cdnImage(best.image ?? str(obj(arr(p.images)[0]).src));
  if (!image) return null; // a card with no picture isn't worth showing; Shopify products nearly always have one

  return {
    id: `${brand.slug}:${pid}`,
    brand: brand.slug,
    title: title.slice(0, 140),
    category: categorize({ title, type, tags: arr(p.tags).map((t) => (typeof t === "string" ? t : "")) }, brand.fallback),
    price: best.price,
    was_price: best.was,
    pct_off: best.pct,
    available: sales.some((s) => s.available),
    image,
    url: `https://${brand.domain}/products/${encodeURIComponent(handle)}`,
  };
}

/** Only Shopify's CDN (the pages load these directly), at a fixed width, without the ?v= cache-buster. */
export function cdnImage(src: string | null): string | null {
  if (!src) return null;
  let u: URL;
  try { u = new URL(src.startsWith("//") ? `https:${src}` : src); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "cdn.shopify.com") return null;
  return `https://cdn.shopify.com${u.pathname}?width=${IMAGE_WIDTH}`;
}

// ───────── Categories ─────────

// Checked in this order, against the title first, then product_type, then the tags (the first text that matches any
// rule wins). Order matters: what you wear beats what it's named after ("Divot Polo", "Tees Of Destiny Polo" are
// polos), and gear beats balls ("ball marker"). "Tee" alone is a T-shirt; "tees" are golf tees.
const RULES: [CategoryId, RegExp][] = [
  ["hats", /\b(hats?|caps?|snapbacks?|visors?|beanies?|bucket hat|headwear|trucker)\b/i],
  ["apparel", /\b(polos?|shirts?|t-shirts?|tee|shorts?|skorts?|skirts?|pants?|joggers?|q-zip|quarter ?zips?|quarterzips?|hoodies?|crew ?necks?|sweaters?|sweatshirts?|sweatpants?|pullovers?|jackets?|vests?|dress(es)?|socks?|shoes?|mocknecks?|cardigans?|anoraks?|puffers?|base layers?|outerwear|windbreakers?|fleece)\b/i],
  ["bags", /\b(ball markers?|divot( tools?)?|head ?covers?|towels?|umbrellas?|tees|belts?|gloves?|bags?|backpacks?|coolers?|travel cover|accessor(y|ies)|gear)\b/i],
  ["balls", /\b(golf balls?|balls?|dozen|loosies)\b/i],
  ["training", /\b(training|trainers?|swing|speed sticks?|launch monitor|aids?|practice|alignment)\b/i],
];

/** A product's category from its title, product_type and tags; the brand's fallback if nothing matches. */
export function categorize(p: { title: string; type?: string; tags?: readonly string[] }, fallback: CategoryId): CategoryId {
  for (const text of [p.title, p.type ?? "", (p.tags ?? []).join(" ")]) {
    if (!text) continue;
    for (const [id, re] of RULES) if (re.test(text)) return id;
  }
  return fallback;
}
