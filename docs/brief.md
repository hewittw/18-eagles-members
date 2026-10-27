# Tool Brief: Golf Round Journal

**Name:** _TBD with the user._ **Tool route prefix:** _TBD_ (`/<tool-slug>`).

## What it is and who it's for
A personal golf journal for one golfer (the user), on their phone at the course and on their laptop at home.
They play or log a round hole by hole, the app keeps the history, and over time it shows a handicap and
breakdowns of how they play. It gets more useful with every round, and it should be useful after the first.

## The feel (the user's direction)
"Sleek, unique, and exclusively golfy. Modern, but like a golf clubhouse and locker room. Finished and beautiful."
A remix of the **Rancho Santa Fe Golf Club** website's feel (https://www.rsfgolfclub.com/: understated private-club
luxury, Southern California light, generous space) and **old-school Masters tradition** (Augusta green, the
hand-operated white leaderboard, scorecard typography, restraint, ceremony). Don't look like either; feel like both.
"High-end, perfect golf."

## The user's feature asks (to be shaped into flows)
- **Home:** the handicap in big numbers at the top.
- **Breakdowns:** lots of interactive playing breakdowns, with filtering views of play over time.
- **Choose a course:** a separate page to pick a course to play, with images of that course.
- **Playing a round:** a great interface to mark the score on each hole, with notes/thoughts, and which club was used
  for each shot. Really cool button UI that is fully accessible.
- **Other pages** the agent proposes (locker / bag, round history, round detail, add a course…).
- Works on phones and computers; tested at every size. Accessible throughout (agent owns it).
- "Pretty expansive" while keeping the assignment's stack: Next.js + Tailwind + localStorage only.

## Flows (draft, being worked out with the user; final version in `flows.md`)
- **First visit:** open with nothing saved → useful right away (no empty dashboard, no tour).
- **Main task:** pick a course → play hole by hole (score, clubs, notes) → finish → see the round and what changed.
- **Coming back:** open before the next round → handicap and trend, last time at this course → play again, beat it.

## Data (localStorage, one versioned key, e.g. `<slug>:v1`)
- Courses: name, location, holes (par, yards, handicap index per hole), tees (rating, slope), image + credit.
- Rounds: course, tee, date, status (in progress / complete), per hole: strokes, shots (club per shot), putts,
  fairway, penalties, note. Round note.
- Bag: the clubs the golfer carries (feeds the club buttons).
- Handicap is derived, never stored: a simplified World Handicap System index from score differentials.

## Routes (provisional)
| Route | Step |
|---|---|
| `/` | Hub (progress home base, not part of the tool) |
| `/mood-board`, `/design-system`, `/research` | Process pages |
| `/<slug>` | Tool home: handicap, welcome back, resume a round |
| `/<slug>/play` | Choose a course (with images) |
| `/<slug>/play/[course]` | Course detail + tee choice + start |
| `/<slug>/round/[id]/[hole]` | The hole screen: score, club per shot, notes |
| `/<slug>/round/[id]` | Round summary / scorecard |
| `/<slug>/rounds` | History |
| `/<slug>/stats` | Breakdowns with filters |
| `/<slug>/locker` | The bag and preferences |

## APIs (Week 4)
Two free, keyless APIs, both called only from our own route handlers (`/api/golf/search`, `/api/golf/course/[id]`,
`/api/weather`), never from the browser: OpenGolfAPI fills the add-a-course form and shows course facts; Open-Meteo
gives conditions, a 7-day tee sheet, and the wind on the hole screen, and a live card keeps the weather it was played
in. Where the calls happen and why, plus one real response from each explained field by field: `docs/apis.md`.
