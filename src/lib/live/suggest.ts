// Which airport to fly from or into, for a point (the golfer's location, or a course). Pure, no imports, so the
// page and the worker's Node tests (supabase/functions/tests/trip.test.ts) run the same rule.
//   1. the nearest *large* airport within 75 mi (Fairbanks Ranch → SAN, not McClellan-Palomar next door);
//   2. else the nearest airport of any kind within 75 mi (Monterey → MRY);
//   3. else the nearest large airport within 250 mi;
//   4. else none.

export type AirportKind = "large" | "medium";
export type Placed = { code: string; kind: AirportKind; lat: number; lon: number };
export type Suggestion<T extends Placed> = { airport: T; miles: number };

export const NEAR_MI = 75;
export const FAR_MI = 250;
/** Closer than this, straight line, the page says "you can drive this one" instead of showing flights. */
export const DRIVE_MI = 150;

/** Great-circle distance in statute miles (what a golfer driving from the airport thinks in). */
export function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function suggestAirport<T extends Placed>(lat: number, lon: number, airports: readonly T[]): Suggestion<T> | null {
  let large: Suggestion<T> | null = null;
  let any: Suggestion<T> | null = null;
  for (const a of airports) {
    const miles = haversineMi(lat, lon, a.lat, a.lon);
    if (!any || miles < any.miles) any = { airport: a, miles };
    if (a.kind === "large" && (!large || miles < large.miles)) large = { airport: a, miles };
  }
  if (large && large.miles <= NEAR_MI) return large;
  if (any && any.miles <= NEAR_MI) return any;
  if (large && large.miles <= FAR_MI) return large;
  return null;
}

/** The lat/lon box (degrees) that holds every airport within `miles` of a point, for the database read. */
export function boxAround(lat: number, lon: number, miles = FAR_MI): { lat: [number, number]; lon: [number, number] } {
  const dLat = miles / 69;
  const dLon = Math.min(180, miles / (69 * Math.max(0.05, Math.cos((lat * Math.PI) / 180))));
  return { lat: [lat - dLat, lat + dLat], lon: [lon - dLon, lon + dLon] };
}

/** "ORD", "san" → "ORD-SAN" (the two codes sorted, as the worker keys its boards), or null for the same airport. */
export function pairKey(x: string, y: string): string | null {
  const a = x.trim().toUpperCase(), b = y.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(a) || !/^[A-Z0-9]{3}$/.test(b) || a === b) return null;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}
