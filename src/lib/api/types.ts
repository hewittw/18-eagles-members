// The shapes our own route handlers return (/api/golf/*, /api/weather). The browser only ever sees these trimmed
// shapes, never the upstream JSON: see docs/apis.md for where each field comes from.

/** One row of an OpenGolfAPI course search. */
export type CourseHit = {
  id: string; // OpenGolfAPI course id (a UUID)
  name: string;
  city: string | null;
  state: string | null; // "CA" in the US; null elsewhere
  country: string | null; // ISO code: "US", "GB"…
  lat: number | null;
  lng: number | null;
  par: number | null;
  holes: number | null;
};

export type ApiTee = {
  key: string; // "blue-male": the key OpenGolfAPI uses for this tee
  name: string; // "Blue"
  color: string | null; // a word ("blue"), not a hex
  gender: "M" | "F" | null;
  rating: number | null; // USGA course rating
  slope: number | null; // 55–155
  par: number | null;
  yards: number | null; // total yards
};

export type ApiHole = {
  n: number;
  par: number | null;
  hcp: number | null; // stroke index 1–18
  yards: Record<string, number>; // tee name (lowercase) → yards
};

/** The trimmed course detail: what the add-a-course form and "Course facts" use, nothing else. */
export type CourseDetail = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  par: number | null;
  holeCount: number | null;
  type: string | null; // "Public", "Private", "Resort/Public"…
  architect: string | null;
  yearBuilt: number | null;
  fairwayGrass: string | null;
  greenGrass: string | null;
  website: string | null;
  facilities: string[]; // only the ones marked true: "Driving range", "Pro shop"…
  bestMonths: number[]; // 1–12, from OpenGolfAPI's climate summary
  tees: ApiTee[];
  holes: ApiHole[];
};

// ───────── weather (Open-Meteo) ─────────
export type WeatherNow = {
  time: string; // course-local ISO, "2026-10-26T14:30"
  tempF: number;
  feelsF: number;
  windMph: number;
  gustMph: number;
  windDir: number; // degrees the wind blows FROM (0 = north)
  code: number; // WMO weather code
  isDay: boolean;
};

export type WeatherHour = { time: string; tempF: number; rainPct: number; code: number; windMph: number; windDir: number };

export type WeatherDay = {
  date: string; // yyyy-mm-dd, course-local
  code: number;
  hiF: number;
  loF: number;
  rainPct: number;
  windMph: number; // the day's top sustained wind
  gustMph: number;
  windDir: number;
  sunrise: string; // course-local ISO
  sunset: string;
};

export type Forecast = {
  timezone: string; // "America/Los_Angeles"
  offsetSec: number; // the course's UTC offset right now
  now: WeatherNow;
  hours: WeatherHour[]; // the next 12 hours, from this hour
  days: WeatherDay[]; // today and the next 6
};

/** What every API call in the app resolves to. `down` covers timeouts, 5xx, and a network failure alike. */
export type ApiResult<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "empty" } | { state: "down" };
