// The app's copy of the Pro Shop's two fixed lists (the worker's is supabase/functions/poll-deals/catalog.ts;
// supabase/ is outside the app's tsconfig, so this is a copy, not an import). supabase/functions/tests/deals.test.ts
// fails if the two ever disagree. The category ids are also the database's check constraint: change all three together.

export type CategoryId = "apparel" | "hats" | "balls" | "bags" | "training" | "other";

export const BRANDS: readonly { slug: string; name: string; domain: string }[] = [
  { slug: "bad-birdie", name: "Bad Birdie", domain: "badbirdiegolf.com" },
  { slug: "good-good", name: "Good Good Golf", domain: "goodgoodgolf.com" },
  { slug: "lag-shot", name: "Lag Shot", domain: "lagshotgolf.com" },
  { slug: "malbon", name: "Malbon Golf", domain: "malbon.com" },
  { slug: "seed", name: "Seed Golf", domain: "seedgolf.co" },
  { slug: "superspeed", name: "SuperSpeed Golf", domain: "superspeedgolf.com" },
];

export const CATEGORIES: readonly { id: CategoryId; label: string }[] = [
  { id: "apparel", label: "Apparel" },
  { id: "hats", label: "Hats" },
  { id: "balls", label: "Balls" },
  { id: "bags", label: "Bags & gear" },
  { id: "training", label: "Training aids" },
  { id: "other", label: "Other" },
];

export const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
export const brandName = (slug: string) => BRANDS.find((b) => b.slug === slug)?.name ?? slug;
export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
