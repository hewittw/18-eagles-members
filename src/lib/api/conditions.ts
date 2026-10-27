// Reading an Open-Meteo forecast the way a golfer would: the sky in words, the wind as a compass point and a club
// adjustment, whether there's light left for 18, and which day this week to book. Pure functions, safe anywhere.
import type { RoundWeather } from "../types";
import type { Forecast, WeatherDay } from "./types";

export type SkyKind = "sun" | "moon" | "partly" | "partly-night" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** WMO weather code (Open-Meteo's `weather_code`) → words and a drawing. */
export function sky(code: number, isDay = true): { summary: string; kind: SkyKind } {
  const c = code;
  if (c === 0) return isDay ? { summary: "Sunny", kind: "sun" } : { summary: "Clear", kind: "moon" };
  if (c === 1) return isDay ? { summary: "Mostly sunny", kind: "partly" } : { summary: "Mostly clear", kind: "partly-night" };
  if (c === 2) return { summary: "Partly cloudy", kind: isDay ? "partly" : "partly-night" };
  if (c === 3) return { summary: "Overcast", kind: "cloud" };
  if (c === 45 || c === 48) return { summary: "Fog", kind: "fog" };
  if (c === 51) return { summary: "Light drizzle", kind: "drizzle" };
  if (c === 53) return { summary: "Drizzle", kind: "drizzle" };
  if (c === 55) return { summary: "Heavy drizzle", kind: "drizzle" };
  if (c === 56 || c === 57) return { summary: "Freezing drizzle", kind: "drizzle" };
  if (c === 61) return { summary: "Light rain", kind: "rain" };
  if (c === 63) return { summary: "Rain", kind: "rain" };
  if (c === 65) return { summary: "Heavy rain", kind: "rain" };
  if (c === 66 || c === 67) return { summary: "Freezing rain", kind: "rain" };
  if (c === 71) return { summary: "Light snow", kind: "snow" };
  if (c === 73) return { summary: "Snow", kind: "snow" };
  if (c === 75) return { summary: "Heavy snow", kind: "snow" };
  if (c === 77) return { summary: "Snow grains", kind: "snow" };
  if (c === 80) return { summary: "Light showers", kind: "rain" };
  if (c === 81) return { summary: "Showers", kind: "rain" };
  if (c === 82) return { summary: "Heavy showers", kind: "rain" };
  if (c === 85 || c === 86) return { summary: "Snow showers", kind: "snow" };
  if (c === 95) return { summary: "Thunderstorms", kind: "storm" };
  if (c === 96 || c === 99) return { summary: "Thunderstorms with hail", kind: "storm" };
  return { summary: "Mixed skies", kind: "cloud" };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const WORDS: Record<string, string> = { N: "north", E: "east", S: "south", W: "west" };

/** 270 → "W". The direction the wind comes FROM, as golfers and forecasts say it. */
export const compass = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
/** 290 → "west-northwest" (for screen readers). */
export const compassWords = (deg: number) => {
  const p = compass(deg);
  if (p.length === 1) return WORDS[p];
  if (p.length === 2) return `${WORDS[p[0]]}${WORDS[p[1]]}`;
  return `${WORDS[p[0]]}-${WORDS[p[1]]}${WORDS[p[2]]}`;
};

/** What the wind means for club choice. Rule of thumb: about a club per 10 mph straight into it. */
export function windWord(mph: number): string {
  if (mph < 5) return "Calm";
  if (mph < 10) return "Light breeze";
  if (mph < 15) return "Breezy: about a club into it";
  if (mph < 22) return "Windy: one to two clubs into it";
  return "Blowing hard: two clubs or more, keep it low";
}

// ───────── time, in the course's own local time ─────────
// Open-Meteo returns local wall-clock strings ("2026-10-26T18:12") for timezone=auto. We compare them as plain
// minutes and never convert them to the viewer's zone: "sunset 6:12 PM" means 6:12 PM at the course.
const toMin = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), +iso.slice(11, 13) || 0, +iso.slice(14, 16) || 0) / 60000;
const fromMin = (m: number) => new Date(m * 60000).toISOString().slice(0, 16);

/** "2026-10-26T18:12" → "6:12 PM". */
export function clock(iso: string, opts: { hourOnly?: boolean } = {}): string {
  const h = +iso.slice(11, 13), m = iso.slice(14, 16);
  const h12 = h % 12 || 12, ap = h < 12 ? "AM" : "PM";
  return opts.hourOnly && m === "00" ? `${h12} ${ap}` : `${h12}:${m} ${ap}`;
}

/** "2026-10-27" → "Tue"; index 0 is "Today". */
export function dayName(date: string, index: number, long = false): string {
  if (index === 0) return "Today";
  if (index === 1 && long) return "Tomorrow";
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: long ? "long" : "short", timeZone: "UTC" });
}

/** About how long a round takes, walking or riding at a normal pace. */
export const ROUND_MINUTES = { 18: 255, 9: 130 } as const; // 4 h 15 m and 2 h 10 m

export type Daylight = { sunrise: string; sunset: string; line: string; teeBy18: string | null; teeBy9: string | null; phase: "before-dawn" | "eighteen" | "nine" | "late" | "dark"; nextSunrise: string | null };

/** "Sunset 6:12 PM: enough light for 18 if you tee off by 1:55 PM." Tee times round down to 5 minutes. */
export function daylight(f: Forecast): Daylight | null {
  const today = f.days[0], tomorrow = f.days[1];
  if (!today?.sunset || !today.sunrise || !f.now.time) return null;
  const now = toMin(f.now.time), rise = toMin(today.sunrise), set = toMin(today.sunset);
  const by = (sunset: number, mins: number) => clock(fromMin(Math.floor((sunset - mins) / 5) * 5));
  const teeBy18 = by(set, ROUND_MINUTES[18]), teeBy9 = by(set, ROUND_MINUTES[9]);
  const s = clock(today.sunset);
  const base = { sunrise: clock(today.sunrise), sunset: s, nextSunrise: tomorrow?.sunrise ? clock(tomorrow.sunrise) : null };
  if (now < rise) return { ...base, teeBy18, teeBy9, phase: "before-dawn", line: `Sunrise ${clock(today.sunrise)}, sunset ${s}. Tee off by ${teeBy18} for 18.` };
  if (now <= set - ROUND_MINUTES[18]) return { ...base, teeBy18, teeBy9, phase: "eighteen", line: `Sunset ${s}: enough light for 18 if you tee off by ${teeBy18}.` };
  if (now <= set - ROUND_MINUTES[9]) return { ...base, teeBy18: null, teeBy9, phase: "nine", line: `Sunset ${s}: too late to start 18, but there's light for 9 if you're off by ${teeBy9}.` };
  const next = tomorrow?.sunrise ? ` Tomorrow's sunrise is ${clock(tomorrow.sunrise)}.` : "";
  if (now < set) return { ...base, teeBy18: null, teeBy9: null, phase: "late", line: `Sunset ${s}: not enough light left for nine.${next}` };
  return { ...base, teeBy18: null, teeBy9: null, phase: "dark", line: `The sun set at ${s}. Plan the next round from first light.` };
}

export type Read = { tone: "good" | "fair" | "poor"; title: string; note: string };

/** One line on whether it's a day for golf, from the next four hours. */
export function playability(f: Forecast): Read {
  const next = f.hours.slice(0, 4);
  const rain = Math.max(0, ...next.map((h) => h.rainPct));
  const storm = [f.now.code, ...next.map((h) => h.code)].some((c) => c >= 95);
  const wind = Math.max(f.now.windMph, ...next.map((h) => h.windMph));
  const t = f.now.tempF;
  if (storm) return { tone: "poor", title: "Lightning about", note: "Thunderstorms in the next few hours. Wait it out in the clubhouse." };
  if (rain >= 60) return { tone: "poor", title: "Rain likely", note: `A ${rain}% chance in the next four hours. Pack the umbrella and a dry towel.` };
  if (wind >= 22) return { tone: "poor", title: "Blowing hard", note: `Gusting to ${Math.max(wind, f.now.gustMph)} mph. Club up into it and keep the ball low.` };
  if (t < 40) return { tone: "fair", title: "Cold out", note: "The ball flies shorter in the cold: take one more club, and layer up." };
  if (t > 95) return { tone: "fair", title: "Hot out", note: "Water every few holes, and play the shade." };
  if (rain >= 30) return { tone: "fair", title: "Showers possible", note: `A ${rain}% chance of rain in the next four hours.` };
  if (wind >= 12) return { tone: "fair", title: "Breezy", note: `${wind} mph at times: about a club into it, less downwind.` };
  return { tone: "good", title: f.now.isDay ? "A fine day for it" : "A calm night", note: rain > 0 ? `Dry, with a ${rain}% chance of rain at most.` : "Dry, with no rain in the next four hours." };
}

/** The best day this week to play: dry first, then calm, then closest to 72°F. */
export function bestDay(all: WeatherDay[], from = 0): { index: number; why: string } | null {
  const days = all.slice(from);
  if (!days.length) return null;
  const cost = (d: WeatherDay) => d.rainPct * 1.2 + Math.max(0, d.windMph - 6) * 2.2 + Math.abs((d.hiF + d.loF) / 2 + 6 - 72) * 0.6 + (d.code >= 95 ? 80 : 0);
  let best = 0;
  days.forEach((d, i) => { if (cost(d) < cost(days[best])) best = i; });
  const d = days[best];
  const driest = days.every((x) => x.rainPct >= d.rainPct);
  const calmest = days.every((x) => x.windMph >= d.windMph);
  const why = driest && calmest ? "the driest and calmest day of the week" : driest ? "the driest day of the week" : calmest ? "the calmest day of the week" : "the best mix of dry, calm, and mild";
  return { index: best + from, why };
}

/** What a card keeps: "62°F, 9 mph W, Sunny". */
export function toRoundWeather(f: Forecast): RoundWeather {
  return { tempF: f.now.tempF, windMph: f.now.windMph, windDir: f.now.windDir, code: f.now.code, summary: sky(f.now.code, f.now.isDay).summary, at: Date.now() };
}
export const weatherLine = (w: RoundWeather) => `${w.tempF}°F, ${w.windMph < 1 ? "calm" : `${w.windMph} mph ${compass(w.windDir)}`}, ${w.summary}`;
export const weatherSpoken = (w: RoundWeather) => `${w.tempF} degrees, ${w.windMph < 1 ? "calm" : `wind ${w.windMph} miles an hour from the ${compassWords(w.windDir)}`}, ${w.summary.toLowerCase()}`;
