// Turn the add-a-course form into a Course, filled from OpenGolfAPI or typed by hand. Whatever is estimated says so.
import type { CourseDetail } from "@/lib/api/types";
import type { Course, Hole, Tee } from "@/lib/course-types";
import { slugify, type CourseDraft, type ImportedCourse } from "@/lib/validate";

export const FRONT_NINE = [4, 4, 3, 5, 4, 4, 3, 4, 5]; // par 36
export const PAR_72 = [...FRONT_NINE, ...FRONT_NINE];

const TYPICAL: Record<number, number> = { 3: 165, 4: 390, 5: 520, 6: 620 };

const TEE_COLORS: [RegExp, string][] = [
  [/black/i, "#1a1a1a"], [/blue/i, "#1f4fa3"], [/white/i, "#f2f2f2"], [/red/i, "#b3262b"], [/gold|yellow/i, "#d4a017"],
  [/green/i, "#2b5e46"], [/silver|grey|gray/i, "#a8a8a8"], [/orange/i, "#e07a1f"], [/purple/i, "#5b3a8a"],
];

/** Split total yards across holes in proportion to typical lengths for each par. Sums exactly. */
function yardsFor(pars: number[], total: number | null): number[] {
  const typical = pars.map((p) => TYPICAL[p] ?? 390);
  if (total == null) return typical;
  const sum = typical.reduce((a, b) => a + b, 0);
  const out = typical.map((t) => Math.round((t * total) / sum));
  const diff = total - out.reduce((a, b) => a + b, 0);
  const longest = out.indexOf(Math.max(...out));
  out[longest] += diff;
  return out;
}

/**
 * Stroke indexes the way committees usually do it: hardest first (long par 4s, then par 5s, then par 3s),
 * odd numbers on the front nine and even on the back, so strokes spread across the round.
 */
function strokeIndexes(pars: number[], yards: number[]): number[] {
  const weight = (i: number) => (pars[i] === 4 ? 2000 : pars[i] >= 5 ? 1000 : 0) + yards[i];
  const order = (idx: number[]) => [...idx].sort((a, b) => weight(b) - weight(a));
  const out = new Array<number>(pars.length);
  if (pars.length === 18) {
    order([0, 1, 2, 3, 4, 5, 6, 7, 8]).forEach((h, k) => (out[h] = 2 * k + 1));
    order([9, 10, 11, 12, 13, 14, 15, 16, 17]).forEach((h, k) => (out[h] = 2 * k + 2));
  } else {
    order(pars.map((_, i) => i)).forEach((h, k) => (out[h] = k + 1));
  }
  return out;
}

const shorten = (name: string) => {
  const s = name.replace(/\s+(golf course|golf club|golf links|country club|golf & country club|municipal golf course)$/i, "").trim();
  return s.length <= 18 ? s : s.slice(0, 17).trimEnd() + "…";
};

const TEE_WORD_HEX = (t: string) => TEE_COLORS.find(([re]) => re.test(t))?.[1] ?? "#7d7566";

/** Stroke indexes from the club's card, as 1…n for the holes kept; null when they're missing or don't rank. */
function cardIndexes(hcps: number[] | null | undefined, n: number): number[] | null {
  if (!hcps || hcps.length < n) return null;
  const h = hcps.slice(0, n);
  if (h.some((x) => !Number.isFinite(x) || x < 1)) return null;
  if (new Set(h).size !== n) return null;
  // Already 1…n (a full card), or rank them (the front nine of an 18-hole card: 1, 3, 5… become 1, 2, 3…).
  const order = h.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(n);
  order.forEach(([, i], k) => (out[i] = k + 1));
  return out;
}

/** OpenGolfAPI's tees → one per name (men's rating where there are two), longest first. */
export function teesFrom(d: CourseDetail): ImportedCourse["tees"] {
  const byName = new Map<string, ImportedCourse["tees"][number]>();
  for (const t of [...d.tees].sort((a, b) => (a.gender === "F" ? 1 : 0) - (b.gender === "F" ? 1 : 0))) {
    const k = t.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, { name: t.name, color: t.color, rating: t.rating, slope: t.slope, par: t.par, yards: t.yards });
  }
  return [...byName.values()].sort((a, b) => (b.yards ?? 0) - (a.yards ?? 0)).slice(0, 6);
}

/** Fill the form from an OpenGolfAPI course: name, place, holes, par per hole, stroke index, and the tees. */
export function draftFrom(d: CourseDetail, prev: CourseDraft): CourseDraft {
  const holes = [...d.holes].sort((a, b) => a.n - b.n);
  const count = holes.length === 9 || d.holeCount === 9 ? 9 : 18;
  const pars = holes.length >= count && holes.slice(0, count).every((h) => h.par != null && h.par >= 3 && h.par <= 6)
    ? holes.slice(0, count).map((h) => h.par!)
    : count === 9 ? FRONT_NINE : PAR_72;
  const tees = teesFrom(d);
  const holeYards: Record<string, number[]> = {};
  for (const t of tees) {
    const k = t.name.toLowerCase();
    const ys = holes.slice(0, count).map((h) => h.yards[k]);
    if (ys.every((y) => typeof y === "number")) holeYards[k] = ys;
  }
  // Start on a middle tee (the one nearest 6,300 yards), the way most golfers would pick.
  const pick = [...tees].filter((t) => t.yards).sort((a, b) => Math.abs((a.yards ?? 0) - 6300) - Math.abs((b.yards ?? 0) - 6300))[0] ?? tees[0];
  return {
    ...prev,
    name: titleCase(d.name),
    city: [d.city, d.state].filter(Boolean).join(", "),
    holes: count === 9 ? "9" : "18",
    pars,
    teeName: pick?.name ?? "",
    rating: pick?.rating != null ? String(pick.rating) : "",
    slope: pick?.slope != null ? String(pick.slope) : "",
    yards: pick?.yards != null ? String(pick.yards) : "",
    imported: {
      id: d.id, name: d.name, region: d.state, geo: d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null,
      architect: d.architect, yearBuilt: d.yearBuilt, tees, hcps: holes.length >= count ? holes.slice(0, count).map((h) => h.hcp ?? NaN) : null, holeYards,
    },
  };
}

// OpenGolfAPI names some courses in capitals or as "Tpc Sawgrass": tidy only the all-caps ones.
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

export function buildCourse(d: CourseDraft, takenSlugs: string[]): Course {
  const name = d.name.trim();
  const base = `custom-${slugify(name) || "course"}`;
  let slug = base;
  for (let k = 2; takenSlugs.includes(slug); k++) slug = `${base}-${k}`;
  const pars = d.pars.slice(0, d.holes === "9" ? 9 : 18);
  const par = pars.reduce((a, b) => a + b, 0);
  const imp = d.imported ?? null;
  const teeName = d.teeName.trim() || "Regular";
  const total = d.yards.trim() ? Number(d.yards) : null;
  const rating = d.rating.trim() ? Number(d.rating.trim().replace(",", ".")) : null;
  const slope = d.slope.trim() ? Number(d.slope) : null;
  const estimatedRating = rating == null || slope == null;

  // The golfer's tee, as they left it in the form (blank rating/slope → par and 113, marked estimated).
  const mine: Tee = { name: teeName, color: TEE_WORD_HEX(teeName), par, yards: 0, rating: rating ?? par, slope: slope ?? 113, source: estimatedRating ? "estimated" : "published" };
  // The other tees OpenGolfAPI listed come along, so the course is ready for a partner on another tee.
  const others: Tee[] = (imp?.tees ?? [])
    .filter((t) => t.name.toLowerCase() !== teeName.toLowerCase() && t.yards)
    .map((t) => ({ name: t.name, color: TEE_WORD_HEX(t.color ?? t.name), par, yards: t.yards!, rating: t.rating ?? par, slope: t.slope ?? 113, source: t.rating != null && t.slope != null ? "published" : "estimated" }));

  // Hole yards: the card's own numbers for my tee when we have them, else my total split by par, else typical lengths.
  const cardYards = imp?.holeYards[teeName.toLowerCase()];
  const yards = cardYards && cardYards.length >= pars.length && total == null ? cardYards.slice(0, pars.length) : cardYards && cardYards.length >= pars.length && total === sum(cardYards.slice(0, pars.length)) ? cardYards.slice(0, pars.length) : yardsFor(pars, total);
  mine.yards = sum(yards);
  const tees = [mine, ...others].sort((a, b) => b.yards - a.yards);
  // Holes list the first (longest) tee's yards, as the built-in courses do.
  const first = tees[0];
  const firstYards = first === mine ? yards : imp?.holeYards[first.name.toLowerCase()]?.slice(0, pars.length) ?? yards.map((y) => Math.round((y * first.yards) / mine.yards));
  const cardHcp = cardIndexes(imp?.hcps, pars.length);
  const hcp = cardHcp ?? strokeIndexes(pars, yards);
  const holes: Hole[] = pars.map((p, i) => ({ n: i + 1, par: p as Hole["par"], yards: firstYards[i], hcp: hcp[i] }));

  const notes: string[] = [];
  if (imp) notes.push(`Filled from OpenGolfAPI (© OpenStreetMap contributors, ODbL 1.0) and checked by you: par per hole${cardHcp ? ", stroke indexes" : ""}${cardYards ? ", hole yards" : ""}, and the tees.`);
  else notes.push(`You added this course. The par for each hole is as you entered it.`);
  if (estimatedRating) notes.push(`No ${rating == null && slope == null ? "rating or slope" : rating == null ? "rating" : "slope"} was given for the ${teeName} tees, so we use ${rating == null ? `par (${par})` : rating} and a slope of ${slope ?? 113}${slope == null ? " (average)" : ""}. Your differentials here are estimates (marked “est.”) until you add the card's numbers.`);
  if (!cardYards) notes.push(total != null ? `Hole yards are estimated: your total of ${total.toLocaleString("en-US")} yards is split across the holes by par.` : "Hole yards are estimated from typical lengths (165 for a par 3, 390 for a par 4, 520 for a par 5).");
  if (!cardHcp) notes.push("Stroke indexes are estimated (the longer par 4s rank hardest; odd numbers on the front nine, even on the back). Check them against the club's card.");

  return {
    slug,
    name,
    shortName: shorten(name),
    city: d.city.trim(),
    region: "",
    country: "USA", // the type allows USA or Scotland; "yours" keeps custom courses out of those filters
    access: "public",
    ...(imp?.architect ? { architect: imp.architect } : {}),
    ...(imp?.yearBuilt ? { established: imp.yearBuilt } : {}),
    tags: ["yours"],
    blurb: `Added by you. ${pars.length} holes, par ${par}, from the ${teeName} tees.`,
    holes,
    tees,
    hero: null,
    gallery: [],
    dataNotes: notes.join(" "),
    sources: imp ? [`https://api.opengolfapi.org/api/v1/courses/${imp.id}`] : [],
    geo: imp?.geo ?? null,
    openGolfId: imp?.id ?? null,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
