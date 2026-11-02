// Airports for the Flights page: the nearest one to a course, and the search box. Both read public.airports (the
// OurAirports seed) through the golfer's browser client and RLS; nothing here calls an outside API.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Airport = { code: string; name: string; city: string | null; country: string | null; lat: number; lon: number };
export const AIRPORT_COLS = "code, name, city, country, lat, lon";

/** Great-circle distance in statute miles (what a golfer driving from the airport thinks in). */
export function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The nearest airport to a point and its distance in miles, or null if none is within ~350 miles. Reads a lat/lon
 * box around the point (small: a few dozen rows), widening once if it's empty, then picks by haversine.
 */
export async function nearestAirport(db: SupabaseClient, lat: number, lng: number): Promise<{ airport: Airport; miles: number } | null> {
  for (const deg of [1.5, 5]) {
    const lonDeg = Math.min(180, deg / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const { data, error } = await db
      .from("airports")
      .select(AIRPORT_COLS)
      .gte("lat", lat - deg).lte("lat", lat + deg)
      .gte("lon", lng - lonDeg).lte("lon", lng + lonDeg)
      .limit(400)
      .returns<Airport[]>();
    if (error) throw new Error(error.message);
    if (data?.length) {
      let best: { airport: Airport; miles: number } | null = null;
      for (const a of data) {
        const miles = haversineMi(lat, lng, a.lat, a.lon);
        if (!best || miles < best.miles) best = { airport: a, miles };
      }
      return best;
    }
  }
  return null;
}

/** What a search box may send: letters (any script), digits, spaces, hyphens, apostrophes and dots. Max 40. */
export function cleanQuery(q: string): string {
  return q.normalize("NFC").replace(/[^\p{L}\p{N} .'-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * Up to 8 airports matching a code, city or name ("ORD", "monterey", "heathrow"), matched in the database
 * (ilike), an exact code first, then codes starting with the query, then the rest alphabetically by code.
 */
export async function searchAirports(db: SupabaseClient, raw: string): Promise<Airport[]> {
  const q = cleanQuery(raw);
  if (q.length < 2) return [];
  // Values are double-quoted so PostgREST reads spaces, dots and apostrophes as text, not syntax.
  const like = (s: string) => `"%${s.replace(/"/g, "")}%"`;
  const { data, error } = await db
    .from("airports")
    .select(AIRPORT_COLS)
    .or(`code.ilike."${q.replace(/"/g, "")}%",city.ilike.${like(q)},name.ilike.${like(q)}`)
    .order("code")
    .limit(40)
    .returns<Airport[]>();
  if (error) throw new Error(error.message);
  const Q = q.toUpperCase();
  const rank = (a: Airport) => (a.code === Q ? 0 : a.code.startsWith(Q) ? 1 : 2);
  return [...(data ?? [])].sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code)).slice(0, 8);
}
