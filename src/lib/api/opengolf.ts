import "server-only";
import { cacheLife } from "next/cache";
import type { ApiHole, ApiTee, CourseDetail, CourseHit } from "./types";
import { arr, getJson, num, obj, str, UpstreamError } from "./upstream";

// OpenGolfAPI (https://opengolfapi.org/docs): free, keyless reads of ~16,800 courses, built on OpenStreetMap (ODbL).
// The anonymous limit is per IP per day (the live header says 500; the docs say 1,000), and every call from the app
// comes from our server's IP, so the results are cached for a day: a course's scorecard doesn't change by the hour.

export const OPENGOLF_BASE = process.env.OPENGOLF_BASE ?? "https://api.opengolfapi.org";

/** Search by name, optionally inside one US state. Cached for a day. Throws UpstreamError when the service fails. */
export async function searchCourses(q: string, state: string | null, limit: number): Promise<CourseHit[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 7 * 86400 });
  return searchCoursesLive(q, state, limit);
}

/**
 * One course's scorecard and facts, cached for a day. `null` = OpenGolfAPI has no such course (that answer is cached
 * too). Any other failure throws. Errors lose their class crossing the cache boundary, so routes treat every throw
 * as "unavailable".
 */
export async function courseDetail(id: string): Promise<CourseDetail | null> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86400, expire: 7 * 86400 });
  try {
    return await courseDetailLive(id);
  } catch (e) {
    if (e instanceof UpstreamError && e.kind === "not_found") return null;
    throw e;
  }
}

// The uncached calls. Only the cached wrappers above are used in normal requests; a failed call throws, and a
// thrown call is never stored in the cache, so an outage doesn't stick around after the service comes back.
export async function searchCoursesLive(q: string, state: string | null, limit: number, timeoutMs?: number): Promise<CourseHit[]> {
  const u = new URL("/api/v1/courses/search", OPENGOLF_BASE);
  u.searchParams.set("q", q);
  if (state) u.searchParams.set("state", state);
  u.searchParams.set("limit", String(limit));
  const body = obj(await getJson(u.toString(), timeoutMs));
  if (!Array.isArray(body.courses)) throw new UpstreamError("shape");
  return body.courses.map(toHit).filter((h): h is CourseHit => !!h);
}

export async function courseDetailLive(id: string, timeoutMs?: number): Promise<CourseDetail> {
  const raw = obj(await getJson(new URL(`/api/v1/courses/${encodeURIComponent(id)}`, OPENGOLF_BASE).toString(), timeoutMs));
  const name = str(raw.course_name);
  if (!name) throw new UpstreamError("shape");
  const fac = obj(raw.facilities);
  return {
    id: str(raw.id) ?? id,
    name,
    city: str(raw.city, 80),
    state: str(raw.state, 40),
    lat: num(raw.lat),
    lng: num(raw.lng),
    par: num(raw.par),
    holeCount: num(raw.holes),
    type: str(raw.type, 40),
    architect: str(raw.architect, 160),
    yearBuilt: num(raw.year_built),
    fairwayGrass: str(raw.fairway_grass, 60),
    greenGrass: str(raw.green_grass, 60),
    website: safeUrl(raw.website),
    facilities: Object.entries(fac).filter(([, v]) => v === true).map(([k]) => FACILITY[k] ?? cap(k.replace(/_/g, " "))).slice(0, 12),
    bestMonths: arr(obj(raw.climate).best_months).map(num).filter((m): m is number => m != null && m >= 1 && m <= 12),
    tees: arr(raw.tees).map(toTee).filter((t): t is ApiTee => !!t).slice(0, 14),
    holes: arr(raw.holes_data).map(toHole).filter((h): h is ApiHole => !!h).slice(0, 18),
  };
}

const FACILITY: Record<string, string> = {
  driving_range: "Driving range", putting_green: "Putting green", pro_shop: "Pro shop", restaurant: "Restaurant",
  lessons: "Lessons", club_rental: "Club rental", cart_rental: "Cart rental", locker_room: "Locker room",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toHit(v: unknown): CourseHit | null {
  const c = obj(v);
  const id = str(c.id, 64), name = str(c.course_name);
  if (!id || !name) return null;
  return {
    id, name, city: str(c.city, 80), state: str(c.state, 40), country: str(c.country_iso, 4),
    lat: num(c.lat), lng: num(c.lng), par: num(c.par), holes: num(c.holes),
  };
}

function toTee(v: unknown): ApiTee | null {
  const t = obj(v);
  const name = str(t.tee_name, 40);
  if (!name) return null;
  const g = str(t.gender);
  return {
    key: str(t.tee_key, 60) ?? name.toLowerCase(),
    name,
    color: str(t.tee_color, 30),
    gender: g?.toLowerCase().startsWith("f") ? "F" : g?.toLowerCase().startsWith("m") ? "M" : null,
    rating: num(t.course_rating),
    slope: num(t.slope),
    par: num(t.par),
    yards: num(t.yardage),
  };
}

function toHole(v: unknown): ApiHole | null {
  const h = obj(v);
  const n = num(h.number);
  if (n == null || n < 1 || n > 18) return null;
  const yards: Record<string, number> = {};
  // "web" is the yardage the source website printed (a copy of the longest tee), so it's skipped.
  for (const [k, y] of Object.entries(obj(h.yardages))) if (k !== "web" && typeof y === "number" && y > 40 && y < 800) yards[k.toLowerCase()] = y;
  return { n, par: num(h.par), hcp: num(h.handicap_index), yards };
}

function safeUrl(v: unknown): string | null {
  const s = str(v, 300);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
