// adsb.lol / adsb.fi responses: the readsb aircraft list and the fields we read from it, plus great-circle distance.
// Pure: no Deno or npm imports, so the Node tests import it. (Until 2026-11-02 evening this file also turned a 15 nm
// circle into airport_flights rows; the route board replaced that, see route.ts.)

/** The fields of one readsb aircraft entry we use (adsb.lol `ac[]`, adsb.fi `aircraft[]` or `ac[]`). */
export type AdsbAircraft = {
  hex?: string;
  flight?: string; // callsign, space-padded to 8
  r?: string; // registration
  t?: string; // ICAO type designator (B738, E75L)
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number; // ground speed, kt
  baro_rate?: number; // ft/min
  geom_rate?: number;
  lat?: number;
  lon?: number;
  dst?: number; // nm from the point we asked about
  track?: number; // degrees true, the direction it's moving over the ground
};
/** adsb.lol calls the list `ac`; adsb.fi's point API calls it `aircraft`. Same readsb fields inside. */
export type AdsbResponse = { ac?: AdsbAircraft[] | null; aircraft?: AdsbAircraft[] | null; now?: number };

/** The aircraft list from either source's response. Throws if there is none (a changed or broken response). */
export function aircraftList(json: unknown): AdsbAircraft[] {
  const r = json as AdsbResponse | null;
  const list = r?.ac ?? r?.aircraft;
  if (!Array.isArray(list)) throw new Error("response has no ac[] or aircraft[] list");
  return list;
}

/** Feet, from alt_baro (or alt_geom when the barometric altitude is missing). null when neither is a number. */
export function altitudeOf(a: AdsbAircraft): number | null {
  return typeof a.alt_baro === "number" && Number.isFinite(a.alt_baro) ? a.alt_baro : num(a.alt_geom);
}

/** On the ground: readsb says so, or under 200 ft and slower than 50 kt. */
export function onGround(a: AdsbAircraft): boolean {
  const alt = altitudeOf(a);
  return a.alt_baro === "ground" || (alt !== null && alt < 200 && (num(a.gs) ?? 0) < 50);
}

/** Climb (+) or descent (−) in ft/min, barometric first. */
export const verticalRate = (a: AdsbAircraft): number | null => num(a.baro_rate) ?? num(a.geom_rate);

export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const HEX = /^~?[0-9a-f]{6}$/;

/** Initial great-circle bearing from one point to another, degrees true (0–360). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

/** Great-circle distance in nautical miles. */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth's radius in nm
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
