// Form validation. Every message sits next to its field and says what to do next.
import { todayISO } from "./store";

export type Errors<K extends string> = Partial<Record<K, string>>;

/** Parse a Handicap Index as golfers write it: "12.4", "+1.2" (a plus handicap), "0". */
export function parseIndex(raw: string): { value: number | null; error?: string } {
  const t = raw.trim().replace(",", ".");
  if (!t) return { value: null, error: "Enter your Handicap Index, like 12.4. Or choose “Not yet”." };
  const plus = t.startsWith("+");
  const n = Number(plus ? t.slice(1) : t);
  if (!Number.isFinite(n)) return { value: null, error: "Use numbers only, like 12.4 (a plus handicap is written +1.2)." };
  const v = plus ? -n : n;
  if (v < -10 || v > 54) return { value: null, error: "A Handicap Index runs from +10.0 to 54.0. Check the number on your GHIN card." };
  return { value: Math.round(v * 10) / 10 };
}

export function validateDate(d: string): string | undefined {
  if (!d) return "Pick the date you played.";
  if (d > todayISO()) return "Pick today or an earlier date. Rounds can't be logged ahead of time.";
  return undefined;
}

export function validateStrokes(raw: string, par: number): string | undefined {
  if (!raw.trim()) return "Enter your score for this hole.";
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return "Enter a whole number of strokes, 1 or more.";
  if (n > Math.max(15, par + 10)) return `That's more than ${Math.max(15, par + 10)}. Enter the strokes you counted for this hole.`;
  return undefined;
}

export function validateTotal(raw: string, holes: number): string | undefined {
  if (!raw.trim()) return "Enter your total score, or switch to hole by hole.";
  const n = Number(raw);
  if (!Number.isInteger(n)) return "Enter your total as a whole number, like 88.";
  const lo = holes === 9 ? 25 : 50, hi = holes === 9 ? 90 : 180;
  if (n < lo || n > hi) return `For ${holes} holes, enter a total between ${lo} and ${hi}.`;
  return undefined;
}

export function puttsError(putts: number | null, strokes: number | null): string | undefined {
  if (putts == null || strokes == null) return undefined;
  if (putts > strokes) return `Putts can't be more than your score of ${strokes}. Lower putts or raise the score.`;
  return undefined;
}

// ---------- add a course ----------
/** What "Find your course" brought back from OpenGolfAPI, kept in the draft so a reload keeps it too. */
export type ImportedCourse = {
  id: string; // OpenGolfAPI id
  name: string; // as OpenGolfAPI names it
  region: string | null; // "CA"
  geo: { lat: number; lng: number } | null;
  architect: string | null;
  yearBuilt: number | null;
  tees: { name: string; color: string | null; rating: number | null; slope: number | null; par: number | null; yards: number | null }[];
  hcps: number[] | null; // stroke index per hole, from the club's card
  holeYards: Record<string, number[]>; // tee name, lowercase → yards per hole
};

export type CourseDraft = {
  name: string;
  city: string;
  holes: "18" | "9";
  pars: number[]; // per hole, a standard par-72 (or 36) layout until changed
  teeName: string;
  rating: string;
  slope: string;
  yards: string;
  imported?: ImportedCourse | null;
};

export type CourseField = "name" | "city" | "pars" | "teeName" | "rating" | "slope" | "yards";

/**
 * Only the name is required (par per hole starts as a standard layout). Everything else is optional: blank rating
 * and slope become par and 113, marked estimated, and blank yards use typical lengths. What's typed must make sense.
 */
export function validateCourse(d: CourseDraft, takenNames: string[]): Errors<CourseField> {
  const e: Errors<CourseField> = {};
  const par = d.pars.reduce((a, b) => a + b, 0);
  if (!d.name.trim()) e.name = "Enter the course name, like “Balboa Park Golf Course”.";
  else if (takenNames.some((n) => n.toLowerCase() === d.name.trim().toLowerCase())) e.name = "You already have a course with this name. Add the tees or a nickname to tell them apart.";
  if (d.pars.some((p) => p < 3 || p > 6)) e.pars = "Each hole's par must be 3, 4, 5, or 6.";
  const r = Number(d.rating.trim().replace(",", "."));
  if (d.rating.trim() && (!Number.isFinite(r) || r < par - 10 || r > par + 8)) e.rating = `For a par ${par} course the rating is between ${par - 10} and ${par + 8}. Check the scorecard, or leave it blank.`;
  const s = Number(d.slope);
  if (d.slope.trim() && (!Number.isInteger(s) || s < 55 || s > 155)) e.slope = "Slope is a whole number from 55 to 155 (113 is average). Check the scorecard, or leave it blank.";
  if (d.yards.trim()) {
    const y = Number(d.yards);
    const lo = d.holes === "9" ? 1000 : 2500, hi = d.holes === "9" ? 4200 : 8200;
    if (!Number.isInteger(y) || y < lo || y > hi) e.yards = `Enter total yards between ${lo.toLocaleString()} and ${hi.toLocaleString()}, or leave it blank.`;
  }
  return e;
}

/** "Find your course": what the search fields need before we ask OpenGolfAPI. */
export function validateFind(q: string, state: string): { q?: string; state?: string } {
  const e: { q?: string; state?: string } = {};
  if (q.trim().length < 2) e.q = "Type at least two letters of the course name, like “Torrey”.";
  if (state.trim() && !/^[A-Za-z]{2}$/.test(state.trim())) e.state = "Use the two-letter state code, like CA, or leave it blank to search everywhere.";
  return e;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48);
