# 18 Eagles

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
