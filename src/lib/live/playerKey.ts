// The app's copy of the worker's playerKey (supabase/functions/_shared/keys.ts). supabase/ is outside the app's
// tsconfig, so this is a copy, not an import. supabase/functions/tests/keys.test.ts fails if the two ever disagree.
// Change both together.
// Letters NFKD can't split into a base letter + accent (Højgaard, Ærø, Strauß…).
const FOLD: Record<string, string> = { "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "đ": "d", "ð": "d", "þ": "th", "ł": "l", "ı": "i", "ħ": "h" };

/**
 * A player's name as a stable key: lowercased, accents stripped, every run of non-letters turned into one `-`,
 * no leading/trailing `-`, at most 80 characters. "Scottie Scheffler" → "scottie-scheffler",
 * "Rasmus Højgaard" → "rasmus-hojgaard", "J.J. Spaun" → "j-j-spaun". A name with no letters gives "".
 */
export function playerKey(name: string): string {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[øæœßđðþłıħ]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
