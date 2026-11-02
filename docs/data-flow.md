# Assignment 5: Live Data Flow (drawn before any code)

Two live sources, one pattern: a worker on Supabase fetches each source on a schedule, saves **only what changed**,
records every run, and Supabase Realtime pushes each change to the open pages. The browser never calls a source.

```mermaid
flowchart LR
  subgraph Sources["Live sources (no keys)"]
    ESPN["ESPN golf leaderboard<br/>live scores, thru, position"]
    OWGR["OWGR world rankings<br/>changes weekly"]
    ADSB["adsb.lol<br/>aircraft near an airport"]
  end
  subgraph Supabase["Supabase (project rihtmjtzrufkravyunuq)"]
    CRON["Supabase Cron (pg_cron + pg_net)<br/>tour: every 10 s · rankings: hourly · flights: every 30 s<br/>sends x-worker-secret from Vault"]
    TOUR["Edge Function poll-tour<br/>fetch → parse → compare → upsert"]
    FLY["Edge Function poll-flights<br/>fetch followed airports → upsert, delete gone"]
    DB[("Postgres<br/>tour_events · tour_leaderboard · tour_rankings<br/>airport_flights · worker_runs<br/>follows (per golfer, RLS)")]
    RT["Realtime<br/>postgres_changes"]
  end
  subgraph Vercel["Vercel (Next.js, branch live-data)"]
    TPAGE["/clubhouse/tour<br/>leaderboard + rankings, my players first"]
    FPAGE["/clubhouse/flights<br/>live board for my airports"]
  end
  CLERK["Clerk<br/>sign-in, session token"]

  CRON -->|POST every tick| TOUR
  CRON -->|POST every tick| FLY
  TOUR -->|GET JSON| ESPN
  TOUR -->|GET JSON hourly| OWGR
  FLY -->|GET JSON per airport| ADSB
  TOUR -->|secret key: upsert changed rows + 1 run row| DB
  FLY -->|secret key: upsert changed rows + 1 run row| DB
  DB -->|each insert / update / delete| RT
  RT -->|WebSocket, Clerk token, RLS| TPAGE
  RT -->|WebSocket, Clerk token, RLS| FPAGE
  CLERK -->|token: sub + role authenticated| TPAGE
  CLERK -->|token| FPAGE
  TPAGE -->|follow / unfollow a player| DB
  FPAGE -->|follow / unfollow an airport| DB
```

## What each part sends to the next, and what breaks if it changes
| Hop | Sends | If it changes |
|---|---|---|
| Source → worker | JSON (ESPN `events[].competitions[].competitors[]`, OWGR `rankingsList[]`, adsb.lol `ac[]`) | A renamed field: the parser skips the row, the run is recorded `ok=false` with the error, the page goes **down** and keeps the last good data. |
| Cron → worker | an HTTP POST with `x-worker-secret` (read from Vault, never in code) | A wrong or missing secret: the worker answers 401 and writes nothing, so the page goes **stale**. |
| Worker → DB | upserts keyed by ID, using the Supabase secret key that Supabase gives the function on its servers | A renamed key column: the upsert duplicates or fails. The test on a saved response catches it. |
| DB → Realtime → page | row changes, filtered by RLS for the signed-in golfer | A missing publication, grant, or policy: the page gets nothing, with no error. Check all three first. |
| Page → DB (follows) | insert/delete in `follows` with the golfer's Clerk token | RLS: each golfer sees and changes only their own follows. |

## Freshness
The page reads the latest `worker_runs` row for its source (and gets new runs pushed by Realtime):
- **loading**: no data yet. **fresh**: the last run worked recently, even if nothing changed.
- **stale**: no successful run within 3 missed intervals. **down**: the last run failed (the last good data stays, marked).

## Free-tier budget
- Edge Function calls: 10 s tour (≈259k/mo) + 30 s flights (≈86k/mo) + hourly rankings (≈720/mo) ≈ 346k of 500k.
- Realtime messages: only changed rows are written, and flight rows are coarsened (altitude to 1,000 ft, distance to 1 nm)
  so tiny moves don't count as changes. Pages subscribe only to the airports they follow.
- adsb.lol: only airports someone follows (max 6), one call each, every 30 s.
