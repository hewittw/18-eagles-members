// The Pro Shop's two fixed lists: the brands we read and the categories a golfer can watch. Pure (no Deno or npm
// imports), so the Node tests import it. The app keeps an identical copy in src/lib/live/shop.ts (supabase/ is outside
// the app's tsconfig); deals.test.ts fails if the two ever disagree. The category ids are also the database's check
// constraint (shop_deals.category, watched_categories.category): change all three together, with a migration.
//
// Every brand here passed the terms check on 2026-11-02 (docs/credits.md, "Pro Shop"): its robots.txt doesn't block
// /products.json and its terms of service don't forbid automated access or showing its products elsewhere. Stores whose
// terms do (Snell, Vice, Sunday, Stitch, Seamus, LAB, Bettinardi, Evnroll, Blue Tees, Greyson…) are deliberately absent.

export type Brand = {
  /** Our id, in shop_deals.brand and the row id ("bad-birdie:10643538084033"). */
  slug: string;
  name: string;
  /** The storefront: the feed is https://{domain}/products.json, the product page https://{domain}/products/{handle}. */
  domain: string;
  /** What the brand mostly sells, for a product no keyword places (Lag Shot's "XL™ Wedge" is a swing trainer). */
  fallback: CategoryId;
};

export const BRANDS: readonly Brand[] = [
  { slug: "bad-birdie", name: "Bad Birdie", domain: "badbirdiegolf.com", fallback: "apparel" },
  { slug: "good-good", name: "Good Good Golf", domain: "goodgoodgolf.com", fallback: "apparel" },
  { slug: "lag-shot", name: "Lag Shot", domain: "lagshotgolf.com", fallback: "training" },
  { slug: "malbon", name: "Malbon Golf", domain: "malbon.com", fallback: "apparel" },
  { slug: "seed", name: "Seed Golf", domain: "seedgolf.co", fallback: "balls" },
  { slug: "superspeed", name: "SuperSpeed Golf", domain: "superspeedgolf.com", fallback: "training" },
];

export type CategoryId = "apparel" | "hats" | "balls" | "bags" | "training" | "other";

export const CATEGORIES: readonly { id: CategoryId; label: string }[] = [
  { id: "apparel", label: "Apparel" },
  { id: "hats", label: "Hats" },
  { id: "balls", label: "Balls" },
  { id: "bags", label: "Bags & gear" },
  { id: "training", label: "Training aids" },
  { id: "other", label: "Other" },
];
