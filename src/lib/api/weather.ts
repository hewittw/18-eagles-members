import "server-only";
import { cacheLife } from "next/cache";
import type { Forecast, WeatherDay, WeatherHour } from "./types";
import { arr, getJson, num, obj, str, UpstreamError } from "./upstream";

// Open-Meteo (https://open-meteo.com/en/docs): free and keyless for non-commercial use. One forecast call gives
// what a golfer checks before a round: now, the next hours, and the week. Cached ~10 minutes per spot, and the
// spot is rounded to 2 decimals (about 1 km), so everyone looking at the same course shares one cached answer.

export const METEO_BASE = process.env.METEO_BASE ?? "https://api.open-meteo.com";

/** Round a coordinate to the cache grid (~1.1 km). */
export const grid = (v: number) => Math.round(v * 100) / 100;

export async function forecast(lat: number, lng: number): Promise<Forecast> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  return forecastLive(lat, lng);
}

/** The uncached call (the cached wrapper above is what requests use). Throws UpstreamError on any failure. */
export async function forecastLive(lat: number, lng: number, timeoutMs?: number): Promise<Forecast> {
  const u = new URL("/v1/forecast", METEO_BASE);
  const q = u.searchParams;
  q.set("latitude", String(lat));
  q.set("longitude", String(lng));
  q.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day");
  q.set("hourly", "temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m");
  q.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset");
  q.set("temperature_unit", "fahrenheit");
  q.set("wind_speed_unit", "mph");
  q.set("timezone", "auto"); // times come back in the course's own local time
  q.set("forecast_days", "7");
  q.set("forecast_hours", "13"); // from the current hour: this hour + the next 12

  const raw = obj(await getJson(u.toString(), timeoutMs));
  const c = obj(raw.current);
  const tempF = num(c.temperature_2m);
  if (tempF == null) throw new UpstreamError("shape");

  const h = obj(raw.hourly);
  const ht = arr(h.time);
  const hours: WeatherHour[] = ht.map((t, i) => ({
    time: str(t, 20) ?? "",
    tempF: round(arr(h.temperature_2m)[i]),
    rainPct: round(arr(h.precipitation_probability)[i]),
    code: round(arr(h.weather_code)[i]),
    windMph: round(arr(h.wind_speed_10m)[i]),
    windDir: round(arr(h.wind_direction_10m)[i]),
  })).filter((x) => x.time);

  const d = obj(raw.daily);
  const days: WeatherDay[] = arr(d.time).map((t, i) => ({
    date: str(t, 10) ?? "",
    code: round(arr(d.weather_code)[i]),
    hiF: round(arr(d.temperature_2m_max)[i]),
    loF: round(arr(d.temperature_2m_min)[i]),
    rainPct: round(arr(d.precipitation_probability_max)[i]),
    windMph: round(arr(d.wind_speed_10m_max)[i]),
    gustMph: round(arr(d.wind_gusts_10m_max)[i]),
    windDir: round(arr(d.wind_direction_10m_dominant)[i]),
    sunrise: str(arr(d.sunrise)[i], 20) ?? "",
    sunset: str(arr(d.sunset)[i], 20) ?? "",
  })).filter((x) => x.date);

  return {
    timezone: str(raw.timezone, 60) ?? "UTC",
    offsetSec: num(raw.utc_offset_seconds) ?? 0,
    now: {
      time: str(c.time, 20) ?? "",
      tempF: Math.round(tempF),
      feelsF: round(c.apparent_temperature, tempF),
      windMph: round(c.wind_speed_10m),
      gustMph: round(c.wind_gusts_10m),
      windDir: round(c.wind_direction_10m),
      code: round(c.weather_code),
      isDay: c.is_day === 1,
    },
    hours,
    days,
  };
}

const round = (v: unknown, fallback = 0) => Math.round(num(v) ?? fallback);
