// poll-deals' pure half (parse.ts + catalog.ts) on the saved real feeds: each brand's Shopify /products.json as
// served on 2026-11-02 (body_html removed and full-price products trimmed to 15 per store, to keep the repo small;
// every record kept is exactly as served). If a store renames a field, or a rule starts filing polos under "Bags",
// these fail before the page silently goes wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BRANDS, CATEGORIES, type Brand } from "../poll-deals/catalog.ts";
import { categorize, cdnImage, DEAL_FIELDS, IMAGE_WIDTH, parseProducts, type DealRow } from "../poll-deals/parse.ts";
import { BRANDS as APP_BRANDS, CATEGORIES as APP_CATEGORIES } from "../../../src/lib/live/shop.ts";
import { diffRows } from "../_shared/diff.ts";

const brand = (slug: string): Brand => BRANDS.find((b) => b.slug === slug)!;
const feed = (slug: string) => JSON.parse(readFileSync(new URL(`./fixtures/shopify-${slug}-2026-11-02.json`, import.meta.url), "utf8"));
const parse = (slug: string) => parseProducts(feed(slug), brand(slug));
const all = (): DealRow[] => BRANDS.flatMap((b) => parse(b.slug));

// ───────── Parse ─────────

// One known sale item, field by field: the id joins brand + Shopify id, the price and the "was" price come from the
// variant, the discount is a whole percent, and the link is the brand's own product page.
test("a Bad Birdie hat on sale comes through field by field", () => {
  const hat = parse("bad-birdie").find((r) => r.id === "bad-birdie:10643538084033");
  assert.ok(hat, "Active Bad Hat - Mauve Chalk is in the feed, on sale");
  assert.equal(hat.title, "Active Bad Hat - Mauve Chalk");
  assert.equal(hat.brand, "bad-birdie");
  assert.equal(hat.category, "hats");
  assert.equal(hat.price, 23);
  assert.equal(hat.was_price, 38);
  assert.equal(hat.pct_off, 39); // (38 − 23) / 38 = 39.5% → 39
  assert.equal(hat.available, true);
  assert.equal(hat.url, "https://badbirdiegolf.com/products/active-bad-hat-mauve-chalk");
  assert.match(hat.image ?? "", /^https:\/\/cdn\.shopify\.com\/s\/files\/.+\?width=480$/);
});

// Only real sales: every row has a "was" price above its price, and full-price products (Malbon has none on sale
// today, though its feed answered) give no rows at all. Cents survive (Good Good's $17.50 hat).
test("only products actually on sale become rows, with sane prices", () => {
  assert.equal(parse("malbon").length, 0, "Malbon's 15 full-price products: nothing on sale");
  const rows = all();
  assert.ok(rows.length >= 100, `expected 100+ sale items across the six stores, got ${rows.length}`);
  for (const r of rows) {
    assert.ok(r.price > 0 && r.was_price > r.price, `${r.id}: ${r.price} < ${r.was_price}`);
    assert.ok(r.pct_off >= 5 && r.pct_off <= 90, `${r.id}: ${r.pct_off}%`);
    assert.ok(Math.abs(r.price * 100 - Math.round(r.price * 100)) < 1e-6, `${r.id}: price to the cent`);
  }
  assert.equal(parse("good-good").find((r) => r.title === "Got Game Hat")?.price, 17.5);
});

// The database checks these shapes (shop_deals' check constraints): a row that fails one would fail the whole upsert.
test("every row fits the table's checks: id, brand, url, image, title", () => {
  const ids = new Set<string>();
  for (const r of all()) {
    assert.match(r.id, /^[a-z-]{2,20}:[0-9]{1,20}$/);
    assert.match(r.brand, /^[a-z-]{2,20}$/);
    assert.match(r.url, /^https:\/\/[a-z0-9.-]+\/products\//);
    assert.ok(r.image === null || /^https:\/\/cdn\.shopify\.com\//.test(r.image));
    assert.ok(r.title.length >= 1 && r.title.length <= 140);
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
  }
});

// Stock: a product is "available" if any on-sale variant is in stock; one where none is shows as sold out (a change
// the page highlights), it isn't dropped.
test("sold-out sale items stay, marked unavailable", () => {
  const rope = parse("good-good").find((r) => r.title === "Maroon Rope Hat");
  assert.ok(rope);
  assert.equal(rope.available, false);
  assert.ok(parse("lag-shot").some((r) => !r.available) && parse("lag-shot").some((r) => r.available));
});

// Not things a golfer shops for: app subscriptions, duplicated "(Copy)" listings. Both are in the real feeds.
test("subscriptions and duplicate '(Copy)' listings are filtered out", () => {
  const titles = all().map((r) => r.title);
  assert.ok(!titles.some((t) => /subscription/i.test(t)), "no subscriptions");
  assert.ok(!titles.some((t) => /\(copy\)\s*$/i.test(t)), "no (Copy) duplicates");
  const raw = BRANDS.flatMap((b) => feed(b.slug).products as { title: string }[]).map((p) => p.title);
  assert.ok(raw.some((t) => /subscription/i.test(t)) && raw.some((t) => /\(copy\)/i.test(t)), "the fixtures do contain both");
});

// Images: only Shopify's CDN, at one width, with the ?v= cache-buster dropped (so a store re-saving a photo isn't a change).
test("cdnImage keeps only Shopify's CDN, fixed width, no cache-buster", () => {
  assert.equal(cdnImage("https://cdn.shopify.com/s/files/1/1883/9119/files/x.jpg?v=1792901316"), `https://cdn.shopify.com/s/files/1/1883/9119/files/x.jpg?width=${IMAGE_WIDTH}`);
  assert.equal(cdnImage("//cdn.shopify.com/s/files/1/a.png"), `https://cdn.shopify.com/s/files/1/a.png?width=${IMAGE_WIDTH}`);
  assert.equal(cdnImage("https://evil.example.com/x.jpg"), null);
  assert.equal(cdnImage("http://cdn.shopify.com/x.jpg"), null);
  assert.equal(cdnImage(null), null);
});

// A broken or reshaped feed gives no rows rather than throwing (the run still records ok for the other stores).
test("a malformed feed gives no rows, never a throw", () => {
  const b = brand("seed");
  assert.deepEqual(parseProducts(null, b), []);
  assert.deepEqual(parseProducts({ products: "nope" }, b), []);
  assert.deepEqual(parseProducts({ products: [{ id: 1, title: "x", handle: "x", variants: [{ price: "abc", compare_at_price: "9" }] }] }, b), []);
});

// ───────── Categories ─────────

// What you wear beats what it's named after: these Good Good polos are named for gear.
test("categorize: polos named after gear are still apparel", () => {
  for (const t of ["Divot Polo", "Tees Of Destiny Polo", "Under My Umbrella Polo"]) {
    assert.equal(parse("good-good").find((r) => r.title === t)?.category, "apparel", t);
  }
});

// Real items from each category, from the fixtures (title first, then product_type, then tags, then the brand's fallback).
test("categorize: real items land in the right category", () => {
  const cat = (slug: string, title: string) => parse(slug).find((r) => r.title === title)?.category;
  assert.equal(cat("bad-birdie", "Cosmos Chaos"), "apparel"); // the title says nothing; product_type "Men's Polo" does
  assert.equal(cat("bad-birdie", "Sun Bucket Hat - Prairie Sunset"), "hats");
  assert.equal(cat("seed", "The Feel Pack"), "balls"); // product_type "Bundle - Feel", tag "Balls"
  assert.equal(cat("seed", "The Sunday Carry Bag and Jetset Travel Cover Bundle"), "bags");
  assert.equal(cat("good-good", "Legendary Divot Tool"), "bags");
  assert.equal(cat("good-good", "Good Good x Yeti Hopper M12 Backpack Cooler Navy"), "bags");
  assert.equal(cat("superspeed", "PRGR Portable Launch Monitor (HS130A)"), "training");
  assert.equal(cat("lag-shot", "Baby Putter"), "training"); // nothing matches: Lag Shot's fallback (swing trainers)
});

// The rules on their own: "tee" is a shirt, "tees" are golf tees, "ball marker" is gear, unknown → the fallback.
test("categorize: the tricky words", () => {
  assert.equal(categorize({ title: "Youth Bad Tee" }, "other"), "apparel");
  assert.equal(categorize({ title: "Bamboo Tees 50-pack" }, "other"), "bags");
  assert.equal(categorize({ title: "Magnetic Ball Marker" }, "other"), "bags");
  assert.equal(categorize({ title: "Pro V1 Golf Balls" }, "other"), "balls");
  assert.equal(categorize({ title: "Mystery Box" }, "other"), "other");
  assert.equal(categorize({ title: "Mystery Box", type: "Hats" }, "other"), "hats");
});

// Every row's category is one the database (and the page's chips) knows.
test("every category is in the fixed set", () => {
  const ids = new Set(CATEGORIES.map((c) => c.id));
  for (const r of all()) assert.ok(ids.has(r.category), `${r.id}: ${r.category}`);
});

// The app keeps its own copy of the two lists (supabase/ is outside its tsconfig): they must not drift.
test("the app's copy of the brands and categories matches the worker's", () => {
  assert.deepEqual(APP_CATEGORIES, CATEGORIES);
  assert.deepEqual(APP_BRANDS.map(({ slug, name, domain }) => ({ slug, name, domain })), BRANDS.map(({ slug, name, domain }) => ({ slug, name, domain })));
});

// ───────── Diff (only real changes are written) ─────────

// The same feeds twice: nothing to write, nothing to delete, so a quiet store costs no Realtime messages.
test("diff: the same feeds twice → 0 upserts, 0 deletes", () => {
  const first = all();
  const d = diffRows<DealRow, "id">(first, all(), "id", DEAL_FIELDS);
  assert.equal(d.upserts.length, 0);
  assert.equal(d.deletes.length, 0);
});

// What the database sends back (numeric columns come back as strings, e.g. "23.00") must not look like a change.
test("diff: a database round-trip (numbers as strings) is not a change", () => {
  const rows = parse("bad-birdie");
  const saved = rows.map((r) => ({ ...r, price: r.price.toFixed(2), was_price: r.was_price.toFixed(2) })) as unknown as DealRow[];
  assert.equal(diffRows<DealRow, "id">(saved, rows, "id", DEAL_FIELDS).upserts.length, 0);
});

// The three live changes the page shows: a price drop, selling out, a sale ending (its row deleted). Built from the
// real feed by editing it the way a store would; only the touched rows are written.
test("diff: a price drop, a sell-out and an ended sale → exactly those rows", () => {
  const before = feed("bad-birdie");
  const after = structuredClone(before);
  const find = (id: number) => after.products.find((p: { id: number }) => p.id === id);
  // 1. Price drop: the Mauve Chalk hat goes from $23 to $19.
  for (const v of find(10643538084033).variants) v.price = "19.00";
  // 2. Sell-out: every variant of Cosmos Chaos.
  for (const v of find(10710283026625).variants) v.available = false;
  // 3. Sale over: Bad Snapback - Dove back to full price.
  for (const v of find(10710279389377).variants) v.compare_at_price = null;
  // 4. Noise a store makes all the time: a re-saved product (updated_at, the image's ?v=). Not a change.
  for (const p of after.products) { p.updated_at = "2026-11-02T23:59:59-08:00"; for (const i of p.images) i.src = i.src.replace(/\?v=\d+/, "?v=1"); }

  const b = brand("bad-birdie");
  const d = diffRows<DealRow, "id">(parseProducts(before, b), parseProducts(after, b), "id", DEAL_FIELDS);
  assert.deepEqual(d.upserts.map((r) => r.id).sort(), ["bad-birdie:10643538084033", "bad-birdie:10710283026625"]);
  assert.equal(d.upserts.find((r) => r.id === "bad-birdie:10643538084033")?.price, 19);
  assert.equal(d.upserts.find((r) => r.id === "bad-birdie:10710283026625")?.available, false);
  assert.deepEqual(d.deletes, [{ id: "bad-birdie:10710279389377" }]);
});
