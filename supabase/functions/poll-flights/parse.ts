// adsb.lol / adsb.fi → airport_flights rows, and which airports to poll. Pure: no Deno or npm imports, so the Node tests import
// it. adsb.lol has live positions only (no routes or schedules), so "arriving" and "departing" are read from what the
// plane is doing near the field: low and descending, or low and climbing.
import { airlineFor } from "./airlines.ts";

/** The fields of one readsb aircraft entry we use (adsb.lol `ac[]`, adsb.fi `aircraft[]`). */
export type AdsbAircraft = {
  hex?: string;
  flight?: string; // callsign, space-padded to 8
  r?: string; // registration
  t?: string; // ICAO type designator (B738, E75L, C172)
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number; // ground speed, kt
  baro_rate?: number; // ft/min
  geom_rate?: number;
  lat?: number;
  lon?: number;
  dst?: number; // nm from the point we asked about
};
/** adsb.lol calls the list `ac`; adsb.fi calls it `aircraft`. Same readsb fields inside. */
export type AdsbResponse = { ac?: AdsbAircraft[] | null; aircraft?: AdsbAircraft[] | null; now?: number };

/** The aircraft list from either source's response. Throws if there is none (a changed or broken response). */
export function aircraftList(json: unknown): AdsbAircraft[] {
  const r = json as AdsbResponse | null;
  const list = r?.ac ?? r?.aircraft;
  if (!Array.isArray(list)) throw new Error("response has no ac[] or aircraft[] list");
  return list;
}

export type Phase = "arriving" | "departing" | "ground" | "overhead";

/** One airport_flights row as the worker writes it (updated_at is added at write time). */
export type FlightRow = {
  airport: string;
  hex: string;
  callsign: string | null;
  airline: string | null;
  aircraft_type: string | null;
  phase: Phase;
  alt_ft: number | null;
  dist_nm: number | null;
};

/** The key and the compared columns for diffRows. updated_at is left out, or every row would always differ. */
export const FLIGHT_KEY = ["airport", "hex"] as const;
export const FLIGHT_FIELDS = ["callsign", "airline", "aircraft_type", "phase", "alt_ft", "dist_nm"] as const;

/** Below this, a climb or descent counts as arriving or departing; above it, the plane is passing over. */
export const TERMINAL_CEILING_FT = 12_000;
const VERTICAL_FPM = 300;
const HEX = /^~?[0-9a-f]{6}$/;

/**
 * phaseOf(aircraft) →
 *   ground:    alt_baro "ground", or under 200 ft and slower than 50 kt
 *   arriving:  below 12,000 ft and descending faster than 300 ft/min
 *   departing: below 12,000 ft and climbing faster than 300 ft/min
 *   overhead:  everything else (level, high, or no vertical rate)
 */
export function phaseOf(a: AdsbAircraft): Phase {
  const alt = altitudeOf(a);
  if (a.alt_baro === "ground" || (alt !== null && alt < 200 && (a.gs ?? 0) < 50)) return "ground";
  const rate = num(a.baro_rate) ?? num(a.geom_rate);
  if (alt !== null && alt < TERMINAL_CEILING_FT && rate !== null) {
    if (rate < -VERTICAL_FPM) return "arriving";
    if (rate > VERTICAL_FPM) return "departing";
  }
  return "overhead";
}

/**
 * parseFlights(json, airport, center?) → rows for that airport, one per aircraft, coarsened:
 * callsign trimmed (or the registration when there's none), airline from the callsign, alt_ft to the nearest
 * 1,000 ft (0 on the ground), dist_nm to a whole nm. Aircraft with no position are skipped (no place on the
 * board), as are malformed hex ids. `center` is the airport's lat/lon, used only if adsb.lol leaves out `dst`.
 */
export function parseFlights(json: unknown, airport: string, center?: { lat: number; lon: number }): FlightRow[] {
  const list = aircraftList(json);
  const rows: FlightRow[] = [];
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const hex = String(a.hex ?? "").trim().toLowerCase();
    if (!HEX.test(hex)) continue;
    if (num(a.lat) === null || num(a.lon) === null) continue;

    const flight = clip(String(a.flight ?? "").trim().toUpperCase(), 12);
    const reg = clip(String(a.r ?? "").trim().toUpperCase(), 12);
    const callsign = flight || reg || null;
    const phase = phaseOf(a);
    const alt = altitudeOf(a);
    const dst = num(a.dst) ?? (center ? haversineNm(center.lat, center.lon, a.lat as number, a.lon as number) : null);

    rows.push({
      airport,
      hex,
      callsign,
      // A plane with no callsign is named by its registration, and an N-number registration is a private flight.
      airline: airlineFor(flight || reg),
      aircraft_type: clip(String(a.t ?? "").trim().toUpperCase(), 8) || null,
      phase,
      alt_ft: phase === "ground" ? 0 : alt === null ? null : Math.min(60_000, Math.max(0, Math.round(alt / 1000) * 1000)),
      dist_nm: dst === null ? null : Math.min(100, Math.max(0, Math.round(dst))),
    });
  }
  return rows;
}

/** Feet, from alt_baro (or alt_geom when the barometric altitude is missing). null when neither is a number. */
function altitudeOf(a: AdsbAircraft): number | null {
  return typeof a.alt_baro === "number" && Number.isFinite(a.alt_baro) ? a.alt_baro : num(a.alt_geom);
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clip = (s: string, n: number) => s.slice(0, n);

/** Great-circle distance in nautical miles. */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth's radius in nm
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const MAX_AIRPORTS_POLLED = 6;
export const ALWAYS_POLLED = "ORD";

/**
 * selectAirports(follows) → the IATA codes to poll this run: one call per distinct airport however many golfers
 * follow it, most-followed first (ties alphabetical), at most 6, and always ORD (the demo airport, so the board is
 * never empty for a new golfer). If ORD isn't among the top 6 it takes the sixth place.
 */
export function selectAirports(follows: readonly { airport: string }[], max = MAX_AIRPORTS_POLLED, always = ALWAYS_POLLED): string[] {
  const count = new Map<string, number>();
  for (const f of follows) {
    const code = String(f?.airport ?? "").trim().toUpperCase();
    if (/^[A-Z0-9]{3}$/.test(code)) count.set(code, (count.get(code) ?? 0) + 1);
  }
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  const top = ranked.slice(0, max);
  if (!top.includes(always)) {
    if (top.length >= max) top.pop();
    top.push(always);
  }
  return top;
}
