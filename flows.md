# 18 Eagles · User Flows

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

## Assignment 5: the live system

Two live pages under `/clubhouse`, fed by workers on Supabase: **Tour** (the PGA TOUR leaderboard from ESPN and the
world ranking from OWGR) and the **Pro Shop** (what six golf brands have on sale, from each brand's own public store
feed). Each golfer picks what they follow or watch, and the page updates without a refresh. The Pro Shop replaced
**Flights** on 2026-11-02 (README, "Pivot: Flights → Pro Shop"); `/clubhouse/flights` now redirects to it. The
backend chart, as planned, as built, and after the pivot, is in `docs/data-flow.md`.

### 4 · Follow a tour player and watch them live
```mermaid
flowchart TD
  T0([Open /clubhouse/tour]) --> T1["Checking for the latest…<br/>event band · Your players · leaderboard · world ranking"]
  T1 --> T2{"An event this week?"}
  T2 -- "No" --> T3["No tournament this week<br/>the leaderboard goes up when ESPN posts the next field"]
  T2 -- "Yes" --> T4{"Following anyone yet?"}
  T4 -- "No" --> T5["Nobody followed yet<br/>Press Follow beside any player"]
  T5 --> T6["Find a player<br/>one search over the leaderboard and the world ranking"]
  T4 -- "Yes" --> T9
  T6 --> T7["Press Follow<br/>the button flips at once"]
  T7 --> V1{"Saved?<br/>Server Action · Clerk token · RLS · limit trigger"}
  V1 -- "The 21st player" --> E1["Toast: You're following 20 players, the most we keep.<br/>Unfollow one to add another. The button flips back."]
  V1 -- "Network or database error" --> E2["Toast: Couldn't save that. Try again in a moment."]
  V1 -- "Yes" --> T9["Your players, first<br/>position · to par · today · thru · world rank"]
  T9 --> T10{"In this week's field?"}
  T10 -- "No" --> T11["Not in this week's field<br/>world rank still shown"]
  T10 -- "Yes" --> T12["A score is posted<br/>the row washes Fairway Tint once<br/>a screen reader hears the new position and score"]
  T12 --> F1{"The freshness line"}
  F1 -- "fresh" --> F2["Updated 8 seconds ago"]
  F1 -- "stale" --> F3["Last updated 2 minutes ago.<br/>Waiting for the next update."]
  F1 -- "down" --> F4["The feed is down.<br/>Showing the last update, from 3 minutes ago."]
  T9 -- "Unfollow" --> U1["Removed · Undo"]
```

### 5 · Watch a category and see new deals live
```mermaid
flowchart TD
  S0([Open /clubhouse/shop]) --> S1["Checking for the latest…<br/>band: on sale · brands · deepest cut<br/>Your watch list · On sale now"]
  S1 --> S2{"Anything on sale?"}
  S2 -- "No" --> S3["Nothing on sale right now<br/>We check every five minutes;<br/>the first one appears on its own"]
  S2 -- "Read failed" --> E0["We couldn't read the shop<br/>Reload in a moment"]
  S2 -- "Yes" --> S4{"Watching anything yet?"}
  S4 -- "No" --> S5["Nothing watched yet<br/>Pick a category above<br/>On sale now: every card, deepest cut first"]
  S5 --> S6["Press a chip: Balls 10<br/>it flips at once"]
  S4 -- "Yes" --> S9
  S6 --> V1{"Saved?<br/>Server Action · Clerk token · RLS · limit trigger"}
  V1 -- "A 5th category" --> E1["Toast: You're watching 4 categories, the most we keep.<br/>Stop watching one to add another. The chip flips back."]
  V1 -- "Network or database error" --> E2["Toast: Couldn't watch Balls. Check your connection."]
  V1 -- "Yes" --> S9["Your watch list, first<br/>a card per deal: brand · name · −12% tile<br/>$69 and the struck $78 · In stock or Sold out"]
  S9 --> S10{"Deals in that category?"}
  S10 -- "None" --> S11["Nothing in Other on sale right now<br/>the first markdown appears here, at the top"]
  S10 -- "Yes" --> S12["A brand marks one down, drops a price, or sells out<br/>(the worker's next 5-minute run)<br/>the card arrives or changes and washes Fairway Tint once<br/>a screen reader hears: Price drop, now $19"]
  S9 --> S13["Everything else on sale<br/>category chips: All · Apparel · Hats …"]
  S13 -- "A chip with nothing in it" --> S14["Nothing in Hats on sale right now<br/>Show every category"]
  S9 -- "A card" --> S15["The brand's own product page<br/>in a new tab"]
  S9 -- "Press a watched chip" --> U1["Stopped watching Balls · Undo"]
  S12 --> F1{"The freshness line"}
  F1 -- "fresh" --> F2["Updated 4 minutes ago"]
  F1 -- "stale" --> F3["Last updated 20 minutes ago.<br/>Waiting for the next update."]
  F1 -- "down" --> F4["The feed is down.<br/>Showing the last update, from 6 minutes ago."]
```

### 6 · Freshness: what each state looks like
```mermaid
stateDiagram-v2
  [*] --> loading
  loading: loading · dashed ring · Checking for the latest…
  fresh: fresh · filled dot · Updated 8 seconds ago
  stale: stale · open ring · Last updated 2 minutes ago. Waiting for the next update.
  down: down · struck ring · The feed is down. Showing the last update.
  loading --> fresh: first read, latest run ok and finished within 3 intervals
  loading --> stale: first read, no ok run within 3 intervals, or the read failed
  loading --> down: first read, latest run has ok = false
  fresh --> stale: no ok run for 3 intervals (tour 30 s, deals 15 min, rankings 3 h), checked every 5 s
  stale --> fresh: an ok run arrives by Realtime
  fresh --> down: a run with ok = false arrives
  stale --> down: a run with ok = false arrives
  down --> fresh: the next ok run arrives
```
Thresholds, from `src/lib/live/useWorkerHealth.ts`: one interval is the cron schedule, so **fresh** means the last
ok run finished within 30 s for the leaderboard (10 s × 3), 15 minutes for the Pro Shop (5 min × 3) and 3 hours for the world
ranking (1 hour × 3). **Down** wins over the clock: it holds until the next ok run. A request without the worker
secret writes no run at all, so a broken secret shows as **stale**, not down. The line ticks every 5 s; only a change
of state is announced (`aria-live="polite"`).

### 7 · Trace one update: a birdie at the WWT Championship reaches my screen
```mermaid
sequenceDiagram
  autonumber
  participant E as ESPN
  participant C as pg_cron
  participant N as pg_net
  participant W as poll-tour
  participant D as diffRows
  participant P as Postgres
  participant R as Realtime
  participant B as Browser channel
  participant U as React state
  Note over E: Round 1, live.<br/>A birdie on the 7th:<br/>-3 to -4, thru 6 to 7
  C->>N: 10 s tick<br/>secret from Vault
  N->>W: POST poll-tour<br/>x-worker-secret
  W->>P: worker_secret_ok(p)
  P-->>W: true (else 401,<br/>nothing written)
  W->>P: read tour_events
  P-->>W: state in: live,<br/>fetch this tick
  W->>E: GET leaderboard<br/>8 s timeout
  E-->>W: ~230 KB JSON
  Note over W: parseLeaderboard<br/>1 event + 1 row a player
  W->>P: read saved rows
  W->>D: saved vs new<br/>key event_id + player_key
  D-->>W: 1 upsert (his row),<br/>0 deletes
  W->>P: upsert tour_leaderboard<br/>(secret key)
  W->>P: insert worker_runs<br/>ok, rows_changed 1
  P->>R: WAL change,<br/>in supabase_realtime
  Note over R: filter event_id=eq.id<br/>RLS as each golfer's<br/>Clerk token
  R->>B: UPDATE over<br/>the WebSocket
  B->>U: onRow: setBoardMap,<br/>touch, setLastChange
  Note over U: his row washes<br/>Fairway Tint once.<br/>Followed? The live<br/>region reads his score.
  R->>B: worker_runs INSERT<br/>source=eq.tour
  B->>U: useWorkerHealth:<br/>Updated just now
```
