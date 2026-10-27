// Contract for the built-in course library. One JSON file per course in src/data/courses/<slug>.json,
// images in public/courses/<slug>/. Checked by `node scripts/check-courses.mjs`.

export type Source = "published" | "estimated";

export type Tee = {
  name: string; // "Championship", "Blue", "White"…
  color: string; // a hex for the tee marker swatch
  par: number;
  yards: number; // total yards from this tee
  rating: number; // course rating, e.g. 72.4 (men's)
  slope: number; // 55–155
  source: Source; // "estimated" when no published USGA/WHS rating exists (e.g. Augusta National)
};

export type Hole = {
  n: number; // 1…18
  par: 3 | 4 | 5 | 6;
  yards: number; // from the first tee in `tees`
  hcp: number; // stroke index 1…18 (or 1…9), each used once
  name?: string; // e.g. Augusta's "Tea Olive", St Andrews' "Road"
};

export type CourseImage = {
  src: string; // /courses/<slug>/hero.jpg
  alt: string; // specific: what's in the photo
  credit: string; // author
  license: string; // "CC BY-SA 4.0", "Public domain"…
  sourceUrl: string; // the file page, e.g. on Wikimedia Commons
};

export type Course = {
  slug: string; // kebab-case, matches the file name
  name: string; // "Pebble Beach Golf Links"
  shortName: string; // "Pebble Beach" (≤ 18 characters)
  city: string;
  region: string; // state, or "Fife" in Scotland
  country: "USA" | "Scotland";
  access: "public" | "resort" | "private";
  established?: number;
  architect?: string;
  tags: string[]; // from: "major-host", "links", "parkland", "coastal", "desert", "home", "bucket-list"
  blurb: string; // ≤ 40 words, factual, no hype
  signatureHole?: number;
  holes: Hole[]; // 18 (or 9) holes in order
  tees: Tee[]; // 2–4 tees, longest first
  hero: CourseImage | null; // null only if no freely licensed photo exists; the UI draws an illustration instead
  gallery: CourseImage[]; // 0–3 more
  dataNotes: string; // what's verified and what's estimated
  sources: string[]; // URLs for the scorecard, ratings, and facts
  // Optional, for courses you add: built-in courses keep theirs in src/data/course-geo.ts.
  geo?: { lat: number; lng: number } | null; // for the weather; none for a course entered by hand
  openGolfId?: string | null; // set when the course was filled from OpenGolfAPI
};
