// Airports for the Flights page: the one to suggest for a place, one by code, and the search box. Both read public.airports (the
// OurAirports seed) through the golfer's browser client and RLS; nothing here calls an outside API.
import type { SupabaseClient } from "@supabase/supabase-js";

import { boxAround, nearbyAlternatives, suggestAirport, type AirportKind, type Suggestion } from "./suggest";

export { haversineMi } from "./suggest";
export type Airport = { code: string; name: string; city: string | null; country: string | null; lat: number; lon: number; kind: AirportKind };
export const AIRPORT_COLS = "code, name, city, country, lat, lon, kind";
/** The pick for a point, and the other airports near it (nearest-large-first, the pick excluded; up to 3 so the page
 *  can still offer two after the golfer swaps one in). */
export type NearAirports = Suggestion<Airport> & { alternatives: Suggestion<Airport>[] };

/**
 * The airport to suggest for a point (the golfer's location, or a course), by the rule in suggest.ts: the nearest
 * large airport within 75 mi, else the nearest of any kind within 75 mi, else the nearest large within 250 mi.
 * Reads one lat/lon box holding every airport within 250 mi, then decides here. The point itself never leaves the
 * browser: the box is snapped outward to a 2-degree grid, so the request only says which ~140-mile cells to read.
 * The same read gives the alternatives (nearbyAlternatives): other airports within 75 mi.
 */
export async function suggestNear(db: SupabaseClient, lat: number, lng: number): Promise<NearAirports | null> {
  const b = boxAround(lat, lng);
  const out = (v: number) => Math.floor(v / 2) * 2, up = (v: number) => Math.ceil(v / 2) * 2;
  const { data, error } = await db
    .from("airports")
    .select(AIRPORT_COLS)
    .gte("lat", out(b.lat[0])).lte("lat", up(b.lat[1]))
    .gte("lon", out(b.lon[0])).lte("lon", up(b.lon[1]))
    .limit(2000)
    .returns<Airport[]>();
  if (error) throw new Error(error.message);
  const pick = suggestAirport(lat, lng, data ?? []);
  return pick ? { ...pick, alternatives: nearbyAlternatives(lat, lng, data ?? [], pick.airport.code, 3) } : null;
}

/** One airport by code, or null. */
export async function airportByCode(db: SupabaseClient, code: string): Promise<Airport | null> {
  const { data, error } = await db.from("airports").select(AIRPORT_COLS).eq("code", code).maybeSingle<Airport>();
  if (error) throw new Error(error.message);
  return data;
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
