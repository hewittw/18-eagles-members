// Weather, drawn for the course: the sky as a small pen drawing (never emoji), the wind as a compass needle, the
// next hours as a strip, and the week as a tee sheet. Presentational only: data comes from /api/weather via
// src/lib/api/client.ts. Attribution (Open-Meteo) is the ApiCredit in ApiState.tsx.
import type { ReactNode } from "react";
import { cx } from "../ui/cx";
import { LocalClock } from "./LocalClock";
import { bestDay, clock, compass, compassWords, dayName, sky, windWord, type Daylight, type Read, type SkyKind } from "@/lib/api/conditions";
import type { Forecast, WeatherDay, WeatherHour } from "@/lib/api/types";

// ───────── WeatherGlyph ─────────
export type WeatherGlyphProps = { code: number; isDay?: boolean; className?: string; title?: string };

/** A pen drawing of the sky for a WMO code. Decorative unless given a `title`. */
export function WeatherGlyph({ code, isDay = true, className, title }: WeatherGlyphProps) {
  const kind = sky(code, isDay).kind;
  return (
    <svg viewBox="0 0 32 32" className={cx("shrink-0", className ?? "size-8")} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {GLYPHS[kind]}
    </svg>
  );
}

const sun = (cx0: number, cy0: number, r: number, rays = true) => (
  <g>
    <circle cx={cx0} cy={cy0} r={r} />
    {rays && [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const t = (a * Math.PI) / 180;
      return <path key={a} d={`M${(cx0 + Math.cos(t) * (r + 2.6)).toFixed(2)} ${(cy0 + Math.sin(t) * (r + 2.6)).toFixed(2)} L${(cx0 + Math.cos(t) * (r + 5)).toFixed(2)} ${(cy0 + Math.sin(t) * (r + 5)).toFixed(2)}`} />;
    })}
  </g>
);
const cloud = "M9 25 H23.5 A5 5 0 0 0 23.6 15 A7.2 7.2 0 0 0 9.8 16.6 A4.2 4.2 0 0 0 9 25 Z";
const smallCloud = "M11 26 H23 A4.2 4.2 0 0 0 23.1 17.6 A6 6 0 0 0 11.6 19 A3.5 3.5 0 0 0 11 26 Z";
const moon = "M20.5 6.5 A9.5 9.5 0 1 0 25.5 22 A8 8 0 0 1 20.5 6.5 Z";

const GLYPHS: Record<SkyKind, ReactNode> = {
  sun: sun(16, 16, 5.5),
  moon: <path d={moon} />,
  partly: <>{sun(12, 11, 4.2)}<path d={smallCloud} className="fill-[var(--glyph-bg,var(--color-paper-2))]" /></>,
  "partly-night": <><path d="M14 4.5 A6.5 6.5 0 1 0 19 15 A5.4 5.4 0 0 1 14 4.5 Z" /><path d={smallCloud} className="fill-[var(--glyph-bg,var(--color-paper-2))]" /></>,
  cloud: <path d={cloud} transform="translate(0 -3)" />,
  fog: <><path d={cloud} transform="translate(0 -6)" /><path d="M6 24 H26 M9 28 H23" /></>,
  drizzle: <><path d={cloud} transform="translate(0 -6)" /><path d="M11 24 v1.2 M16 25 v1.2 M21 24 v1.2 M13.5 28 v1.2 M18.5 28 v1.2" /></>,
  rain: <><path d={cloud} transform="translate(0 -6)" /><path d="M11.5 23 L10 28 M16.5 23 L15 28 M21.5 23 L20 28" /></>,
  snow: <><path d={cloud} transform="translate(0 -6)" /><path d="M11 25.5 h0 M16 27.5 h0 M21 25.5 h0" strokeWidth="2.6" /></>,
  storm: <><path d={cloud} transform="translate(0 -6)" /><path d="M17 21 L13.5 26 H17.5 L15 30.5" /></>,
};

// ───────── WindArrow ─────────
export type WindArrowProps = { dir: number; mph?: number; size?: "sm" | "md" | "lg"; className?: string; label?: boolean };

/**
 * A compass ring with north marked and a needle pointing the way the wind is blowing (from `dir`, toward dir+180),
 * like the flag on the green. Screen readers hear "Wind from the west, 9 mph".
 */
export function WindArrow({ dir, mph, size = "md", className, label = true }: WindArrowProps) {
  const px = size === "sm" ? "size-7" : size === "md" ? "size-11" : "size-16";
  const calm = mph != null && mph < 1;
  return (
    <span className={cx("inline-grid shrink-0 place-items-center", px, className)}>
      <svg viewBox="0 0 40 40" className="size-full" aria-hidden="true">
        <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.2" />
        <path d="M20 1.5 L22.2 5.6 H17.8 Z" fill="currentColor" />
        {size !== "sm" && <text x="20" y="13.2" textAnchor="middle" fontSize="7" fontWeight="600" fill="currentColor" className="font-numeral">N</text>}
        {!calm && (
          <g transform={`rotate(${(dir + 180) % 360} 20 20)`} className="transition-transform duration-500 motion-reduce:transition-none">
            <path d="M20 29 V12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M20 8.5 L25 15 H15 Z" fill="currentColor" />
            <path d="M16.5 31 L20 28 L23.5 31" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {calm && <circle cx="20" cy="20" r="3" fill="currentColor" />}
      </svg>
      {label && <span className="sr-only">{calm ? "Calm, no wind" : `Wind from the ${compassWords(dir)}${mph != null ? `, ${mph} miles an hour` : ""}`}</span>}
    </span>
  );
}

// ───────── WeatherNow ─────────
export type WeatherNowProps = {
  forecast: Forecast;
  place: string; // "Rancho Santa Fe"
  read: Read;
  light: Daylight | null;
  tone?: "paper" | "green";
  footer?: ReactNode; // the ApiCredit
  children?: ReactNode; // the ForecastStrip
  headingLevel?: 2 | 3;
  className?: string;
  /** Fill the height it's given (wide course pages): the extra space is shared between its parts, so it ends level with its neighbour. */
  fill?: boolean;
};

/** "Conditions at <course>": temperature, sky, wind with a needle, rain, the golfer's read, and the light left. */
export function WeatherNow({ forecast: f, place, read, light, tone = "paper", footer, children, headingLevel = 2, className, fill = false }: WeatherNowProps) {
  const s = sky(f.now.code, f.now.isDay);
  const rain = Math.max(0, ...f.hours.slice(0, 4).map((h) => h.rainPct));
  const green = tone === "green";
  const H = headingLevel === 2 ? "h2" : "h3";
  const muted = green ? "text-paper-3" : "text-ink-2";
  return (
    <section aria-label={`Conditions at ${place}`} className={cx("@container min-w-0 overflow-hidden rounded-xl", fill && "lg:flex lg:flex-col", className, green ? "tex-locker on-green border border-green-3 [--glyph-bg:var(--color-green-3)]" : "border border-rule/70 bg-paper-2 text-ink shadow-card")}>
      <div className={cx("grid gap-5 p-5 sm:p-6", fill && "lg:flex-1 lg:content-between")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <H className={cx("caps text-label", green ? "text-gold" : "text-gold-ink")}>Conditions at {place}</H>
          <p className={cx("font-numeral text-[0.9rem] tabular-nums", muted)}>Now · <LocalClock timeZone={f.timezone} fallback={f.now.time} /> local</p>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 @md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <WeatherGlyph code={f.now.code} isDay={f.now.isDay} className={cx("size-14", green ? "text-on-green" : "text-green")} />
          <div className="min-w-0">
            <p className="font-numeral text-[3rem] font-semibold leading-none tabular-nums">{f.now.tempF}°<span className="sr-only"> Fahrenheit</span></p>
            <p className={cx("mt-1 text-[0.98rem]", muted)}>{s.summary} · feels {f.now.feelsF}°</p>
          </div>
          <div className={cx("col-span-2 flex items-center gap-3 border-t pt-3 @md:col-span-1 @md:border-l @md:border-t-0 @md:pl-5 @md:pt-0", green ? "border-white/25" : "border-rule")}>
            <WindArrow dir={f.now.windDir} mph={f.now.windMph} size="lg" className={green ? "text-on-green" : "text-ink"} />
            <div className="min-w-0" aria-hidden="true">
              <p className="font-numeral text-[1.6rem] font-semibold leading-none tabular-nums">{f.now.windMph < 1 ? "Calm" : <>{f.now.windMph} <span className="text-[1rem]">mph {compass(f.now.windDir)}</span></>}</p>
              <p className={cx("mt-1 text-[0.9rem]", muted)}>{f.now.gustMph > f.now.windMph + 3 ? `Gusts ${f.now.gustMph} mph` : "Steady"}</p>
            </div>
          </div>
        </div>

        <dl className={cx("grid grid-cols-2 gap-px overflow-hidden rounded-lg @lg:grid-cols-3", green ? "bg-white/20" : "bg-rule")}>
          <Fact green={green} k="Rain" v={rain < 5 ? "Dry, next 4 hours" : `${rain}% chance, next 4 hours`} />
          <Fact green={green} k="Wind" v={windWord(f.now.windMph)} />
          <Fact green={green} k={light && (light.phase === "late" || light.phase === "dark") && light.nextSunrise ? "First light" : "Daylight"} v={!light ? "—" : (light.phase === "late" || light.phase === "dark") && light.nextSunrise ? `Sunrise ${light.nextSunrise}` : light.teeBy18 ? `Tee off by ${light.teeBy18} for 18` : light.teeBy9 ? `Tee off by ${light.teeBy9} for 9` : `Sunset ${light.sunset}`} wide />
        </dl>

        <div className={cx("grid gap-1 border-l-2 pl-4", read.tone === "good" ? (green ? "border-gold" : "border-green") : read.tone === "fair" ? (green ? "border-paper-3" : "border-gold-ink") : green ? "border-on-green" : "border-error")}>
          <p className="font-serif text-[1.15rem] font-bold leading-snug">{read.title}</p>
          <p className={cx("text-[0.98rem] leading-relaxed", muted)}>{read.note}</p>
          {light && <p className="text-[0.98rem] leading-relaxed">{light.line}</p>}
        </div>
      </div>
      {children}
      {footer && <div className={cx("border-t px-5 py-2.5 sm:px-6", green ? "border-white/20" : "border-rule")}>{footer}</div>}
    </section>
  );
}

function Fact({ k, v, green, wide }: { k: string; v: string; green: boolean; wide?: boolean }) {
  return (
    <div className={cx("min-w-0 px-3.5 py-2.5", wide && "col-span-2 @lg:col-span-1", green ? "bg-green-3" : "bg-paper-2")}>
      <dt className={cx("caps text-[0.68rem]", green ? "text-gold" : "text-ink-2")}>{k}</dt>
      <dd className="mt-0.5 text-[0.95rem] leading-snug">{v}</dd>
    </div>
  );
}

// ───────── ForecastStrip ─────────
export type ForecastStripProps = { hours: WeatherHour[]; tone?: "paper" | "green"; count?: number; className?: string };

/** The next hours, left to right: time, sky, temperature, rain chance. Scrolls sideways on a narrow phone. */
export function ForecastStrip({ hours, tone = "paper", count = 8, className }: ForecastStripProps) {
  const green = tone === "green";
  const list = hours.slice(1, count + 1);
  if (!list.length) return null;
  return (
    <div role="region" aria-label="The next hours. Scrolls sideways on small screens." tabIndex={0} className={cx("scroll-x relative border-t", green ? "border-white/20" : "border-rule", className)}>
      <ol className="flex min-w-max sm:grid sm:min-w-0" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
        {list.map((h, i) => (
          <li key={h.time} className={cx("grid w-[4.6rem] justify-items-center gap-1 px-1 py-3 text-center sm:w-auto", i > 0 && (green ? "border-l border-white/15" : "border-l border-rule/70"))}>
            <span className={cx("caps text-[0.68rem]", green ? "text-gold" : "text-ink-2")}>{clock(h.time, { hourOnly: true })}</span>
            <WeatherGlyph code={h.code} isDay={isDaytime(h.time)} className={cx("size-7", green ? "text-on-green" : "text-green")} />
            <span className="font-numeral text-[1.15rem] font-semibold leading-none tabular-nums">{h.tempF}°</span>
            <span className={cx("font-numeral text-[0.82rem] tabular-nums", h.rainPct >= 40 ? (green ? "text-on-green" : "text-link") : green ? "text-paper-3" : "text-ink-2")}>{h.rainPct}%<span className="sr-only"> chance of rain, {sky(h.code, isDaytime(h.time)).summary}, wind {h.windMph} mph from the {compassWords(h.windDir)}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}
// Good enough to pick a sun or a moon for the strip (the exact sunrise is on the panel).
const isDaytime = (iso: string) => { const h = +iso.slice(11, 13); return h >= 7 && h < 18; };

// ───────── TeeSheetForecast ─────────
export type TeeSheetForecastProps = {
  days: WeatherDay[];
  className?: string;
  /** No light left today: the best day is picked from tomorrow on. */
  todayDone?: boolean;
  footer?: ReactNode; // the ApiCredit, inside the card under the key
  /** Fill the height it's given (wide course pages): the seven rows share it evenly (lg and up), so the card ends level with its neighbour. */
  fill?: boolean;
};

/** The week as a tee sheet: one line per day, the best day to book marked in words and with a flag. */
export function TeeSheetForecast({ days, className, todayDone, footer, fill = false }: TeeSheetForecastProps) {
  const best = bestDay(days, todayDone ? 1 : 0);
  return (
    <div className={cx("min-w-0", fill && "lg:flex lg:flex-col", className)}>
      {best && (
        <p className="mb-3 font-serif text-lede text-ink">
          Book <strong className="font-bold">{dayName(days[best.index].date, best.index, true)}</strong>: {best.why}.
        </p>
      )}
      <div className={cx("flex flex-col overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card", fill && "lg:flex-1")}>
      <ol className={cx("divide-y divide-rule/80", fill && "lg:grid lg:flex-1 lg:auto-rows-fr")}>
        {days.map((d, i) => {
          const s = sky(d.code);
          const isBest = best?.index === i;
          return (
            <li key={d.date} className={cx("grid grid-cols-[3.6rem_2rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2.5 sm:grid-cols-[5.5rem_2.25rem_minmax(0,1fr)_6.5rem_7rem_4.5rem] sm:px-5", isBest && "bg-tint shadow-[inset_3px_0_0_var(--color-green)]")}>
              <span className="min-w-0">
                <span className="block font-numeral text-[1.05rem] font-semibold uppercase tracking-[0.06em] text-ink">{dayName(d.date, i)}</span>
                <span className="block text-[0.78rem] text-ink-2">{d.date.slice(5).replace("-", "/").replace(/^0/, "")}</span>
              </span>
              <WeatherGlyph code={d.code} className="size-8 text-green" />
              <span className="min-w-0">
                <span className="block truncate text-[0.98rem] text-ink">{s.summary}</span>
                {isBest && <span className="caps mt-0.5 inline-flex items-center gap-1 text-[0.68rem] text-green"><Flag />Best day</span>}
                {/* Phones: wind and rain under the sky */}
                <span className="block text-[0.85rem] text-ink-2 sm:hidden">{d.rainPct}% rain · {d.windMph} mph {compass(d.windDir)}</span>
              </span>
              <span className="text-right font-numeral text-[1.1rem] tabular-nums text-ink sm:text-left">
                {d.hiF}°<span className="text-ink-2"> / {d.loF}°</span>
                <span className="sr-only"> high and low</span>
              </span>
              <span className="hidden items-center gap-2 text-[0.95rem] text-ink sm:flex">
                <WindArrow dir={d.windDir} mph={d.windMph} size="sm" className="text-ink" />
                <span className="font-numeral tabular-nums" aria-hidden="true">{d.windMph} mph</span>
              </span>
              <span className="hidden text-right font-numeral text-[0.98rem] tabular-nums text-ink sm:block">{d.rainPct}%<span className="sr-only"> chance of rain</span></span>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-1 border-t border-rule px-3.5 py-2.5 sm:px-5">
        <p className="text-[0.85rem] text-ink-2">Highs and lows in °F, the day&apos;s strongest wind and where it comes from, and the highest chance of rain.</p>
        {footer}
      </div>
      </div>
    </div>
  );
}

function Flag() {
  return <svg viewBox="0 0 10 12" className="h-3 w-2.5" aria-hidden="true"><path d="M1.5 11.5 V0.8" stroke="currentColor" strokeWidth="1.3" /><path d="M2 1 L9 3.2 L2 5.6 Z" fill="currentColor" /></svg>;
}
