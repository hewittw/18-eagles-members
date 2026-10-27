# The two outside APIs: where they're called, why there, and what comes back

18 Eagles uses two free APIs that need no key and no account:

- **OpenGolfAPI** (https://opengolfapi.org/docs): about 16,800 courses with scorecards, built on OpenStreetMap (ODbL 1.0).
- **Open-Meteo** (https://open-meteo.com/en/docs): weather forecasts, free for non-commercial use (CC BY 4.0).

## Where the calls happen, and why there

```
browser (a client component)
  └─ fetch("/api/weather?lat=…&lng=…")            src/lib/api/client.ts   (useForecast, loadSearch, loadCourse)
       └─ our route handler on the server           src/app/api/weather/route.ts
            ├─ auth() from Clerk → 401 if signed out
            ├─ validate + clamp the input → 400 with a sentence
            ├─ forecast(lat, lng)  "use cache", 10 min   src/lib/api/weather.ts
            │    └─ fetch("https://api.open-meteo.com/v1/forecast?…", { signal: AbortSignal.timeout(6000) })
            └─ trimmed JSON + Cache-Control: private  (or 503 { error: "unavailable" })
```

The browser never talks to a third party. It calls **our** three routes, and they call the APIs from the server:

| Our route | Calls | Server cache | Used by |
|---|---|---|---|
| `GET /api/golf/search?q=&state=` | `api.opengolfapi.org/api/v1/courses/search` | 1 day | "Find your course" on Add a course |
| `GET /api/golf/course/[id]` | `api.opengolfapi.org/api/v1/courses/{id}` | 1 day (a "no such course" answer too) | Filling the form; "Course facts" on a course page |
| `GET /api/weather?lat=&lng=` | `api.open-meteo.com/v1/forecast` | 10 min, per ~1 km grid square | Conditions on the Clubhouse and course pages, the tee sheet forecast, the hole screen's wind, a card's "Played in" |

Why on the server, not straight from the browser:

1. **Only members.** Each route checks the Clerk session first (`auth()`), so nobody can use our app as a free proxy.
   `/api/*` passes through `src/proxy.ts` without being protected there, so the handlers check it themselves.
2. **One place to say no.** Input is validated before it leaves (a two-letter state, a UUID for a course id,
   a real latitude and longitude), and a bad request gets a sentence back, not an upstream error.
3. **The rate limit.** OpenGolfAPI allows anonymous reads per IP per day (the live `x-ratelimit-limit` header said 500;
   the docs say 1,000). Every call comes from our server, so the server cache (`"use cache"` + `cacheLife`, Next 16)
   means a popular course is fetched once a day, not once per golfer. Weather is rounded to a ~1 km grid and cached
   10 minutes, so a foursome on the same course shares one call.
4. **Timeouts and failure in one place.** `AbortSignal.timeout(6000)`. A timeout, a 5xx, a network failure, or JSON we
   can't read all become one calm `503 { error: "unavailable" }`; the UI shows its designed "resting" state. A thrown
   call is never stored in the cache, so an outage doesn't outlive the outage.
5. **Trim.** The upstream course detail is ~40 KB (hotels, pricing, polygons); we return only the fields we show.
6. **Swap-ability.** If either service changes or dies, the pages don't change: only `src/lib/api/*.ts` does.

The browser adds a small in-memory memo (`src/lib/api/client.ts`) so the Clubhouse, a course page, and the hole
screens the router keeps mounted share one answer.

### The states, and how the "down" state was tested for real
Every API UI has loading (a skeleton the shape of the answer), nothing found (with a next step), and down (what
still works, and an action). In development only (`NODE_ENV !== "production"`), add `?api=down` or `?api=slow` to
any page: the browser passes `simulate=down|slow` to our route, and the route then calls the **real** upstream with a
1 ms timeout (so the genuine timeout → 503 path runs) or waits 2.5 s first. Production ignores both. Screenshots of
each state are in the Week 4 review.

## One real OpenGolfAPI response, field by field

`GET https://api.opengolfapi.org/api/v1/courses/9b9891db-3b45-48db-892f-149601b79d52` (Torrey Pines South), trimmed:
`docs/api-samples/opengolfapi-course.json`. The search reply is `docs/api-samples/opengolfapi-search.json`.

| Field | Example | What it is | What we do with it |
|---|---|---|---|
| `id` | `"9b9891db-…"` | OpenGolfAPI's id for the course (UUID) | Saved as `openGolfId` on a course you add; built-ins map to it in `src/data/course-geo.ts` |
| `course_name` | `"Torrey Pines South Course"` | The course's name | Fills "Course name" |
| `city`, `state` | `"San Diego"`, `"CA"` | Where it is | Fills "City" as "San Diego, CA" |
| `lat`, `lng` | `32.897`, `-117.248` | The course's coordinates | Saved as `geo`, so the weather works for courses you add |
| `type` | `"municipal"` | Public, private, resort… | "Type" in Course facts |
| `par`, `holes`, `yardage` | `72`, `18`, `7802` | Totals for the longest tee | Holes count (18 or 9) |
| `architect`, `year_built` | `"William F. Bell, Rees Jones, …"`, `1957` | Who designed it, when | Course facts; saved on a course you add |
| `fairway_grass`, `green_grass` | `"Kikuya Grass"`, `"Poa Annua Grass"` | Turf | Course facts ("Fairways", "Greens"); often `null` |
| `website` | `"https://…"` | The listed site | A link in Course facts (http/https only) |
| `facilities` | `{ "driving_range": true, … }` | Yes/no/null per facility | Only the `true` ones, in words: "Driving range, Putting green…" |
| `tees[]` | | One entry per tee **and gender** | Deduped by name (men's rating first), longest first, up to 6 |
| `tees[].tee_name`, `tee_color` | `"Black"`, `"black"` | The tee's name and marker color (a word, sometimes `null`) | The tee choice; the color word picks the swatch |
| `tees[].course_rating`, `slope` | `78.8`, `148` | USGA rating (what a scratch golfer shoots) and slope (how much harder for a bogey golfer, 113 = average) | Fill "Course rating" and "Slope"; the handicap differential uses them |
| `tees[].yardage` | `7802` | Total yards from that tee | Fills "Total yards" |
| `holes_data[].number`, `par` | `1`, `4` | Hole number and par | Par for each hole |
| `holes_data[].handicap_index` | `5` | Stroke index (1 = hardest) | The hole's stroke index (re-ranked 1…9 for a nine) |
| `holes_data[].yardages` | `{ "black": 451, "web": 451, … }` | Yards per hole, keyed by tee name | The card's own hole yards; `web` (a copy of the longest) is skipped |
| `climate.best_months` | `[4, 5, …, 11]` | OpenGolfAPI's best months to play | "Best months: April to November" in Course facts |

Not used (and dropped by our route): `description`, `phone`, `address`, `nearby` (hotels), `pricing`, `booking_link`,
`insights`, and per-hole geometry (green and fairway polygons, hazards).

## One real Open-Meteo response, field by field

`GET https://api.open-meteo.com/v1/forecast?latitude=32.9&longitude=-117.25&current=…&hourly=…&daily=…&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`:
`docs/api-samples/open-meteo-forecast.json` (2 days and 3 hours, from a real call). What our route returns after
trimming: `docs/api-samples/our-api-weather.json`.

| Field | Example | What it is | What we do with it |
|---|---|---|---|
| `latitude`, `longitude` | `32.898`, `-117.230` | The model grid cell actually used (not exactly what we asked) | Ignored; we round our request to 2 decimals to share the cache |
| `utc_offset_seconds`, `timezone` | `-25200`, `"America/Los_Angeles"` | The course's time zone (from `timezone=auto`) | All times are shown as course-local ("Sunset 6:03 PM" means at the course) |
| `elevation` | `109.0` | Meters above sea level | Not shown |
| `current_units` / `hourly_units` / `daily_units` | `"°F"`, `"mp/h"`, `"%"` | Units for each block (set by our `temperature_unit`, `wind_speed_unit`) | A check that we asked for °F and mph |
| `current.time` | `"2026-10-26T21:45"` | Local time of this reading (every 15 min) | "Now · 9:45 PM local"; the daylight math compares it with sunset |
| `current.temperature_2m`, `apparent_temperature` | `63.5`, `63.5` | Air temperature 2 m up; what it feels like | "64°", "feels 63°" (rounded) |
| `current.weather_code` | `0` | WMO weather code (0 clear, 3 overcast, 61 rain, 95 thunder…) | `sky()` turns it into words and a drawing; `playability()` reads storms |
| `current.wind_speed_10m`, `wind_gusts_10m` | `5.4`, `9.8` | Wind and gusts 10 m up, mph | "5 mph", "Gusts 10 mph", and the club advice ("about a club into it" from 10 mph) |
| `current.wind_direction_10m` | `338` | Degrees the wind comes **from** (0 = north) | "NNW", and the WindArrow needle points the other way (where it blows) |
| `current.is_day` | `0` | 1 in daylight, 0 at night | Sun or moon in the drawing; "Sunny" vs "Clear" |
| `hourly.time[]` + matching arrays | `["…T21:00", …]` | One value per hour from now (`forecast_hours=13`) | The ForecastStrip; the next 4 hours drive the rain chance and "the read" |
| `hourly.precipitation_probability[]` | `[0, 0, 0]` | Chance of rain that hour, % | "Dry, next 4 hours" / "30% chance…" |
| `daily.time[]` | `["2026-10-26", …]` | 7 local dates | The tee sheet's rows |
| `daily.temperature_2m_max/min`, `precipitation_probability_max`, `wind_speed_10m_max`, `wind_direction_10m_dominant`, `weather_code` | `80.3`, `54.3`, `0`, `11.3`, `322`, `0` | The day's high, low, top rain chance, strongest wind and its usual direction, and the day's sky | One tee-sheet row each; `bestDay()` picks the driest, calmest, mildest day |
| `daily.sunrise`, `daily.sunset` | `"…T07:01"`, `"…T18:03"` | Local sunrise and sunset | "Enough light for 18 if you tee off by 1:45 PM" (sunset − 4 h 15 m; 2 h 10 m for 9) |
| `generationtime_ms` | `2.0` | How long Open-Meteo took | Ignored |

What a card keeps (`round.weather`, saved in Supabase as jsonb): `{ tempF, windMph, windDir, code, summary, at }`,
shown as "Played in 62°F, 9 mph W, Sunny". It's captured when a live round starts (Tee off), with the hole screen
as a fallback, and never overwritten.
