"use client";
// The outside-data features, wired to our own routes (src/lib/api/client.ts → /api/weather, /api/golf/course/[id]).
// Each one shows a skeleton while loading, says what to do when nothing's found or the service is down, and simply
// isn't there for a course with no location (a course you typed in by hand).
import { useEffect, type ReactNode } from "react";
import { ApiCredit, ApiState, ForecastStrip, TeeSheetForecast, WeatherNow, WindArrow } from "@/components/golf";
import { daylight, playability, toRoundWeather, compass } from "@/lib/api/conditions";
import { useCourseFacts, useForecast } from "@/lib/api/client";
import type { CourseDetail } from "@/lib/api/types";
import type { Course } from "@/lib/course-types";
import { courseGeo, openGolfIdOf } from "@/lib/courses";
import { captureWeather } from "@/lib/round-actions";
import type { Round } from "@/lib/types";

/** "Conditions at <course>": now, the next hours, and the light left. For the course you're about to play. */
export function CourseConditions({ course, headingLevel = 2 }: { course: Course; headingLevel?: 2 | 3 }) {
  const geo = courseGeo(course);
  const res = useForecast(geo, true);
  if (!res) return null; // no location: nothing to show, and no empty box
  if (res.state === "loading") return <ApiState kind="loading" shape="panel" label={`Loading the conditions at ${course.shortName}`} />;
  if (res.state !== "ok") {
    return (
      <ApiState kind="down" title={`The weather at ${course.shortName} is resting`}>
        The forecast service isn&apos;t answering right now. Your round isn&apos;t affected: tee off as usual, and the
        conditions come back here on their own.
      </ApiState>
    );
  }
  const f = res.data;
  return (
    <WeatherNow forecast={f} place={course.shortName} read={playability(f)} light={daylight(f)} headingLevel={headingLevel} footer={<ApiCredit source="open-meteo" />}>
      <ForecastStrip hours={f.hours} />
    </WeatherNow>
  );
}

/** The week as a tee sheet, with the best day to book. On every course page with a location. */
export function CourseForecast({ course, className }: { course: Course; className?: string }) {
  const res = useForecast(courseGeo(course));
  if (!res) return null;
  return (
    <section aria-labelledby="forecast-h" className={`min-w-0 ${className ?? ""}`}>
      <h2 id="forecast-h" className="font-display text-title text-ink">Tee sheet forecast</h2>
      <p className="mt-1 text-[0.95rem] text-ink-2">The next seven days at {course.shortName}, in the course&apos;s own time zone.</p>
      <div className="mt-4" aria-live="polite">
        {res.state === "loading" ? (
          <ApiState kind="loading" shape="list" label="Loading the week's forecast" />
        ) : res.state === "ok" ? (
          <>
            <TeeSheetForecast days={res.data.days} todayDone={["late", "dark"].includes(daylight(res.data)?.phase ?? "")} />
            <ApiCredit source="open-meteo" className="mt-2 px-1" />
          </>
        ) : (
          <ApiState kind="down" title="The week's forecast is resting">
            The weather service isn&apos;t answering. Check back in a few minutes; everything else on this page works as usual.
          </ApiState>
        )}
      </div>
    </section>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Plain words for OpenGolfAPI's best months: [4..11] → "April to November"; all twelve → "All year". */
function monthsLine(ms: number[]): string | null {
  if (!ms.length) return null;
  if (ms.length === 12) return "All year";
  const s = [...ms].sort((a, b) => a - b);
  const run = s.every((m, i) => i === 0 || m === s[i - 1] + 1);
  const long = (m: number) => new Date(Date.UTC(2026, m - 1, 15)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return run ? `${long(s[0])} to ${long(s[s.length - 1])}` : s.map((m) => MONTHS[m - 1]).join(", ");
}

function factsOf(d: CourseDetail): [string, ReactNode][] {
  const out: [string, ReactNode][] = [];
  if (d.architect) out.push(["Architect", d.architect]);
  if (d.yearBuilt) out.push(["Built", String(d.yearBuilt)]);
  if (d.type) out.push(["Type", d.type.replace(/\//g, " / ").replace(/^./, (c) => c.toUpperCase())]);
  if (d.fairwayGrass) out.push(["Fairways", d.fairwayGrass]);
  if (d.greenGrass) out.push(["Greens", d.greenGrass]);
  if (d.facilities.length) out.push(["Facilities", d.facilities.join(", ")]);
  const best = monthsLine(d.bestMonths);
  if (best) out.push(["Best months", best]);
  if (d.website) out.push(["Website", <a key="w" className="link break-all" href={d.website} target="_blank" rel="noreferrer">{d.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}<span className="sr-only"> (opens in a new tab)</span></a>]);
  return out;
}

/** "Course facts from OpenGolfAPI": architect, year, grasses, facilities, best months. Built-in courses map by id. */
export function CourseFacts({ course, className }: { course: Course; className?: string }) {
  const id = openGolfIdOf(course);
  const res = useCourseFacts(id);
  if (!res) return null;
  const facts = res.state === "ok" ? factsOf(res.data) : [];
  return (
    <section aria-labelledby="facts-h" className={`min-w-0 ${className ?? ""}`}>
      <h2 id="facts-h" className="font-display text-title text-ink">Course facts from OpenGolfAPI</h2>
      <p className="mt-1 text-[0.95rem] text-ink-2">An open course database built on OpenStreetMap. It can differ from the club&apos;s own card.</p>
      <div className="mt-4" aria-live="polite">
        {res.state === "loading" ? (
          <ApiState kind="loading" shape="list" label="Loading the course facts" />
        ) : res.state === "down" ? (
          <ApiState kind="down" title="Course facts are resting right now">
            OpenGolfAPI isn&apos;t answering. The scorecard and everything above come from our own course book, so nothing else is missing.
          </ApiState>
        ) : facts.length === 0 ? (
          <ApiState kind="empty" title={`OpenGolfAPI only knows where ${course.shortName} is`}>
            Its entry has the location (which is what the weather uses) but no architect, grasses, or facilities yet. It&apos;s an open
            database: anyone can add them at opengolfapi.org.
          </ApiState>
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-rule/70 bg-rule/70 shadow-card lg:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="grid gap-1 bg-paper-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-ink">{k}</dt>
                  <dd className="min-w-0 text-ink-2">{v}</dd>
                </div>
              ))}
              {facts.length % 2 === 1 && <div aria-hidden="true" className="hidden bg-paper-2 lg:block" />}
            </dl>
            <ApiCredit source="opengolf" className="mt-2 px-1" />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The hole screen's wind: a quiet needle and "9 mph W · 64°", refreshed at most every 10 minutes. It also keeps the
 * conditions on the card the first time a live round has them (if Tee off couldn't fetch them in time).
 */
export function HoleWind({ course, round }: { course: Course; round: Round }) {
  const res = useForecast(courseGeo(course), true);
  const f = res?.state === "ok" ? res.data : null;
  const needsCapture = round.mode === "live" && round.status === "playing" && !round.weather;
  useEffect(() => {
    if (f && needsCapture) captureWeather(round.id, toRoundWeather(f));
  }, [f, needsCapture, round.id]);
  if (!res) return null;
  // Always the same footprint, so the header never shifts as the wind arrives.
  return (
    <p className="flex min-h-7 items-center gap-2 font-numeral text-[0.95rem] tabular-nums text-paper-3" aria-live="off">
      {res.state === "loading" ? (
        <span className="inline-block h-4 w-28 animate-pulse rounded-xs bg-white/15 motion-reduce:animate-none" aria-hidden="true" />
      ) : f ? (
        <>
          <WindArrow dir={f.now.windDir} mph={f.now.windMph} size="sm" className="text-on-green" />
          <span aria-hidden="true">{f.now.windMph < 1 ? "Calm" : `${f.now.windMph} mph ${compass(f.now.windDir)}`} · {f.now.tempF}°</span>
          <span className="sr-only">, {f.now.tempF} degrees</span>
        </>
      ) : (
        <span className="text-[0.85rem]">Wind unavailable</span>
      )}
    </p>
  );
}
