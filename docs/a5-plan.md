# Assignment 5 Build Plan (shared contract for every agent)

Read `AGENTS.md`, `docs/data-flow.md` (the chart), and this file before writing code. The brief is the PDF summarised
in `docs/assignment-a5.md`. Branch: `live-data`. Supabase project: `rihtmjtzrufkravyunuq` (the same one as hw4).
**No Railway.** The worker is Supabase Edge Functions run by Supabase Cron (pg_cron + pg_net).

## Two new pages (signed in, under `/clubhouse`)
- **`/clubhouse/tour`: Tour.** The live PGA TOUR leaderboard (ESPN) and the Official World Golf Ranking (OWGR).
  Each golfer follows up to 20 tour players. "Your players" comes first: position, to par, today, thru, or "not in
  this week's field" with their world rank. Then the full leaderboard, then the world ranking, each with follow buttons.
- **`/clubhouse/flights`: Flights ("Getting there").** A live board of aircraft around the airports each golfer
  follows (up to 6): arriving, departing, on the ground, passing over. It suggests the airport nearest each of the
  golfer's courses (courses have `geo`), e.g. "Torrey Pines: fly into SAN, 14 mi". Honest scope: adsb.lol has live
  positions, not schedules or routes. Timetables need a keyed API, so they're v2. Say so plainly in the UI copy only if
  it helps the golfer ("Live traffic within 15 nm. Schedules coming later." is fine; don't over-explain).

## Database (one migration file per step in `supabase/migrations/`, applied through the Supabase MCP)
Shared, worker-written tables: RLS on, one `select` policy `to authenticated using (true)`, `grant select ... to
authenticated`, nothing for `anon`, no write grants (the worker uses the secret key, which bypasses RLS).
- `worker_runs(id bigint generated always as identity pk, source text check (source in ('tour','rankings','flights')),
  started_at timestamptz not null default now(), finished_at timestamptz, ok boolean not null, rows_changed int not null default 0,
  detail text)`, index `(source, started_at desc)`. A daily cron deletes runs older than 2 days.
- `tour_events(id text pk, name, short_name, state text check in ('pre','in','post'), status_detail text, round int,
  starts_at timestamptz, ends_at timestamptz, course text, updated_at timestamptz default now())`
- `tour_leaderboard(event_id text references tour_events on delete cascade, player_key text, pk(event_id, player_key),
  athlete_id text, name text, country text, position text, sort_order int, to_par text, today text, thru text,
  status text, updated_at timestamptz default now())`
- `tour_rankings(player_key text pk, name text, country text, rank int, prev_rank int, points numeric, updated_at)`
- `airports(code text pk /* IATA */, icao text, name text, city text, country text, lat double precision, lon double precision)`:
  seeded from OurAirports large airports (public domain) by `scripts/gen-airports.mjs`, which writes the seed migration.
- `airport_flights(airport text references airports(code) on delete cascade, hex text, pk(airport, hex), callsign text,
  airline text, aircraft_type text, phase text check in ('arriving','departing','ground','overhead'), alt_ft int,
  dist_nm int, updated_at timestamptz default now())`. **Coarsen before comparing:** altitude rounded to 1,000 ft (0 on
  the ground), distance to whole nm. No `seen_at` column: it would change every row every run.

Per-golfer tables (the hw4 convention: `user_id text not null default (auth.jwt()->>'sub')`, RLS on, four policies
with `((select auth.jwt())->>'sub') = user_id`, grants to `authenticated` only):
- `followed_players(user_id, player_key text check (length(player_key) between 1 and 80), name text check (length(name) <= 80),
  created_at, pk(user_id, player_key))`
- `followed_airports(user_id, airport text references airports(code), created_at, pk(user_id, airport))`
- Limits (20 players, 6 airports) enforced by a `before insert` trigger, not only in the UI.

`player_key` = the player's name, lowercased, accents stripped, non-letters to `-` (`scottie-scheffler`). It joins
ESPN and OWGR, which use different IDs. One shared function, the same in Deno and in the app.

Realtime: `alter publication supabase_realtime add table` tour_events, tour_leaderboard, tour_rankings, airport_flights,
worker_runs. All three Realtime requirements (publication, grant, policy) must hold, or the page gets nothing, silently.

## The worker (Edge Functions, Deno, `supabase/functions/`)
- `_shared/`: `auth.ts` (check `x-worker-secret` with `rpc('worker_secret_ok', { p })`), `runs.ts` (record one
  `worker_runs` row per run, success or failure), `diff.ts` (pure: given existing rows and incoming rows, a key and the
  compared fields, return only the rows to upsert and the keys to delete), `keys.ts` (`playerKey`).
- `poll-tour/`: `parse.ts` (pure: ESPN leaderboard JSON → event + rows; OWGR JSON → ranking rows) and `index.ts`.
  Body `{}` = leaderboard (every 10 s). Body `{"part":"rankings"}` = OWGR (hourly).
  ESPN: `https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga`.
  OWGR: `https://apiweb.owgr.com/api/owgr/rankings/getRankings?regionId=0&pageSize=200&pageNumber=1&countryId=0&sortString=Rank+ASC`.
- `poll-flights/`: `parse.ts` (pure: adsb.lol `ac[]` → coarsened rows with phase and airline) and `index.ts`. Airports =
  the distinct followed airports (most-followed first, max 6), always including ORD. One call each:
  `https://api.adsb.lol/v2/point/{lat}/{lon}/15`. Rows for planes no longer there are deleted.
- Send a real `User-Agent` (ESPN blocks default headers). Timeout every fetch (8 s). Catch every error: record the run
  `ok=false` with a short `detail`, return 200/500 JSON, never crash. On HTTP 429, record it and skip (no retry storm).
- The secret key comes from Supabase's own env (`SUPABASE_SERVICE_ROLE_KEY`, or the default entry of
  `SUPABASE_SECRET_KEYS` if present). It never appears in code, the repo, or the Next.js app.
- `verify_jwt = false` in `supabase/config.toml` for both functions. Auth is the Vault secret instead:
  a migration creates `worker_secret` in Vault from `gen_random_bytes` (nobody ever sees or copies it), and
  `public.worker_secret_ok(p text) returns boolean` (security definer, `search_path = ''`, execute granted to
  `service_role` only) compares it. Cron reads it from `vault.decrypted_secrets` and sends it as `x-worker-secret`.
- `npm` packages in Deno: `npm:@supabase/supabase-js@2`. `parse.ts`, `diff.ts`, `keys.ts` import nothing from Deno or npm
  so Node can test them.

## Tests (the assignment's "test on a saved copy of the source's response")
`supabase/functions/tests/*.test.ts`, run with `npm run test:worker` (= `node --test supabase/functions/tests/`; Node 25
strips types, so use `.ts` import extensions). Fixtures (real responses, saved 2026-11-02) are in `tests/fixtures/`.
Each test says in a comment what it checks and why. At minimum: the leaderboard parse (fields, the leader, a
withdrawn/cut player), the rankings parse, `playerKey` joins both, the flight parse (phase, coarsening, airline), and
`diff`: the same response twice → 0 upserts; fixture A then B → only new/changed rows upserted and gone ones deleted.
Also extend `npm run test:rls` (Playwright): golfer-a can't see or delete golfer-b's follows.

## The app (Next.js; read `node_modules/next/dist/docs/` before writing Next code)
- `src/lib/live/browser.ts`: a browser Supabase client (publishable key + `accessToken` from Clerk's
  `useSession().session.getToken()`), created once per session in a hook.
- `src/lib/live/useWorkerHealth.ts`: `useWorkerHealth(source, everySec)` → `{ state: 'loading'|'fresh'|'stale'|'down',
  lastOkAt, lastRun }`. Reads the latest run, subscribes to `worker_runs` inserts filtered `source=eq.<source>`, and
  re-evaluates on a 5 s clock. **fresh** = the last run ok and within 3 intervals. **stale** = no ok run within 3
  intervals. **down** = the latest run failed.
- `src/components/golf/Freshness.tsx`: the shared freshness line ("Updated 8 seconds ago", plus stale and down) in the
  clubhouse style, with `aria-live="polite"` (announce state changes only, not every tick).
- `src/lib/server/follow-actions.ts`: Server Actions to follow and unfollow, via `supabaseForUser()` (publishable key +
  Clerk token). Validate input; RLS is the gatekeeper.
- Subscribe **before** fetching the first snapshot, so no change falls in the gap. Unsubscribe on unmount.
- Add both tabs to `AppNav` with drawn icons (no emoji), and check the phone tab bar at 320 px.
- Every state is designed: loading, fresh, stale, down, nothing followed yet, not in this week's field, no event this
  week, an airport with no traffic. A changed row gets a brief, subtle highlight (reduced motion: none).
- Credits in `docs/credits.md`: ESPN data, OWGR, adsb.lol (ODbL, "data from adsb.lol"), OurAirports (public domain).

## File ownership (agents work in the same tree in parallel, so stay in your lane)
- Foundation: migrations for `worker_runs`, follows, Vault secret, publication; `supabase/functions/_shared/`;
  `supabase/config.toml`; `src/lib/live/`; `Freshness.tsx`; `follow-actions.ts`; `AppNav` tabs + two placeholder pages;
  `package.json` scripts; the RLS test.
- Tour: `supabase/functions/poll-tour/`, the tour migration, `src/app/clubhouse/tour/`, tour tests.
- Flights: `supabase/functions/poll-flights/`, airports + flights migrations, `scripts/gen-airports.mjs`,
  `src/app/clubhouse/flights/`, flight tests.
- Everyone: append to `DESIGN_LOG.md`, commit your own files only (`git add <paths>`, never `git add -A`), small commits.

## API usage: once on the server, never per user (user requirement)
- Browsers never call ESPN, OWGR, or adsb.lol. The only external calls are the workers' (and hw4's existing cached
  `/api/golf` and `/api/weather` routes). Pages read Supabase once and then take Realtime pushes.
- **Tour, adaptive polling:** Cron still ticks every 10 s, but when no round is in progress (the stored event's state
  isn't `in`, and it isn't within 30 minutes of the start time), the worker fetches ESPN only if the last ESPN fetch was over
  5 minutes ago. Otherwise it records an ok run with `detail = 'idle: no live round'` and `rows_changed = 0`, without calling ESPN.
  During a live round, it fetches every tick. Use the small leaderboard endpoint (≈230 KB), not the scoreboard (≈700 KB).
- **Rankings:** hourly, and it skips the upsert when nothing changed (OWGR updates weekly).
- **Flights:** one call per distinct followed airport (max 6), shared by every golfer who follows it. A 429 skips the tick.
- Realtime: write only changed rows, coarsened; pages subscribe with filters (`airport=in.(…)`, `event_id=eq.…`).

## Diagrams and README (user requirement; graded)
- `docs/data-flow.md`: the backend data flow (drawn before code). Keep it true to what was built.
- `flows.md`: add the new user flows as Mermaid ("Follow a tour player and watch them live", "Follow an airport near my
  course and watch traffic"), plus the "what each state looks like" for loading/fresh/stale/down. Render with
  `node scripts/render-mermaid.mjs` into `public/flows/`, and show them on the site's existing `/flows` page.
- The `/flows` page (or the hub) also shows the backend data-flow chart, rendered the same way.
- `README.md`: an A5 section with the chart, how a change travels source → worker → DB → Realtime → screen, the API
  budget table, the freshness rules, how to run `npm run test:worker` and what each test checks, and the deployed URL.
