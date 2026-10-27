"use client";
// Section X: the outside-data parts (OpenGolfAPI, Open-Meteo), each in every state. Sample data is a real
// Open-Meteo reading for Torrey Pines (26 Oct 2026), trimmed the way /api/weather trims it.
import { useState } from "react";
import { ApiCredit, ApiState, CourseHits, ForecastStrip, TeeSheetForecast, WeatherGlyph, WeatherNow, WindArrow } from "@/components/golf";
import { Button, ChoiceGroup } from "@/components/ui";
import { daylight, playability } from "@/lib/api/conditions";
import type { CourseHit, Forecast } from "@/lib/api/types";
import { Demo, Spec, State, States } from "./ds";

const DAY: Forecast = {
  timezone: "America/Los_Angeles",
  offsetSec: -25200,
  now: { time: "2026-10-26T12:30", tempF: 71, feelsF: 70, windMph: 9, gustMph: 15, windDir: 285, code: 1, isDay: true },
  hours: [12, 13, 14, 15, 16, 17, 18, 19, 20].map((h, i) => ({
    time: `2026-10-26T${String(h).padStart(2, "0")}:00`, tempF: [71, 73, 74, 74, 72, 69, 66, 64, 63][i], rainPct: [0, 0, 0, 2, 5, 8, 12, 10, 6][i],
    code: [1, 1, 2, 2, 3, 3, 3, 2, 1][i], windMph: [9, 10, 12, 12, 11, 9, 7, 5, 4][i], windDir: [285, 280, 275, 270, 270, 280, 300, 330, 350][i],
  })),
  days: [
    { date: "2026-10-26", code: 1, hiF: 76, loF: 55, rainPct: 0, windMph: 12, gustMph: 16, windDir: 300, sunrise: "2026-10-26T07:01", sunset: "2026-10-26T18:03" },
    { date: "2026-10-27", code: 3, hiF: 72, loF: 56, rainPct: 3, windMph: 9, gustMph: 11, windDir: 225, sunrise: "2026-10-27T07:02", sunset: "2026-10-27T18:02" },
    { date: "2026-10-28", code: 3, hiF: 70, loF: 58, rainPct: 1, windMph: 8, gustMph: 10, windDir: 190, sunrise: "2026-10-28T07:03", sunset: "2026-10-28T18:01" },
    { date: "2026-10-29", code: 3, hiF: 71, loF: 64, rainPct: 2, windMph: 9, gustMph: 8, windDir: 242, sunrise: "2026-10-29T07:04", sunset: "2026-10-29T18:00" },
    { date: "2026-10-30", code: 51, hiF: 70, loF: 65, rainPct: 23, windMph: 9, gustMph: 8, windDir: 245, sunrise: "2026-10-30T07:05", sunset: "2026-10-30T17:59" },
    { date: "2026-10-31", code: 51, hiF: 69, loF: 64, rainPct: 52, windMph: 10, gustMph: 7, windDir: 290, sunrise: "2026-10-31T07:06", sunset: "2026-10-31T17:58" },
    { date: "2026-11-01", code: 53, hiF: 66, loF: 62, rainPct: 64, windMph: 6, gustMph: 4, windDir: 317, sunrise: "2026-11-01T06:07", sunset: "2026-11-01T16:57" },
  ],
};
const LATE: Forecast = { ...DAY, now: { ...DAY.now, time: "2026-10-26T15:10", windMph: 24, gustMph: 31, code: 3 } };
const WET: Forecast = { ...DAY, now: { ...DAY.now, time: "2026-10-26T16:40", code: 63, tempF: 58, feelsF: 55 }, hours: DAY.hours.map((h) => ({ ...h, rainPct: 80, code: 63 })) };

const HITS: CourseHit[] = [
  { id: "9b9891db-3b45-48db-892f-149601b79d52", name: "Torrey Pines South Course", city: "San Diego", state: "CA", country: "US", lat: 32.897, lng: -117.248, par: 72, holes: 18 },
  { id: "2dec10e3-10e8-4262-bfdf-6b2d2d2e4d3e", name: "Torrey Pines North Course", city: "San Diego", state: "CA", country: "US", lat: 32.909, lng: -117.249, par: 72, holes: 18 },
  { id: "0025f00f-c6a4-4b88-9d9b-80989af19af3", name: "Jackson Park Golf Course", city: "Chicago", state: "IL", country: "US", lat: 41.78, lng: -87.577, par: 70, holes: 18 },
];
const noop = () => {};

export function WeatherNowSpec() {
  const [state, setState] = useState<"ok" | "loading" | "down" | "late" | "wet">("ok");
  const f = state === "late" ? LATE : state === "wet" ? WET : DAY;
  return (
    <Spec
      id="weathernow"
      name="WeatherNow"
      from="golf"
      wide
      summary="“Conditions at <course>”: the temperature and sky, the wind as a compass needle with a club adjustment in words, the rain chance for the next four hours, a one-line read on whether it's a day for golf, and the light left (sunset minus 4 h 15 m for 18, 2 h 10 m for 9). On the Clubhouse and every course page; data from /api/weather."
      use={[
        "Pair with ForecastStrip as its child and ApiCredit source=\"open-meteo\" as its footer.",
        "While loading, ApiState kind=\"loading\" shape=\"panel\" holds the same outline, so nothing jumps.",
        "A course with no location renders nothing at all: no empty box.",
        "Times are the course's own local time, never the viewer's.",
      ]}
    >
      <Demo title="Every state, live">
        <ChoiceGroup legend="Show" layout="wrap" size="sm" value={state} onChange={setState} options={[
          { value: "ok", label: "Midday" }, { value: "late", label: "Windy, 3 PM" }, { value: "wet", label: "Rain" }, { value: "loading", label: "Loading" }, { value: "down", label: "Service down" },
        ]} />
        <div className="mt-5 max-w-2xl" aria-live="polite">
          {state === "loading" ? (
            <ApiState kind="loading" shape="panel" label="Loading the conditions at Torrey Pines" />
          ) : state === "down" ? (
            <ApiState kind="down" title="The weather at Torrey Pines is resting">The forecast service isn&apos;t answering right now. Your round isn&apos;t affected: tee off as usual.</ApiState>
          ) : (
            <WeatherNow forecast={f} place="Torrey Pines" read={playability(f)} light={daylight(f)} headingLevel={3} footer={<ApiCredit source="open-meteo" />}>
              <ForecastStrip hours={f.hours} />
            </WeatherNow>
          )}
        </div>
      </Demo>
    </Spec>
  );
}

export function WindSpecs() {
  return (
    <>
      <Spec
        id="windarrow"
        name="WindArrow"
        from="golf"
        summary="A compass ring with north marked and a needle pointing the way the wind blows, like the flag on the green. The direction a forecast gives is where wind comes from, so the needle points the other way. Screen readers hear “Wind from the west, 9 miles an hour”."
        use={["dir is degrees the wind comes from (Open-Meteo's wind_direction_10m).", "size sm on the hole screen and tee sheet, lg in WeatherNow.", "Under 1 mph it draws a dot: calm."]}
      >
        <States label="Eight directions and calm" cols="auto">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
            <State key={d} label={`From ${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][d / 45]}`}><WindArrow dir={d} mph={10} size="lg" /><WindArrow dir={d} mph={10} size="sm" /></State>
          ))}
          <State label="Calm"><WindArrow dir={0} mph={0} size="lg" /></State>
          <State label="On green" tone="green"><WindArrow dir={270} mph={12} size="lg" className="text-on-green" /></State>
        </States>
      </Spec>
      <Spec
        id="weatherglyph"
        name="WeatherGlyph"
        from="golf"
        summary="The sky as a small pen drawing for each WMO weather code: never emoji. Decorative next to words (the summary always sits beside it); give it a title when it stands alone."
        use={["code is the WMO weather code from Open-Meteo.", "isDay swaps the sun for a moon."]}
      >
        <States label="Every sky" cols="auto">
          {([[0, "Sunny"], [0, "Clear night", false], [2, "Partly cloudy"], [2, "Partly, night", false], [3, "Overcast"], [45, "Fog"], [53, "Drizzle"], [63, "Rain"], [73, "Snow"], [95, "Thunder"]] as const).map(([c, l, day]) => (
            <State key={l} label={l}><WeatherGlyph code={c} isDay={day ?? true} className="size-10 text-green" /></State>
          ))}
        </States>
      </Spec>
      <Spec
        id="forecaststrip"
        name="ForecastStrip"
        from="golf"
        wide
        summary="The next hours, left to right: time, sky, temperature, and rain chance (in slate once it reaches 40%). Scrolls sideways on a narrow phone; a full sentence per hour for screen readers."
        use={["Inside WeatherNow, or alone under a heading.", "count sets how many hours (8 by default)."]}
      >
        <div className="max-w-2xl overflow-hidden rounded-xl border border-rule/70 bg-paper-2"><ForecastStrip hours={WET.hours} className="border-t-0" /></div>
        <ApiState kind="loading" shape="strip" label="Loading the next hours" className="max-w-2xl" />
      </Spec>
      <Spec
        id="teesheetforecast"
        name="TeeSheetForecast"
        from="golf"
        wide
        summary="The week as a tee sheet: one line per day with the sky, high and low, the strongest wind and where it comes from, and the rain chance. The best day to book is called out in a sentence and marked with a flag and a tint, so it never relies on color."
        use={["On every course page with a location, under “Tee sheet forecast”.", "todayDone skips today when there's no light left for nine.", "Loading: ApiState shape=\"list\"."]}
      >
        <div className="max-w-3xl"><TeeSheetForecast days={DAY.days} /></div>
      </Spec>
    </>
  );
}

export function ApiStateSpecs() {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <>
      <Spec
        id="apistate"
        name="ApiState"
        from="golf"
        wide
        summary="The three states every outside-data feature needs, in the clubhouse voice. Loading is a skeleton the shape of the answer (panel, list, strip, or line) with a status line for screen readers. Nothing found is an empty cup with a next step. Down is a laid-down flag on a dashed outline: what still works, and a way on."
        use={["Put it in an aria-live=\"polite\" area, so the outcome is announced.", "Empty: say what was searched and what to try (“Check the spelling, try without the state, or enter it yourself”).", "Down: never a raw error; say what still works, and give an action.", "tone=\"green\" on Locker Green."]}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ApiState kind="loading" shape="list" label="Searching" />
          <ApiState kind="loading" shape="panel" label="Loading" />
          <ApiState kind="empty" title="No course called “Balboa Pk” in CA in OpenGolfAPI" action={<Button size="sm" variant="secondary" onClick={noop}>Enter it yourself</Button>}>
            Check the spelling, try a shorter part of the name, or try without the state.
          </ApiState>
          <ApiState kind="down" title="Course search is resting right now" action={<><Button size="sm" variant="secondary" onClick={noop}>Try the search again</Button><Button size="sm" variant="quiet" onClick={noop}>Enter it yourself</Button></>}>
            OpenGolfAPI isn&apos;t answering. You can still enter the course yourself.
          </ApiState>
          <div className="tex-locker on-green rounded-xl p-4 lg:col-span-2">
            <ApiState kind="down" tone="green" title="The wind is resting">On Locker Green: the hole screen keeps scoring while the weather is away.</ApiState>
          </div>
        </div>
      </Spec>
      <Spec
        id="coursehits"
        name="CourseHits"
        from="golf"
        wide
        summary="“Find your course” results: one real button per course with its name, place, and par · holes. Picking one opens its card (a spinner on that row, the others wait), then marks it “In the form” on Locker Green with a check."
        use={["onPick gets the course; fetch /api/golf/course/[id] and fill the form.", "pickingId while it opens; pickedId once it's in the form (aria-pressed)."]}
      >
        <States label="States" cols="2">
          <State label="Rest · hover"><div className="w-full"><CourseHits hits={HITS.slice(0, 1)} onPick={noop} /></div><div data-force="hover" className="w-full"><CourseHits hits={HITS.slice(1, 2)} onPick={noop} /></div></State>
          <State label="Opening (others wait, disabled)"><div className="w-full"><CourseHits hits={HITS.slice(0, 2)} onPick={noop} pickingId={HITS[0].id} /></div></State>
          <State label="Selected: in the form"><div className="w-full"><CourseHits hits={HITS.slice(0, 1)} onPick={noop} pickedId={HITS[0].id} /></div></State>
          <State label="Focus" force="focus"><div className="w-full"><CourseHits hits={HITS.slice(2)} onPick={noop} /></div></State>
        </States>
        <Demo>
          <CourseHits hits={HITS} onPick={(h) => setPicked(h.id)} pickedId={picked} />
        </Demo>
      </Spec>
      <Spec
        id="apicredit"
        name="ApiCredit"
        from="golf"
        summary="The attribution each source asks for, wherever its data shows: small and quiet, with real links. OpenGolfAPI's data is OpenStreetMap's (ODbL 1.0); Open-Meteo's is CC BY 4.0."
        use={["source=\"opengolf\" under course search and course facts.", "source=\"open-meteo\" under every weather part; live={false} on a card that kept a past reading.", "as=\"span\" inside another paragraph."]}
      >
        <div className="grid gap-3">
          <ApiCredit source="opengolf" />
          <ApiCredit source="open-meteo" />
          <ApiCredit source="open-meteo" live={false} />
          <div className="tex-locker on-green rounded-lg p-3"><ApiCredit source="open-meteo" tone="green" /></div>
        </div>
      </Spec>
    </>
  );
}
