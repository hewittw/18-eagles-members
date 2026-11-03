# 18 Eagles

## Assignment 5: Live Data System

18 Eagles now has two live pages. **Tour** shows this week's PGA TOUR leaderboard (ESPN) and the Official World Golf
Ranking (OWGR), with the players you follow first. **Pro Shop** shows what six golf brands have marked down right now,
read from each brand's own public store feed, with the categories you watch first. Workers on Supabase fetch each
source on a schedule, save only what changed, and record every run. Supabase Realtime then pushes each change to the
open pages, so they update without a refresh: a birdie on the leaderboard, a new markdown, a price drop, a sell-out.
Each golfer chooses what they follow, and row-level security keeps those choices private.

- **Tour:** https://18-eagles-live.vercel.app/clubhouse/tour
- **Pro Shop:** https://18-eagles-live.vercel.app/clubhouse/shop (the old `/clubhouse/flights` redirects here)
- Sign in (any email; your follows and your watch list are private to you), follow a player or watch a category,
  and leave the page open.
- Diagrams: [`docs/data-flow.md`](docs/data-flow.md) (the chart drawn before code, the one as built, and the pivot),
  [`flows.md`](flows.md) (user flows, freshness states, one update traced), also on the site's `/flows` page.
  Talking points for class: [`docs/talking-points.md`](docs/talking-points.md).

### Pivot: Flights → Pro Shop
The second live page started as **Flights** ("Getting there": the flights in the air between your airport and the
course you're playing). On 2026-11-02 we retired it and built the **Pro Shop** instead.

**Why Flights went.**
- **Free flight data is only raw positions.** adsb.lol and adsb.fi give every aircraft's position, altitude and
  callsign, and nothing else. There are no schedules, no origins and destinations, and no "this is UA 2486 to Chicago".
- **Routes needed licensed or brittle sources.** We tried adsbdb first; its terms forbid caching its routes in a
  database, so we dropped it. Then adsb.im's routeset (Virtual Radar Server's standing data), which guesses from a
  callsign and often doesn't know, or knows a multi-stop route. We had to pick the right leg from the plane's climb,
  descent and heading. Real timetables need a paid, keyed API.
- **Rate limits from shared egress.** adsb.lol rate-limits by IP, and Supabase's Edge Functions share their outbound
  IPs, so we got 429s from other people's traffic (6 of 14 runs fell back to adsb.fi in one hour).
- **The page got too complicated and still wasn't accurate.** Geolocation, airport suggestions, alternatives, legs,
  phases and progress: a lot of machinery for a board that was often wrong or empty. The user's call: "the flights
  just seems to be too complicated and isn't working very well at all."

**What replaced it, and how we chose the source.**
- **Slickdeals was the first idea, and its terms rule it out.** Its search RSS works without a key, but
  `robots.txt` disallows `/newsearch.php?*rss=*` for every user agent (every Slickdeals feed redirects there). Its Terms
  of Service (effective 2026-03-05) say: "do not copy or display Offers via any other website or app" and "not to
  access … any of the Services via any automated means." A Pro Shop of their deals is exactly that, so we didn't
  build it.
- **The brands' own Shopify stores.** Every Shopify store serves its catalogue at `/products.json`, including each
  variant's `price`, `compare_at_price` (the "was" price), and `available`. We screened about 50 golf direct-to-consumer
  stores and read the `robots.txt` and the terms of service of the 37 that serve the feed. We kept only stores whose
  robots.txt doesn't block it and whose terms don't forbid automated access or showing their products elsewhere. Six
  passed: **Bad Birdie, Good Good Golf, Lag Shot, Malbon Golf, Seed Golf, SuperSpeed Golf**. The rest were left out,
  among them Snell, Vice, Sunday, Stitch, Seamus, LAB Golf, Bettinardi and Blue Tees. Most use Shopify's template
  terms ("spider, crawl, or scrape"), forbid automated access outright, or forbid republishing their material. Each store's note is in [`docs/credits.md`](docs/credits.md#pro-shop-brand-stores).
- **Kept simple on purpose.** One page: your watch list (up to 4 categories) first, then everything else with one row
  of category chips. Each card shows the markdown the way the hand-operated board shows a score under par: red
  numerals on a white tile. It also shows the old price struck through, stock in words, and a link straight to the
  brand's product page.
- **What stayed.** The flights tables, their rows, and the deployed `poll-flights` function are untouched (dropping
  them is destructive and needs the user). Only its cron job was unscheduled and its tables taken out of the Realtime
  publication (`supabase/migrations/20261102170000_stop_flights.sql`). The page, its components, the airport and trip
  client code, and their tests were removed from the app.

### The system
![The system as built: ESPN and OWGR feed poll-tour, six brands' Shopify stores feed poll-deals, both run by Supabase Cron; they write changed rows to Postgres; Realtime pushes them to the Tour and Pro Shop pages on Vercel; follows and watches go through Server Actions with the Clerk token and RLS.](public/flows/system/flow-3.svg)

### How one change travels
1. **Source.** Bad Birdie marks the Mauve Chalk hat down from $23 to $19. Its `/products.json` now says
   `"price": "19.00", "compare_at_price": "38.00"`.
2. **Cron.** Every 5 minutes, `pg_cron` runs the `poll-deals` job. `pg_net` POSTs to the Edge Function with the
   `x-worker-secret` header, read from Supabase Vault at that moment.
3. **Worker.** `poll-deals` asks the database whether the secret is right (`worker_secret_ok`). It then reads the six
   stores one after another, 1.5 s apart (12 s timeout each). It keeps only products on sale by at least 5 %, one row
   each, coarsened: prices to the cent, a whole-percent discount, one in-stock flag, and the image as a fixed-width
   CDN URL without its cache-buster.
4. **Only what changed.** `diffRows` compares those rows with the saved ones and returns just the hat. The worker
   upserts that one row with the secret key and adds one `worker_runs` row (`ok`, `rows_changed = 1`). A store that
   fails this run keeps its saved rows.
5. **Database to Realtime.** The update goes into Postgres's change log (WAL). `shop_deals` is in the
   `supabase_realtime` publication, so Realtime picks it up.
6. **Realtime to the browser.** For each open Pro Shop page, Realtime checks RLS as that golfer's Clerk token
   (select grant + select policy) and sends the row over the WebSocket.
7. **Screen.** `useShopLive` puts the row into React state. The card washes Fairway Tint once (no motion under
   reduced motion) and now reads −50 %. If you watch Hats, a polite live region says "Price drop: Active Bad Hat from
   Bad Birdie, now $19." The `worker_runs` insert turns the freshness line to "Updated just now".

### Sources and how we stay under their limits
| Source | What we take | How often | Limits | How we stay under them |
|---|---|---|---|---|
| ESPN leaderboard (`site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga`) | this week's event and every player's position, to par, today, thru | every 10 s during a live round (or within 30 min of the first tee time); otherwise at most every 5 min | unpublished; it blocks default User-Agents | one server-side call per tick for every golfer; a real User-Agent; the small leaderboard endpoint (~230 KB, not the ~700 KB scoreboard); idle runs make no call |
| OWGR (`apiweb.owgr.com/.../getRankings`, top 200) | rank, last week's rank, average points | hourly at :07 | unpublished | 24 calls a day; 0 writes when nothing changed (it updates weekly) |
| Six brands' Shopify stores (`https://{store}/products.json?limit=250`: badbirdiegolf.com, goodgoodgolf.com, lagshotgolf.com, malbon.com, seedgolf.co, superspeedgolf.com) | each product on sale: title, sale price, compare-at price, stock, the first image, the product's handle | every 5 minutes | none published; robots.txt allows the feed; each store's terms read on 2026-11-02 | **one request per store per run** (6 a run, 1.5 s apart, a contactable User-Agent), so 288 a day per store and 1,728 in all; no retries; a store that fails keeps its last rows |
| Shopify's image CDN (`cdn.shopify.com/…?width=480`) | the product photo | when a card scrolls into view (`loading="lazy"`) | the brands' own CDN, made for this | 480 px wide, fixed by the worker; never proxied or stored by us |

All six stores sell in US dollars (checked on each store's `/meta.json`). A run reads the first 250 products per store,
the one-request-per-store budget. Bad Birdie, Good Good and Malbon have more than that, so a sale deeper in their
catalogues is missed. That's an honest limit of being polite.

### Free-tier budget
- **Edge Function calls (Free: 500,000 a month).** `poll-tour` every 10 s = 8,640 a day; `poll-deals` every 5 min =
  288; `poll-rankings` hourly = 24. That is 8,952 a day, about **269,000 in 30 days (54%)**. Idle tour runs still
  count as calls; they save ESPN calls, not Supabase ones. (With Flights it was 69 %.)
- **Realtime messages (Free: 2 million a month).** Every change counts once for every open page that receives it.
  - An open Tour page gets 1 `worker_runs` message every 10 s (360 an hour) plus changed leaderboard rows. With no live
    round, that is about 360 an hour. In a live round, about 120 players × 18 holes = ~2,200 row updates over a ~10 h
    day, plus position shifts: roughly 500 more an hour, so **~900 an hour** per open page.
  - An open Pro Shop page gets 12 run messages an hour plus the deals that changed: on our first runs, 138 on the first
    fill and then 0. A busy hour of markdowns is a few dozen, so **~15–50 an hour** per open page.
  - So 2 million is ~2,000 hours of a Tour page on a live day, or ~40,000 hours of the Pro Shop. Tabs nobody is
    looking at stop listening (useLivePause).
- **Database (Free: 500 MB).** 21 MB used (2026-11-03). `worker_runs` grows ~8,950 rows a day and a daily job keeps 2 days;
  `cron.job_run_details` keeps 1 day. Live tables stay small (one event, ~120 players, 200 rankings, ~140 deals).
- Vercel Hobby and Clerk's development instance: unchanged from Assignment 4. No payment method anywhere.

### Freshness rules
The page reads the latest `worker_runs` row for its source, then gets each new run pushed by Realtime
(`source=eq.tour`, `eq.rankings`, `eq.deals`), and re-checks every 5 s (`src/lib/live/useWorkerHealth.ts`).
| State | Rule | The line says |
|---|---|---|
| loading | no answer from the database yet | "Checking for the latest…" |
| fresh | the latest run is ok and the last ok run finished within 3 intervals: **30 s** for the leaderboard, **15 min** for the Pro Shop, **3 h** for the world ranking | "Updated 4 minutes ago" |
| stale | no ok run within 3 intervals (the worker stopped, or Cron stopped) | "Last updated 20 minutes ago. Waiting for the next update." |
| down | the latest run failed (`ok = false`: every store failed, or the database write did) | "The feed is down. Showing the last update, from 6 minutes ago." |

- An idle tour run (`idle: no live round`) is an ok run: it means the worker is alive and nothing could have changed.
- A Pro Shop run where one or two stores fail is still ok. Its detail names them ("kept last for malbon HTTP 503"), and
  their cards stay.
- Down holds until the next ok run. A call without the secret writes no run, so a broken secret shows as stale.
- Each state has its own drawn mark (dot, ring, struck ring, dashed ring), never colour alone; only state changes are
  announced.

### Security
- **The Vault secret.** A migration makes `worker_secret` inside the database from `gen_random_bytes(32)`, so no
  person ever sees it. Cron reads it from `vault.decrypted_secrets` at each tick and sends it as `x-worker-secret`.
  The function asks `public.worker_secret_ok(p)` (security definer, empty `search_path`, callable only by
  `service_role`), which answers only true or false. A wrong or missing secret gets 401, and nothing is written.
- **`verify_jwt = false`, on purpose** (`supabase/config.toml`). Cron isn't a user and has no JWT. Turning verification
  on would mean storing a Supabase key in the cron job's SQL. The Vault secret replaces that, and it's checked first.
- **The secret key lives only on Supabase.** Supabase gives it to the Edge Functions on its servers
  (`SUPABASE_SECRET_KEYS`, or `SUPABASE_SERVICE_ROLE_KEY`). It isn't in the code, the repo, Vercel, or the Next.js
  app. The app uses the publishable key plus the golfer's Clerk token, in the browser (`src/lib/live/browser.ts`) and
  in Server Actions (`src/lib/server/follow-actions.ts`).
- **Follows and watch lists are private.** `followed_players` and `watched_categories` (and the retired
  `followed_airports` and `trips`) have RLS on, with four policies requiring `(select auth.jwt())->>'sub' = user_id`.
  The limits (20 players, 4 categories) are before-insert triggers.
- **Shared tables are read-only.** `tour_*`, `shop_deals` and `worker_runs`: RLS on, one select policy for
  `authenticated`, `grant select` only. Only the worker's role (`service_role`) can write. `shop_deals` also checks
  every row's shape: an id like `bad-birdie:1064…`, images only from `cdn.shopify.com`, a was-price above the price.
- **anon gets nothing.** Every new table has `revoke all ... from anon`. Browsers never call ESPN, OWGR or the stores'
  feeds. They load only the product photos, from Shopify's CDN, as any page linking to those stores would.

### Tests
`npm run test:worker` runs the worker's pure code on saved real responses (`supabase/functions/tests/fixtures/`,
saved 2026-11-02) with Node's test runner. 49 tests pass today.
| File | What it checks |
|---|---|
| `diff.test.ts` | `diffRows`: the same rows twice give 0 upserts and 0 deletes; a first run saves everything; A then B upserts only new and changed rows and deletes the missing one; deletes can be turned off; only listed fields count; composite keys; duplicate keys; database round-trips (`"12.5"` vs `12.5`, `Z` vs `+00:00`) aren't changes |
| `keys.test.ts` | `playerKey`: lowercase dash-joined keys, accents and letters like ø folded, punctuation collapsed, database length limits; the saved ESPN and OWGR responses join on it; the app's copy and the worker's agree on every saved name |
| `tour.test.ts` | ESPN parse on the saved Mexico Open final: event fields, 120 rows, the winner (Andrew Novak, -25), ties ("T2"), a cut player, a withdrawal with no score, no event this week, a changed API throws; a live-round shape; OWGR parse (#1 Scottie Scheffler, points rounded) and a changed API throws; the ESPN-OWGR join; the same response twice writes nothing, one change writes one row; adaptive polling: live fetches every tick, idle waits 5 minutes, the first run fetches, the first tee time beats ESPN's midnight date |
| `deals.test.ts` | The six stores' saved feeds (`shopify-*-2026-11-02.json`; `body_html` dropped and full-price products trimmed to 15 per store, every kept record as served). Parse, field by field on one real hat: id `bad-birdie:<product id>`, $23 from $38 = 39 % off, in stock, the brand's product URL, the CDN image at 480 px. Only real sales (Malbon's full-price feed gives none; cents survive: $17.50); every row fits the table's checks; sold-out items stay, marked; subscriptions and duplicate "(Copy)" listings are filtered out (both are in the real feeds); only Shopify's CDN, no `?v=`; a malformed feed gives no rows. Categories: polos named after gear ("Divot Polo", "Tees Of Destiny Polo") stay apparel; real items from every category; "tee" vs "tees" vs "ball marker". The app's copy of the brands and categories matches the worker's. Diff: the same feeds twice → 0 upserts, 0 deletes; a database round-trip ("23.00") isn't a change; a price drop, a sell-out and an ended sale write exactly those rows, and a store re-saving everything (`updated_at`, image `?v=`) writes nothing. |

`npm run test:rls` (Playwright, the Clerk test users) adds four tests to Assignment 4's: followed players, watched
categories, and the retired followed airports and trips (the tables still hold rows, so they stay protected).
golfer-a can't see golfer-b's rows, change or delete them, or write one in golfer-b's name; a signed-out caller gets
nothing. 7 passed on 2026-11-03.

### Operating it
Read-only checks in the Supabase SQL editor (or the MCP's `execute_sql`):
```sql
-- The last runs, newest first: is each worker alive, and what did it change?
select source, ok, rows_changed, detail, started_at from public.worker_runs order by started_at desc limit 20;
-- The schedules, and whether each job is on.
select jobid, jobname, schedule, active from cron.job order by jobid;
-- Did Cron's own runs succeed? (pg_net's POST is asynchronous, so "succeeded" means the request was queued.)
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j using (jobid) order by d.start_time desc limit 10;
-- Failures in the last hour.
select source, count(*) filter (where not ok) as failed, count(*) as runs
from public.worker_runs where started_at > now() - interval '1 hour' group by source;
-- What's on sale, by category, and the database size.
select category, count(*), count(*) filter (where not available) as sold_out from public.shop_deals group by 1;
select pg_size_pretty(pg_database_size(current_database())) as db;
```
Pause and resume a job (a change to the schedule, so do it as a migration or by hand in the dashboard's Cron page):
```sql
select cron.alter_job((select jobid from cron.job where jobname = 'poll-deals'), active := false);  -- pause
select cron.alter_job((select jobid from cron.job where jobname = 'poll-deals'), active := true);   -- resume
```
While a job is paused, its page goes **stale** within 3 intervals and says so. Nothing else breaks.

Run it locally: `npx next dev -p 3400`, then `/clubhouse/tour` and `/clubhouse/shop`. The workers run only on Supabase.
`node scripts/shop-check.mjs` screenshots the Pro Shop signed in at every size and walks its interactions;
`node scripts/shop-realtime-check.mjs` leaves it open across a cron tick and lists the Realtime messages that arrived.

---

## Assignment 4: Full Stack App (and earlier)

A personal golf round journal, now with your own account. Play a round hole by hole, keep every card, and watch your
handicap move, on every device you sign in on. Built for Design, Build, Ship (MPCS 51238, Autumn 2026),
**Assignment 4: Full Stack App**, extending Assignment 3.

- **The tool:** https://18-eagles-members.vercel.app/clubhouse (make an account; your cards are private to you)
- **Progress hub** (research, mood board, design system, flows): https://18-eagles-members.vercel.app
- Assignment 3 (frozen, localStorage only): https://18-eagles.vercel.app · https://github.com/hewittw/18-eagles

## What's new in Week 4
- **Accounts (Clerk).** Sign up, sign in, sign out. A signed-out visitor sees only the welcome page; every page under
  `/clubhouse/*` requires sign-in (`src/proxy.ts`).
- **Your journal in Supabase, private by Row Level Security.** Three tables (`profiles`, `rounds`, `custom_courses`),
  each row owned by one Clerk user id, with RLS on every table (`supabase/migrations/`). The server talks to Supabase
  with the publishable key + your Clerk token, never a secret key, so Postgres itself decides what you can see.
- **Live course data (OpenGolfAPI) and conditions (Open-Meteo)**, called only from our own server routes
  (`src/app/api/`), with designed loading, nothing-found and API-down states. See [`docs/apis.md`](docs/apis.md).
- **The RLS test**: two golfers each save a card and neither sees the other's. Watched **failing** with RLS broken on
  purpose, then passing: [`docs/rls-test/README.md`](docs/rls-test/README.md). Run: `npm run test:rls`.
- **Security review** on the `full-stack` branch before merging: [`docs/security-review.md`](docs/security-review.md).
- **Instructor feedback addressed:** the add-a-course form fills itself from a course search, with fewer required
  fields; the course photos are graded into one sunlit set; the header recedes as you scroll.
- How it all works, for class: [`docs/talking-points.md`](docs/talking-points.md). Decisions: [`DESIGN_LOG.md`](DESIGN_LOG.md).

## Data model
| table | one row is | owned by |
|---|---|---|
| `profiles` | a golfer's name, index, goal, home course, bag | `user_id` = Clerk `sub` |
| `rounds` | one card (hole-by-hole entries as jsonb, note, weather) | `user_id` |
| `custom_courses` | a course the golfer added | `user_id` |

## User flows

A personal golf round journal. Everything is saved on this device (localStorage).

**The main task, as one sentence:**
> I pick my course → I tee off → I tap my score on each hole (and the clubs, if I want) → I finish → my card is saved and my handicap moves.

## The three flows

1. **First visit:** I open 18 Eagles → three quick questions on the Clubhouse itself, each saved as I answer: my
   Handicap Index (or "Not yet: I'll earn one"), **where I usually play** (pick my home course from photo tiles, or add it),
   and **what's in my bag** (a standard set is filled in; I tap clubs out or in) → the Tee off card opens at *my* course
   with its tees → I tap **Tee off** → I'm on hole 1. (Just looking? "Explore a sample season" fills it with 13 rounds.)
2. **Main task:** I choose a course → I pick my tees → I score each hole (score tiles, putts, fairway, penalties,
   clubs, a note) → after the last hole I see my card, the story of the round, and what changed.
3. **Coming back:** I open 18 Eagles → I see my handicap and how it moved, and any unfinished round to resume → "Last time at
   Torrey South: 88. Beat it." → I tee off at the course I play most, with last round's note in view.

### 1 · First visit (nothing saved)
```mermaid
flowchart TD
  A0([Open /clubhouse]) --> A1{"Step 1 of 3<br/>Know your Handicap Index?"}
  A1 -- "Yes" --> A2["Type it in the hero<br/>(error next to the field if it's not a number)"]
  A1 -- "Not yet" --> A3["Earn one:<br/>0 of 3 cards"]
  A0 -- "Just looking" --> D1(["Explore a sample season<br/>13 rounds, stats, honors"])
  A2 --> B1["Step 2 of 3 · Where do you usually play?<br/>search · photo tiles · pick one"]
  A3 --> B1
  B1 -- "Not listed" --> B2([Add a course form])
  B1 -- "Make it my home course" --> B3["Step 3 of 3 · What's in your bag?<br/>standard set filled in · tap clubs out or in"]
  B3 -- "That's my bag" --> A5["Tee off card at my home course<br/>tees · All 18 / Front 9 / Back 9"]
  A5 -- "Tee off" --> A6([Hole 1])
  A5 -- "Log a past round" --> A7([Log a round form])
  A5 -- "Choose another course" --> A8([Courses])
  A5 -.-> G1["Optional: what are you playing for?<br/>Break 100 · 90 · 80 · Scratch"]
```

### 2 · Main task: play a round
```mermaid
flowchart TD
  C1["Courses<br/>browse · search · Home / USA / Scotland / Majors"] --> C2["The course<br/>photo · the card · choose tees"]
  C1 -- "Not listed" --> F1["Add a course form"]
  F1 -- "error next to the field,<br/>typed values kept" --> F1
  F1 -- "Saved" --> C2
  C2 -- "Start round" --> P1["Hole screen"]
  P1 --> P2["Tap a score tile<br/>Eagle · Birdie · Par · Bogey · Double · more"]
  P2 --> P3["Optional: putts · fairway on par 4s and 5s ·<br/>penalty · club per shot · note"]
  P3 --> V1{"Entries agree?"}
  V1 -- "Putts more than score" --> E1["Next to putts: Putts can't be more<br/>than your score of 4. Lower putts<br/>or raise the score."] --> P3
  V1 -- "Shots don't match score" --> E2["You logged 5 shots but scored 4.<br/>Use 5 as your score?"] --> P3
  V1 -- "Yes, saved on every tap" --> P4{"Last hole?"}
  P4 -- "No" --> P5["Next hole"] --> P2
  P4 -- "Yes" --> S1["Your card<br/>story of the round · handicap change · honors"]
  L1["Log a past round form<br/>course · tees · date · scores"] -- "Saved" --> S1
  S1 -- "Edit a hole" --> P1
  S1 -- "Delete" --> U1["Deleted · Undo"]
```

### 3 · Coming back
```mermaid
flowchart TD
  R0([Open /clubhouse again]) --> R1["Handicap in big numbers<br/>change line · next score to drop off"]
  R1 --> R2{"Unfinished round?"}
  R2 -- "Yes" --> R3["Resume at the hole I left"] --> R6([Hole screen])
  R2 -- "No" --> R4["Last time at Torrey South: 88. Beat it.<br/>last round's note · goal progress · new honors"]
  R4 --> C1["Your challenge for the next round<br/>last round: met or missed · streak"]
  R4 -- "Tee off again" --> R5([The course, tees remembered])
  R4 --> T1["Stats: breakdowns + filters over time"]
  R4 --> H1["Cards: every round"]
  R4 --> K1["Locker: bag · index · goal · honors · export"]
```

## Routes (a page for each step, one shared nav)
| Route | Step | Nav label |
|---|---|---|
| `/clubhouse` | First visit / coming back home: the handicap, tee off, resume | Clubhouse |
| `/clubhouse/courses` | Choose a course | Courses |
| `/clubhouse/courses/[slug]` | The course, its card, tee choice, start | — |
| `/clubhouse/courses/new` | Form: add a course | — |
| `/clubhouse/rounds/[id]/[hole]` | Playing: the hole screen | — (its own focused header) |
| `/clubhouse/rounds/[id]` | The finished card, the story, what changed | — |
| `/clubhouse/rounds` | Every card (history) | Cards |
| `/clubhouse/rounds/new` | Form: log a round I've played | — |
| `/clubhouse/stats` | Breakdowns with filters | Stats |
| `/clubhouse/locker` | The bag, index and goal, honors, export/reset | Locker |
| `/clubhouse/trophies` | The Trophy Room: this week's case, crystal, career | — (from the Clubhouse and Locker) |

## States and errors we design for
- **Empty:** no rounds → the hero asks three setup questions (index, home course, bag), then the tee off card opens at that course. No blank stats: they show "after 1 round" previews with the goal.
- **One round:** the stats are honest ("1 round") and the handicap tracker reads 1 of 3.
- **In progress:** autosaved on every tap; resume from the clubhouse; the hole screen remembers the last hole.
- **9 holes:** front or back nine; 9-hole scores pair up toward the index.
- **Validation:** putts ≤ score; shot count vs score reconciled; fairway hidden on par 3s; scores 1–15; dates not in the future;
  index −10.0 to 54.0; slope 55–155; rating within reach of par. Every error sits next to its field and says what to do.
- **Destructive:** delete a round → Undo. Erase everything (Locker) → the one confirmation dialog.

## First visit (the onboarding)
Open the tool with nothing saved and it never shows an empty screen or a tour. The Clubhouse itself asks three short
questions, one at a time, and each answer is saved the moment it's given:
1. **Your Handicap Index:** type it (errors sit next to the field), or "Not yet: I'll earn one" (three cards).
2. **Where do you usually play?** Photo tiles of 28 courses (home courses, the PGA majors, Scotland) with search, or
   "My course isn't here" → the Add a course form.
3. **What's in your bag?** A standard 14 is filled in; tap clubs out or in. These become your buttons on every hole.

Then the Tee off card opens at *your* course with its tees, and one tap puts you on hole 1: learning by doing.
Under the question, a showcase for newcomers only: the trophies waiting to be won, a still of the one-tap hole screen,
the handicap worked out for you, the next-round challenge, and course photos from Augusta to St Andrews.
Someone just looking can tap **Explore a sample season** and see the whole app full (13 rounds, stats, honors).
How GHIN, 18Birdies and Arccos onboard, and what we took from each: [`docs/research/`](docs/research/).

## A reason to come back
- **The Trophy Room, every week.** A trophy case at the top of the Clubhouse resets each Monday: the Low Round of
  the Week (your best card this week ranked against all of yours: #1 gold, top 3 silver, top quarter bronze), the Jacket
  (beat your goal this week) and the Challenge Medal. Crystal for eagles, aces and birdie runs, and 22 career trophies
  (Broke 90, Amen Corner, Course Record, Ten Cards…). Thirty in all, worked out from your cards, never stored.
- **Your handicap, moving.** The index in big numbers, how it changed since the last card, your low, and which old
  score your next card will push out of the best 8 of 20.
- **Your challenge for the next round.** After each card, 18 Eagles picks your weakest area from your recent rounds
  (three-putts, doubles, penalties, fairways…) and sets one concrete target. When you come back it says whether you
  met it, and keeps your streak.
- **Beat your last card.** "Last time at Torrey South: 88. Beat it.", with the note you left yourself.
- **Resume.** A round in progress is saved on every tap and waits at the hole you left.
- **New since your last visit.** Trophies won since you were last here are marked New on the shelf.

Everything is saved in localStorage: rounds, the bag, the profile, honors seen, and the time of your last visit.

## Accessibility
- **Keyboard:** every flow was done keyboard-only (skip link, tab order, arrow keys in radio groups, Escape in the
  dialog, focus moved to the new heading after each step and page change). Report: [`docs/verification-keyboard.md`](docs/verification-keyboard.md).
- **Real labels:** every field has a visible `<label>` (search fields have a screen-reader label), hints and errors are
  tied to it with `aria-describedby`, errors are announced and focus moves to the first one, and typed values are kept.
- **Contrast, checked by the agent:** every text/background pair the components use is measured from the design tokens
  (`node --no-warnings src/app/design-system/measure-contrast.mjs`): all pass WCAG AA, and the script fails if the CSS
  drifts. The table is on [/design-system](https://18-eagles.vercel.app/design-system).
- **Automated + sizes:** axe-core on every page in empty, one-round, full-season and mid-round states, at 11 screen
  widths from 320px, with 200% zoom. Report: [`docs/verification.md`](docs/verification.md).
- Scores are never color alone (signs and shapes too), targets are 44px or larger, and motion respects reduced-motion.

## First-run check
An agent used the live site as a brand-new golfer (a 14-handicap from Jackson Park), driving a fresh headless Chromium
with Playwright and empty localStorage. It ran four sessions: a first visit on a phone (name, a wrong index, Back, home
course, bag, three holes by club taps, tiles, putts and a note, then leaving mid-round); coming back later in a new
context to resume, finish, and look at the card, the challenge, the trophies and stats; a laptop pass (adding a course
with errors, logging last week's round); and a keyboard-only pass. Full write-up with screenshots: [`docs/first-run-check.md`](docs/first-run-check.md).

**What it found**
- **Delights:** club taps count the score and putts by themselves ("Through 1 · E"). The Add-a-course form puts each
  error by its field, moves focus there, and keeps what you typed, even across a reload. "Make Jackson Park my home course".
  "Last time at Jackson Park: 81. Beat it."
- **Resuming is buried:** with a round in progress, the hero still says "Your locker is ready", and Resume sits under the
  trophy case, about 1.6 phone screens down. On a first visit, the empty trophy case also pushes Tee off off the screen.
- **Wrong-looking numbers:** the finished card's "White yds" row showed the Blue tee's yards. 9-hole courses said
  "18 holes". After a nine, the challenge said "Your last card was 88" for a 44.
- **Keyboard:** after Tee off or Resume, focus was left on the page body instead of the hole's heading.
- **Dead end:** adding your course from onboarding step 2 left onboarding on step 2, and the new course wasn't in the tiles.

**What we changed**
- Focus now lands on the new page's visible heading after Tee off and Resume (`RouteFocus`).
- The card's yards row shows the tees you played (a shared `yardsAt` helper, also used by the hole screen).
- 9-hole courses read "9 holes" on the card and in Cards. A partial putts total reads "Putts · 3 holes".
- The challenge after a nine says "Shoot 87 or better (44 for nine)" and "works out to 88 over 18 holes".
- Stats say "Track putts on every hole of a round to see this" instead of implying you never tracked them.

Still to do (recommendations in the doc): put Resume in the hero, put Tee off ahead of an empty trophy case, and return
from Add a course to onboarding with the course picked.

## Stack
Next.js 16 (App Router) · Tailwind CSS v4 · Clerk (development instance) · Supabase (Postgres + RLS, Free) · OpenGolfAPI ·
Open-Meteo · Playwright · Vercel Hobby. Charts are hand-built SVG, with no chart library. Course photos are freely
licensed and colour-graded; credits are in [`docs/credits.md`](docs/credits.md). Nothing here costs money.

## Run it
```bash
npm install
# .env.local (you create it; never committed, and the agent is denied reading it):
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npx next dev -p 3300   # http://localhost:3300/clubhouse
npm run test:rls       # the two-user RLS test (Clerk test users, code 424242)
```
