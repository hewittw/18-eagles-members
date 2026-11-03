# Design Log — Assignment 3

Running log of real decisions: what we chose, why, what we rejected, and where the user pushed back.
Append as decisions happen, newest at the bottom.

---

## 2026-10-19 · Choosing the tool
- Read all Week 3 materials first: the assignment PDF, the text of all 95 slides, and the 62-minute
  walkthrough transcript.
- **The agent first suggested** a lacrosse practice planner (the user is MLAX president), then compared
  the user's two ideas: a golf round tracker and a pickleball Elo ladder. Against the rubric, pickleball
  fit slightly better on paper (a faster first visit, a natural one-column form). The agent said the
  deciding question was which one the user actually plays.
- **The user picked golf.** The user also asked the agent to set aside their detailed spec and follow the assignment.

## 2026-10-19 · Hub or standalone
- The agent recommended a standalone tool, with the process work living in the README.
- **The user overrode this:** they want a hub like Week 2, to see progress at a glance, and will submit the
  tool's own route as the Vercel link. So `/` is the hub, and the tool lives under its own prefix with its own nav.

## 2026-10-19 · Direction
- **The user's brief:** sleek, unique, exclusively golfy. Modern, but like a clubhouse and locker room. A remix
  of the Rancho Santa Fe Golf Club site's feel and old-school Masters tradition. "High-end, perfect golf."
- **The user's feature asks:** a home page with the handicap in big numbers, interactive breakdowns with filters
  over time, a course picker with course images, a hole-by-hole screen with score, club per shot, and notes,
  with great accessible buttons. It has to work on mobile and desktop, tested at every size, with accessibility
  owned by the agent.
- **Process:** one mood board and one full design system, built by Opus subagents, while the agent and
  the user work out the flows together.
- **Scaffold:** Next.js 16.4.2 + Tailwind v4 (create-next-app, src/ dir, TS), generated in a temp dir and moved
  into `week3/hw3`. Carried over from Week 2: a slim AGENTS.md with on-demand docs, the `verify-ui` skill, the
  matrix and shot scripts, and the chrome-devtools deny rule.

## 2026-10-19 · Decisions from the user (first round of flow questions)
- **Name: "18 Eagles".** The user's pick: "inspired by 18Birdies, but distinctly different and our own." The repo is
  `hewittw/18-eagles`, the Vercel site is https://18-eagles.vercel.app, and the tool lives at `/clubhouse`.
- **Courses:** all the options offered, plus the big US PGA venues, famous Scottish links, and the user's home clubs
  Rancho Santa Fe GC and Fairbanks Ranch CC. That's about 30 real courses. Three data agents are filling them in
  against a strict schema (`src/lib/course-types.ts`) with a checker (`scripts/check-courses.mjs`). Only freely
  licensed photos are allowed, and ratings with no published source are marked `estimated`.
- **Logging:** both, with live play first. The hole screen is built for the course, plus a quick "log a round
  you've played."
- **First visit:** "Ask, then play." The handicap hero itself asks one question (enter your index, or earn one with
  a 0/3 tracker), with "Play a round" right below it.

## 2026-10-19 · Onboarding research (3 parallel agents → `docs/research/`)
| App | First visit | What we take | What we avoid |
|---|---|---|---|
| GHIN | Handicap is the whole home screen (giant number over a course photo); "NH" until 54 holes | Big number + quiet low-index line + trend chip; "next score to drop off"; par-relative score tiles (3 EAGLE / 4 BIRDIE / 5 PAR) in thumb reach | Gating the number behind membership; no teaching at all; forgetting your last tees |
| 18Birdies | Account + password + gender first, then Play → nearest course preselected → ~3 taps to hole 1 | Preselect the likeliest course; one goal question ("Break 90") turns empty stats into targets; the handicap explainer + change line (20.1 → −0.3 → 19.8) | Account walls; fairway asked on par 3s; putts allowed to exceed strokes; upsells on the score path |
| Arccos | Bag setup (select + pair 14 clubs, 5–15 min) before any value | A pre-filled standard bag, editable later; one-tap club chips per shot; putts stepper; honest stats from round one | Setup before value; stats that are blank until 5 rounds |
- **Our first visit, from this:** no account, no setup. The hero asks one question and shows the 0/3 handicap
  tracker. A home course is preselected, and "Tee off at hole 1" is one tap. The bag comes pre-filled. The
  numbers are honest after a single round.

## 2026-10-19 · Hole screen and returning (second round of questions)
- **Hole entry:** score tiles plus optional clubs (the user picked the recommendation). One tap records the score.
  If clubs are logged shot by shot, the score counts itself, and a mismatch is reconciled with a question.
- **Hole extras:** all four: putts (can't exceed the score), fairway (par 4s and 5s only, from the 18Birdies
  complaint), penalties + notes, and a yardage-book hole illustration.
- **Goal question:** yes, inline in the hero (Break 100 / 90 / 80 / scratch).
- **Coming back:** all four: handicap movement with the next score to drop off, beat your last card at this
  course, resume + last round's note, and quiet "season honors" (no streak pressure, per the lecture on
  healthy habits).
- **Flows:** written in `flows.md` and shown in the README. The first combined Mermaid render was a tangle,
  so it's split into three diagrams, rendered to static SVG at dev time (`scripts/render-mermaid.mjs`).
- **Design system = the real component library.** `docs/components.md` fixes the component names and props, so
  the design system and the pages can be built in parallel and `/design-system` shows the exact components the app uses.

## 2026-10-19 · Home-course photos
- No freely licensed photos exist of Rancho Santa Fe GC or Fairbanks Ranch CC. The agent offered a drawn
  illustration, the user's own photos, or captioned scenery of the area.
- **The user chose web photos** ("just get images off Google"). The agent flagged that they're copyrighted and the
  site is public. These are used for a class project with a visible credit to the owner and marked "All rights
  reserved" in the data and credits, so they're easy to swap. Every other course stays freely licensed.

## 2026-10-19 · Mood board: "The Members' Ledger"
- **Ceremonial · Tailored · Sunlit.** 29 artifacts (15 collected, public-domain or CC, plus 5 credited study crops of
  rsfgolfclub.com and masters.com; 14 made in code). Palette: Scorecard Paper, Linen, Tile White, Ink, Pencil, Locker
  Green, Fairway, Brass, Old Brass, Under-Par Red, Covenant Slate. Type: Libre Caslon Display/Text, Barlow,
  Barlow Condensed (tabular numerals).
- **Rules learned:** brass on paper is only 2.32:1, so brass text on paper uses Old Brass and brass stays on green.
  A brass focus ring on a Fairway button is 2.84:1, so focus rings sit offset on the surface around the button.
- **Rejected:** copying any club mark (no Masters, Augusta, or RSF crests). The board evokes the tradition
  instead: hand-hung leaderboard tiles, circle/square card marks, an engraved certificate, brass locker plates.
- Launched the design-system agent right away (the user is reviewing the board in parallel and can redirect).

## 2026-10-19 · Design system = the component library
- The Opus design-system agent built tokens (`@theme`), fonts (Libre Caslon Display/Text, Barlow, Barlow Condensed),
  and every contract component in `src/components/ui` + `src/components/golf`. `/design-system` renders them in every
  state, with live demos and forced hover/pressed/focus (`data-force`).
- **Contrast:** 33 pairs measured by script, all passing. Forbidden pairs are documented and never used (brass on paper
  2.32:1, under-par red on Locker Green 1.72:1). Errors use rust, kept apart from under-par red, so an error never
  reads as a score.
- **Squared corners** (1–3px) and no soft SaaS shadows: a tile's bottom lip and brass plates instead.
- Its chart fixes: the goal line moved from brass to Old Brass (brass fails on paper), and heat-map text stays ink on mid tints.

## 2026-10-19 · Pages: built in parallel against the contract
- **Main session:** the core flow. The Clubhouse (first visit and coming back), the Tee off panel, the hole screen,
  and the finished card with "the story of the round."
- **Builder 1:** Courses (search + filters, your record per course, no dead-end "no match"), the course page,
  the **add-a-course form**, and the Locker (bag, index/goal, honors, export/import, sample season, erase).
- **Builder 2:** Stats (filters kept between visits, the trend with a metric switch, mix/par types/putting/front-back/
  clubs/hole heat, and "How your index is made" with counting differentials), Cards, and the **log-a-round form**.
- **Hole screen decisions:** logging clubs on an unscored hole counts the score and putts itself. A mismatch asks
  "Use 5 as my score / Keep 4" instead of silently overwriting. Finishing with unscored holes offers to score them,
  finish as the front nine, or save for later, so an incomplete card never posts.
- **Bugs caught by checking:** primary buttons rendered as outlines (the default variant is secondary); a duplicated
  score label; the tab title didn't name the hole; and lint found a ref read during render (new honors), now marked
  seen in an effect cleanup. The first prod check showed 404s that turned out to be the deploy still propagating.

## 2026-10-19 · The user pushed back on the look
- "It still looks super AI… use the masters website fonts and colors, no off-white Claude-looking background… professional
  and actually Masters-like." The cream "Scorecard Paper" (#F5F0E4) plus Caslon read as the AI or Claude default. **Decision:**
  re-skin the tokens toward masters.com: white surfaces, Masters green, Masters yellow, and the closest licensable fonts. The
  components and flows stay as they are.

---

# Week 4 — Assignment 4: Full Stack (18 Eagles, continued)

## 2026-10-26 · Carry Weeks 1–3 forward
- Extending 18 Eagles rather than starting over: the user wants each week to build on the last. Kept the hw3 design
  system, flows, accessibility bar, verify-ui skill, scripts, and this log.
- Setup decisions so far (details in `.claude/skills/up-to-speed/SKILL.md`): new branch `full-stack` with no remote, so
  hw3 stays frozen; `.env` deny rule; Supabase MCP read-only by the user's choice (migrations are pasted by the user);
  publishable key + Clerk token, so RLS (not our code alone) decides what each person sees; Open-Meteo weather first.
- Started using Claude's persistent memory for preferences and status across sessions.

## 2026-10-26 · Course photos graded into one sunlit set (instructor feedback)
- **Feedback:** "I wonder if maybe the images of each course could be photo-treated, or 'normalized', so they all look
  like part of the same set… as simple as ensuring they all have sunny/blue skies." The 26 courses mixed grey Scottish
  overcast, hazy California, dusk, and over-saturated phone shots, so the Courses grid read as a collage.
- **Chosen: one "sunlit clubhouse" grade** (`scripts/grade-photos.mjs`, using sharp, which was already installed). Every
  photo gets the same 3:2 crop (sharp's attention crop) and at most 1600px width. Then it gets levels from its own
  histogram and a gamma that brings the exposure up to one shared brightness. Dark photos get lifted and bright ones are
  almost never darkened. A white balance is taken from the photo's bright near-neutral pixels (clouds, sand, white
  walls) and pulled toward a slightly warm neutral, with each colour channel's gain capped at ±10%. Duller colours get
  a little more saturation (more for grass greens and sky/water blues), and highlights get a touch of warmth.
- **The sky:** a soft mask scores each pixel as sky-like: bright, grey or already blue, never green. Each column's sky
  line is smoothed across neighbouring columns and fades with depth. Grey skies blend toward a clear late-morning blue
  (deeper at the top, paler at the horizon), keeping the pixel's own brightness so the cloud texture survives.
  Skies that are already blue barely change. Originals stay untouched; the app now points at `graded/` copies.
- **Iterated on contact sheets (5 rounds).** Round 1 darkened most photos (its gamma aimed for a mid-grey mean), so the
  target was raised and darkening capped. Round 2 turned clipped white skies cyan, so the sky colour is now capped
  below clipping. Round 3 found two bugs. Sharp's blur returned three channels, which striped the sky. The per-column
  mask also left hard blocks, plus a cut-out round Kiawah's sunlit cloud. Round 4 replaced it with the smoothed soft
  mask and a fade with depth, so the ocean below a hazy horizon isn't painted. Round 5 capped darkening (gamma ≤ 1.04).
- **Rejected:** replacing skies or generating them (fake, and out of keeping with credited photos). A strong filmic or
  teal-orange look ("an Instagram filter"). A full gray-world white balance, which turns links grass magenta. Painting
  sky into the three hand-tinted postcards (Jackson Park, Pinehurst): they get crop and levels only, and stay archival.
- **Licences:** every course photo allows changes. CC BY-SA copies keep CC BY-SA, and this is noted in `docs/credits.md`.
  The home clubs have no photos, so nothing "All rights reserved" was touched.

## 2026-10-26 (night) · Accounts and data: the main session's decisions
- **The user's answers up front** (so the rest could run unattended): run Clerk's checklist; the agent "can write
  schema rules, but never actually write data"; new public repo + Vercel project `18-eagles-members`; every account
  **starts fresh** (no import of hw3 localStorage); APIs: OpenGolfAPI + Open-Meteo.
- **Making "never write data" mechanical, not a promise:** dropped `read_only` from the Supabase MCP (so
  `apply_migration` works) and added `mcp__supabase__execute_sql` to the deny list, the only tool that could insert
  rows. When the MCP later refused a `drop policy` (destructive DDL needs a human), the agent used `alter policy`
  rather than asking for the rule to be loosened.
- **Keys:** the agent can't read `.env.local`, so moving keys to Vercel was a user-run script (`scripts/push-env.sh`,
  values piped, never printed, `CLERK_SECRET_KEY` as sensitive). **User pushback:** "why can't you just use vercel like
  in the past?" Past weeks had no secrets. After the script was explained, the user told the agent to run it itself;
  only names were printed.
- **Tables:** three (`profiles`, `rounds`, `custom_courses`), shaped like the hw3 Store, so `store.ts` kept its API and
  no page changed. Hole entries stay jsonb inside a round (always read and written whole). **Rejected:** a `holes`
  child table (18× rows, nothing queries a single hole server-side); one jsonb blob per user (it would make RLS and
  the "two users" test meaningless at row level).
- **Sync:** the in-memory Store is diffed against the last server-confirmed state and sent in one debounced Server
  Action. **Rejected:** writing from the browser with supabase-js (it would work with RLS, but the server-side path
  gives one place to check Clerk and clamp input); the service-role key (it bypasses RLS).
- **Reads have no `user_id` filter on purpose**, so RLS alone keeps journals apart and the test can actually fail.
- **Caught while checking:** (1) the Clerk app forced Organizations, so every new session was "pending" and the app
  treated signed-in golfers as signed out. Found by logging Clerk's console warning, fixed with `clerk config patch`.
  (2) `<Show>` in a server component rendered signed out under cacheComponents, so the gate became a client component
  reading `useAuth()`. (3) The Vercel project, created from an empty temp dir (so `vercel link` couldn't overwrite
  `.env.local`), had its framework set to "Other" and served `public/` as a static site (404). Pinned `nextjs` in
  `vercel.json`. (4) The dev server was serving stale code, so screenshots looked wrong until it was restarted.
- **The RLS test** failed with RLS broken (Avery saw Blake's card), then passed once fixed: `docs/rls-test/README.md`.
- **Advisors:** security flagged Supabase's own `rls_auto_enable()` as callable by anyone (revoked); performance
  flagged per-row `auth.jwt()` (rewritten as `(select auth.jwt())`). Both are clean now.

## 2026-10-26 (night) · Outside data: OpenGolfAPI and Open-Meteo, made into golf features
- **Where the calls happen:** only in our route handlers (`/api/golf/search`, `/api/golf/course/[id]`, `/api/weather`).
  Each checks Clerk, validates input, times out at 6 s, caches on the server (`"use cache"`: a day for courses, 10 min
  for weather on a ~1 km grid), and returns only the fields we show. **Rejected:** calling the APIs from the browser
  (both allow CORS): no auth check, no shared cache, and every golfer would spend OpenGolfAPI's per-IP daily limit
  (the live header says 500, not the 1,000 in the docs).
- **Instructor feedback on Add a course ("a lot of required fields… speed it up"):** "Find your course" at the top
  fills par, stroke index, every tee's rating/slope, the card's hole yards and the location. Only the name is required
  now; par starts as a standard layout and is folded until changed. Blank rating/slope become par and 113, saved as
  `source: "estimated"`, so the handicap math still runs and the course page and tee choice say "est.".
  **Rejected:** keeping rating/slope required (the reason the form felt slow), and guessing a rating from yardage
  (looks exact, isn't).
- **Weather where a golfer wants it, not a widget:** "Conditions at <course>" beside Tee off (sky, wind needle with a
  club adjustment, rain in the next 4 hours, a one-line read, and "enough light for 18 if you tee off by 1:45 PM":
  sunset − 4 h 15 m, 2 h 10 m for 9); a 7-day "Tee sheet forecast" with a best-day call on course pages; a quiet wind
  needle on the hole screen; and each live card keeps "Played in 62°F, 9 mph W, Sunny" (`round.weather`).
  **Rejected:** an icon-and-temperature badge in the nav (decoration), emoji weather icons (`docs/avoid.md`).
- **Built-in courses match by a static file** (`src/data/course-geo.ts`: slug → OpenGolfAPI id + coordinates, looked
  up once), not a fuzzy runtime search. Three Scottish courses aren't in OpenGolfAPI; several are pins only, so
  "Course facts" says "OpenGolfAPI only knows where Carnoustie is" instead of an empty box.
- **States:** a skeleton the shape of the answer, nothing found with next steps, and "resting" when the service is down
  (what still works + an action). Tested for real: `?api=down` in development makes our route call the real upstream
  with a 1 ms timeout.

## 2026-10-27 · Accounts made native, and the header recedes (instructor feedback)
- **Feedback: "the header is a little noisy once I dig into the mechanisms below."** Chose a bar that *recedes* rather
  than leaves: it's sticky at a small negative top, so its first 12–20px tuck under the edge as you scroll; slim, the
  wordmark shrinks, the tab icons fold away and the labels drop to 80% white (still 5:1), and the brass rule becomes a
  soft shadow. Hover or keyboard focus inside the bar brings the labels back. Only transforms, opacity and colour
  change, so nothing on the page moves; reduced motion gets the same two states with no tween. The hole screen starts
  slim. **Rejected:** slide away on scroll down / back on scroll up (the bar "breathing" on every flick is the noise
  the feedback named, it fights FocusClear and the skip link, and the way out of a round disappears); shrinking the
  bar's real height (shifts the page under your thumb and can loop on short pages); hiding the tabs entirely.
- Found on the keyboard pass (and already true in Week 3): Shift+Tab into the bar scrolled the page to the top,
  because its controls sat inside `scroll-padding-top`. A negative scroll margin on the bar's controls fixed it.
- **Account control: our own, not Clerk's `<UserButton/>`.** The golfer's initials on a brass-ringed tag (the
  roundel's family) open a small card: who's signed in, Your locker, Your account (Clerk's profile modal), Sign out
  back to `/clubhouse`. It's a disclosure (Tab through, Esc or click outside closes), not an ARIA menu.
  **Rejected:** a themed `<UserButton/>` (Clerk's popover chrome and violet default avatar still read as Clerk).
  Clerk is themed once on `<ClerkProvider>` from `tokens.ts` (green, Franklin/Oswald, our radius, a green-toned
  default avatar), with its CSS in Tailwind's `base` layer so our classes win (the documented separate `clerk` layer
  statement was dropped by the build).
- **Signed out, the bar is just the wordmark and Sign in.** Every tab but the welcome needs an account, so showing
  them would be five doors that bounce you to a sign-in. Before Clerk loads, the welcome reserves the tabs' space
  invisibly (no flicker either way).
- **Members' entrance** around Clerk's forms: Shinnecock's clubhouse, the wordmark back home, three plain lines on
  what an account gives you. **Welcome** at `/clubhouse`: Turnberry hero with the two doors, the three things it does
  beside a sample card (Turnberry's front nine, drawn and labelled as nobody's round), and a plain privacy note.
  **Rejected:** the centred-hero + three-feature-cards + CTA-band SaaS layout (`docs/avoid.md`).
- **Copy:** "this device / this browser" became "your account"; "Erase everything" became "Erase my journal", which
  says it deletes the rows in your account on every device and that the sign-in stays. Export stays as a copy for
  your own records, no longer the only backup. The first-run name is prefilled from the Clerk first name.

## 2026-10-27 · Four off-set course heroes replaced (instructor feedback, second pass)
- After grading, four heroes still broke the sunny set: Pinehurst No. 2 (a halftone postcard), Riviera (an aerial over
  houses), Jackson Park (a tinted postcard) and Turnberry (a deep orange sunset). **Chosen:** use a daylight,
  ground-level photo as each hero, and move the old one into the gallery instead of deleting it.
  Riviera: its own gallery already had one (the 18th green below the clubhouse). Pinehurst: the Donald Ross sign by
  No. 2. Turnberry: a new Commons photo, Walter Baxter's Ailsa green with Arran behind (CC BY-SA 2.0). Jackson Park: a
  new Commons photo of open Jackson Park parkland (JulDer Wiki, CC BY 4.0), captioned honestly as the park and not as a
  hole. The two postcards now hang in the galleries, captioned "From the archive".
- **Rejected:** Pinehurst No. 4 photos and an unnamed "golf course in Pinehurst" (both are the wrong course); the
  Seattle "Jackson Park golf course" photo; Riviera Country Club photos of the course in Ormond Beach, Florida; and
  painting skies into the postcards (it would fake them).
- The changed heroes got new file names (`hero-18th.jpg`, `hero-sign.jpg`, `hero-green.jpg`, `hero-park.jpg`). If we
  reused `hero.jpg`, the Next image optimizer, and later a CDN, would keep serving the old picture for that URL.
- Kiawah's sun had a ring around it. Two causes: the white balance turned the clipped disc cream inside a white glow,
  and the blue sky blend stopped at the disc's edge. Now the gains fade out on clipped pixels, and a soft halo around
  the brightest sky pixels is kept out of the blend.

## 2026-10-27 (early) · Review, QA, merge, ship
- **`/security-review`** on `full-stack` found no high- or medium-confidence issues. We applied its hardening notes anyway
  (server-side enum checks, http(s)-only links in custom courses). We kept `/api` out of `auth.protect()` on purpose,
  because our 401s carry a readable sentence and a protect() 404 doesn't (`docs/security-review.md`).
- **Independent QA agent** (it didn't build anything): every flow, at four sizes, with keyboard and axe. It fixed four
  bugs: the forecast strip couldn't be reached by keyboard, course names were cut off mid-word ("Torrey Pines Nort…"),
  unknown URLs showed Next's bare default 404, and a console warning on the sign-in photo. I then fixed its legend note.
  **Left as is:** a golfer who skipped the name question gets a nameless greeting, and new accounts now get their Clerk
  first name prefilled.
- **Photo follow-up:** four off-set heroes swapped for daylight shots. That silently changed the welcome page's photo,
  under a caption promising a lighthouse. I caught it from the agent's note and pinned the welcome to the sunset
  lighthouse photo.
- Merged `full-stack` → `main` (no fast-forward, so the review point shows in the history), deployed, and the RLS test
  passed 3/3 **against production**.

### User testing, morning of the due date
- **"Now · 6:30 AM" at 6:32** (user): the label showed the forecast's timestamp, which only moves every 10 minutes. The
  clock now ticks each minute in the course's own timezone; the weather still refreshes every 10 minutes. The first
  version read the time during render and failed the Vercel build on the prerendered design-system page (the old deploy
  stayed live); the time is now read only in the browser.
- **Save my goal jumped to the top** (user): focus went to the tee-off heading at the top. The question now becomes a
  "Goal saved" note in the same place, focused without scrolling. Rejected: smooth-scrolling up to the challenge card,
  since it was already on screen and any movement reads as a jump.
- **Course page: unclickable photos and a big white gap at MacBook width** (user). Thumbnails now swap into the big frame
  (the credit follows the photo). The gap was measured, not guessed: the left column was ~945px against ~1450px on the right
  at 1512. The 7-day forecast (~650px) moved under the photographs on wide screens using grid placement, so phones still
  get Tee off first. Gaps are now 40-240px at every width. OpenGolfAPI facts run full width in two columns. Rejected: a
  sticky right column (taller than the screen) and a lightbox modal (more to build and test than swapping the frame).
- **Photos for the two home clubs** (user supplied, `../golf-images/`). Fairbanks Ranch: the user's own iPhone photos,
  resized with all metadata stripped (they carried GPS) and the driver head trimmed off one edge. Rancho Santa Fe: two
  web images (GolfPass, and a Sanity CDN image). Asked the user, since every other photo is CC or their own; they chose
  to use them, credited and marked all rights reserved. The Rancho hero's purple haze graded to a lime band, so the
  haze is neutralised first and the sky step blues it.
- **Weather cards end level** (user: conditions and forecast bottoms didn't line up). On wide screens both columns
  stretch to the same bottom: the tee sheet's rows share any spare height, the conditions card spreads it between its
  parts, and the tee sheet's key and credit move inside its card (like the conditions card). Measured 0px difference on
  8 courses at 1024-2560. Phones unchanged.

## 2026-11-02 · A5 foundation (worker plumbing, follows, two new tabs)
- **Shared contract first.** Migrations (files only, applied later by the user through the Supabase MCP): `worker_runs`
  (read-only for golfers, in the realtime publication, daily cleanup of runs older than 2 days as its own cron
  migration), the Vault `worker_secret` made inside the database from `gen_random_bytes` (nobody sees it), and
  `worker_secret_ok()`, which only `service_role` may call. `followed_players` and `followed_airports` follow the hw4 RLS
  convention. `followed_airports` sits in its own later file because it references the Flights agent's `airports` table.
- **Limits live in the database.** The 20-player and 6-airport caps are plain before-insert triggers. They count the caller's
  own rows, take a per-golfer advisory lock so two quick taps can't both become the 21st, and let a re-follow pass. The
  error starts with `follow_limit`, so the Server Action can say it in words. Rejected: a security-definer trigger,
  since the caller's own RLS-visible rows are exactly the rows to count.
- **One `playerKey`, two copies.** `supabase/` is outside the app's tsconfig, so the app keeps a copy. A Node test
  proves the two agree on every name in the saved ESPN and OWGR responses. `ø`/`æ`/`ß` are folded by hand, because
  NFKD leaves "Højgaard" as "h-jgaard".
- **`diffRows` compares loosely on purpose.** A database round-trip (`"12.5"` vs `12.5`, `…Z` vs `…+00:00`) must not
  count as a change, or every 10-second tick would send a Realtime message for every row.
- **Seven tabs at 320 px.** With seven equal columns, "Clubhouse" and "Courses" broke mid-word, at 390 as well. The tabs
  now size to their labels. Below 400 px, the icon pill narrows and labels drop to 10 px (iOS's tab-label size).
  Measured first: the old layout needed 327 px at 320. The **desktop bar** also wrapped to two rows at 768 and 1024.
  md gets tighter caps, lg keeps the old spacing without icons, and icons return from xl (1280). Rejected: moving the
  phone tab bar up to lg (it touches ~10 sticky bars in other pages) and hiding the wordmark's name on tablets.
- `npm run test:worker` globs the test folder, because Node 25's `--test` doesn't expand a bare directory.

## 2026-11-02 · A5 Tour: poll-tour worker and the live /clubhouse/tour page
- **Tables** (`20261102132000_tour.sql`, applied): `tour_events`, `tour_leaderboard`, `tour_rankings`, exactly per the
  plan. Read-only for `authenticated`, nothing for `anon`, `service_role` granted explicitly (the project doesn't
  auto-expose tables), all three in `supabase_realtime`. Advisors: no security findings; only "unused index" infos on
  the brand-new indexes.
- **One event at a time.** When ESPN moves to next week's event, the worker deletes the old event row and the cascade
  clears its leaderboard. A week with no event leaves last week's board up, marked Final. Rejected: keeping every
  event (the page only ever shows one, and each kept row costs storage and Realtime traffic for nothing).
- **Adaptive polling, with one refinement.** The plan says "within 30 minutes of the start time", but ESPN's event
  date is midnight ET, hours before anyone tees off. Polling every 10 s from then on would waste about 2,500 calls. The
  decision (`shouldFetchLeaderboard`, pure and tested) uses the earliest stored tee time when there is one, and the event
  date only before the field is posted. "Last real fetch" counts failed fetches too, so a source that's down is retried
  every 5 minutes, not every tick.
- **What a row stores.** `thru` is the hole count, `F`, or the tee time as an ISO instant (the page shows it in the
  golfer's own time). A withdrawal before any shot shows "E" on ESPN with every round "-", which we store as no score,
  not even par. Cut and withdrawn players get no position and no "today". OWGR points are the average, rounded to 2
  decimals so float noise never counts as a change. The ranking deletes players who drop out of the top 200, but only
  when OWGR sends a full page (at least 100 rows), so a short, broken response can't wipe the table.
- **Proved on the deployed function** (v1): first call 121 rows (event + 120 players) and 200 rankings. Second call: the
  leaderboard was `idle: no live round` (no ESPN call) and the rankings 0 (`unchanged`). After 5 minutes a real ESPN
  refetch came back `0 up, 0 gone`. A call without the header got 401 and wrote no run.
- **Page.** It starts with the event band on Locker Green (name, course, dates, a Final/Round pill, the leader on a
  hand-hung tile). Then Your players, then one search box over the leaderboard and the world ranking (side by side
  from xl). Players who missed the cut or withdrew fold behind a toggle: the first full-field render was 8,400 px tall at
  1440. The follow toggles are real buttons with `aria-pressed`, always named "Follow <player>", so the visible
  label stays inside the accessible name. Phones get the drawn mark only, still 44 px. Rows a push changed wash Fairway
  Tint once (Web Animations, skipped under reduced motion). Only changes to a followed player's position or score
  are announced. Unfollow offers Undo, not a confirm.
- **Realtime deletes can't be filtered**, so the leaderboard channel listens to inserts and updates filtered
  `event_id=eq.<id>` and to deletes unfiltered, then drops any delete for another event (the old record carries the key).

## 2026-11-02 · A5 Flights ("Getting there")
- **Airports seed:** OurAirports, every large airport with an IATA code plus scheduled medium ones in the golf countries
  (MRY, SAV, HHH, INV, CLD…): 1,955 rows. The seed travels to Supabase as text through the MCP, so it's a compact
  `code|icao|name|city|country|lat|lon` block split in SQL, cut into four ~40 KB migrations. After applying, an md5
  fingerprint of the table matched the generator's, so nothing was mistyped on the way. Rejected: every scheduled
  medium airport worldwide (255 KB, ~70% more to send for airports no golf trip here uses).
- **Coarsened rows, no seen_at.** Phase (ground / arriving / departing / passing over, read from height and climb, since
  adsb.lol has no routes), altitude to 1,000 ft, distance to whole nm. A parked plane is never rewritten. Measured on
  the live worker: the second call 18 s after the first changed 40 of 68 rows, almost all moving aircraft crossing a
  1 nm or 1,000 ft line. That is real movement, not noise; if Realtime volume matters later, the next lever is 2 nm bands.
- **One call per airport, shared.** The worker polls the distinct followed airports (most-followed first, max 6, ORD
  always), two at a time. A failed airport keeps its rows; a 429 skips the rest of the tick.
- **adsb.lol rate-limits Supabase's shared egress.** Two of the first five test calls got 429 for every airport while
  the same URL answered 200 from a laptop. The board handles it (a "held from the last good sweep" frame, "Asked to
  slow down" on an empty board, the freshness line says down), but at a 30 s cron some ticks will be 429s.
- **Realtime can't filter DELETE events**, so the page listens to inserts/updates with `airport=in.(…)` and to deletes
  unfiltered, dropping the ones for airports it doesn't show.
- **States, from the worker's own run detail:** "ORD 43 (+3 −2 ~5)" tells the page an airport was swept (so empty means
  "Quiet skies"), failed, or wasn't swept yet ("Waiting for the first sweep"), or isn't among the six this tick.
- **The board:** four hand-hung count tiles on a Locker Green band (2×2 below 400 px, where four clipped their labels),
  then arrivals nearest the field first. A pushed row washes Fairway Tint once (none under reduced motion). An
  airborne plane rounded to 0 ft reads "Under 500 ft", not "0 ft".

## 2026-11-02 · Design review of the two live pages (Tour, Flights) against the rest of the site
A fresh-eyes pass by a reviewer agent that didn't build them, signed in as golfer-a (2 players, ORD + CLD) and golfer-b
(follows nothing), at all 11 sizes, compared with /clubhouse/stats and /clubhouse/courses at the same widths. States were
forced with Playwright route interception, never by touching the database: Supabase websocket + REST held open
(loading), REST aborted (down), worker_runs aged 40 minutes (stale), the follow Server Action aborted (failed follow).
Evidence and contact sheets: `screenshots/a5/review/` (gitignored).
- **Two follow buttons that pressed differently.** Tour's was Locker Green with a brass tick and the word "Follow"; Flights'
  went Fairway with "Following". Now one `golf/FollowToggle`, in ToggleChip's grammar (pressed = Locker Green + brass
  tick, the same as every filter on the site) and Button's condensed caps. The word stays "Follow", so the visible label
  is inside the accessible name ("Follow Scottie Scheffler"); `aria-pressed` carries the state. Rejected: "Following"
  as the pressed word (speech users say what they see, and it isn't the name). It has its own spec on /design-system.
- **Flights' airport boards were square-cornered with no lift** while every other surface on the site (Card, the Tour
  event band, the Stats board) is rounded with the card shadow. They now match.
- **Below the 12 px floor:** table heads, count-tile labels, "New", the cut row and the held-data note were 11.5 px;
  now `text-label` (12.5 px). That made four count tiles clip "Departing" at 430, so they go 4-up from sm (640), not 400.
- **Layout at 1024:** one airport board stretched to 1,000 px with callsigns and altitudes 800 px apart; boards now sit
  side by side from lg instead of xl.
- **Type rule:** the course name in "Near your courses" was Caslon Display at 23 px (Display is 28 px and up); now Caslon
  Text bold, like Tour's player cards. Airport names wrap at 320 instead of truncating ("McClellan-Palomar Airp…").
- **Voice:** "sweep" is the worker's word, not the clubhouse's. Visible copy now says "check" or "update" ("Showing the last
  good update", "Waiting for the first check", "Not watched right now"). The data-credit lines were left alone (another
  agent was editing them); the footer credit still says "swept every 30 seconds".
- **States:** the event band's error was a hand-made heading; it now uses ApiState (tone green) like every other down
  state. A followed player read "Outside the world top 200" while the ranking was still loading or had failed; that line
  now waits until the ranking has actually loaded.
- **Checked and fine:** no horizontal overflow at any size; focus ring on every stop (ink on paper, yellow on green),
  logical order, `aria-pressed` on every toggle, real labels on both search fields, `<th scope>` and captions on the
  tables. New pairs measured: brass tick on Locker Green 5.32:1, Fairway on Tint 5.95:1, Pencil on a followed row
  (Tint 60%) 6.74:1, red on it 6.03:1, the toggle's border 3.56:1. Toasts (Undo, failed follow) are the shared Toast,
  above the tab bar.
- **Left for the user (judgment, not fixed):** the full leaderboard (68 rows) pushes the world ranking ~6,000 px down
  below xl and costs 68 Tab stops; Flights numbers its sections I/II/III while Tour and the older pages don't; neither
  page has the photograph/illustration band the Clubhouse and course pages lead with. Not fixed either: both live pages
  log a Next dev error for `Date.now()` in a `useState` initialiser (useWorkerHealth, Freshness), which is the live
  logic another agent owns.

## 2026-11-02 · Finishing the live pages: the Realtime budget guard, and the review's leftovers
- **Stop listening when nobody is looking.** One Flights tab left open took ~5–9k Realtime messages an hour, so one
  forgotten tab for a month is past Supabase Free's 2M. `src/lib/live/useLivePause.ts` (one module-level store, used by
  `useWorkerHealth`, `useTourLive`, `useFlightsLive`) pauses after **60 s hidden** (resumes by itself when the tab is
  visible) or **30 minutes with no pointer/key/scroll/focus** on a visible tab (resumes only with the
  "Resume live updates" button in `golf/LivePauseNotice`: a real button in a polite live region, in the Toast's look,
  above the phone tab bar; after resume, focus goes to the page's h1 and the slip says "Live updates are back on").
  Paused = each hook's effect returns early, so its cleanup removes the channel; realtime-js then closes the socket
  itself ~50 s later. Resume re-runs the effects: subscribe first, refetch on SUBSCRIBED, the same order as on mount.
  The Freshness line says "Live updates paused. Last updated …" with a drawn pause mark, never stale or down.
  **Proved with Playwright** by counting `phx_join`/`phx_leave` frames on the Realtime WebSocket (no hook in the app):
  Tour 5 channels → hidden 30 s still 5 → hidden 63 s **0** → socket closed at ~118 s → visible: 5 joins, then the 7
  snapshot reads. Flights idle (Playwright clock jumped 31 minutes): 2 → **0** → Resume (keyboard Enter) → 2, then reads.
  Rejected: closing on `blur` (a second monitor still shows the board) and auto-resuming idle on any mouse move (a
  cat on the keyboard shouldn't restart a month of pushes; one button press is cheap).
- **Next dev issue fixed.** `Date.now()` in two `useState` initialisers (useWorkerHealth, Freshness) tripped Cache
  Components' prerender check. One shared 5 s clock (`useNow`, useSyncExternalStore, 0 on the server and during
  hydration, treated as "loading") replaces both.
- **Honest freshness on idle weeks.** When the latest ok tour run is `idle: …` the worker only confirmed no round is in
  play, so the line reads "Checked 8 seconds ago · no round in play", not "Updated".
- **Flights failure copy.** With the adsb.fi fallback, a failed airport means both feeds missed it, so "adsb.lol asked us
  to wait" became "Couldn't reach the flight feeds; showing the last good update". The footer says "checked", and cites
  and links both adsb.lol (ODbL) and adsb.fi (its terms require it).
- **Tour leaderboard opens on its top 25** with "Show all N", the same pattern as the world ranking; search covers every
  row and shows every match. From xl the ranking is sticky (top-24, clear of the bar) only when it fits the window and
  neither list is open in full. Measured at 1280/1440/1920/2560: the two previews end within 1 px of each other. With the
  leaderboard's "Show all" open the ranking ends ~2,500 px early by design (the user asked for normal scrolling then).
- **Consistency:** Flights' I/II/III numerals removed. "Near your courses" is now cards built like Tour's player cards.
  Both pages lead with a photograph band: the Clubhouse hero's photo + wash + credit became `golf/PhotoBand`, and Tour uses
  Augusta's 18th beside the LEADERS board, Flights Pebble Beach's 18th (both already graded and credited; nothing downloaded).
- **RLS:** `test:rls` now runs the followed_players checks for `followed_airports` too (read, delete, forge, signed out).
  5 passed, twice, against the dev server.
- Screenshots (gitignored): `screenshots/a5/final/` (both pages at 320–2560, paused/resumed, the column measurements).

## 2026-11-03 · Flights becomes a trip: your location, where you're playing, the flights between
- **What the user said** (on the airport-board page): "This page at the top should have a get-your-current-location so
  it can suggest flights if needed. I'm confused by the '+ Home' tag: it makes it look like home isn't suggested but
  Fairbanks Ranch is. 'Follow' makes it look like follow Fairbanks, not the airport. Not very accurate either: San Diego
  would be better than Palomar. Make it so you can only use Flights if you enable location. Then the board, which
  becomes way too huge with all the flights, should just be flights between your location and the airport you're
  looking at." And on the follow-up: "not super intuitive... confusing about the mix between them, maybe combine. Be
  creative, but remember less is more."
- **The page now reads as three short steps.** A location gate first (nothing else renders until a position is known;
  it asks only when "Use my location" is pressed, unless the browser already says "granted"; denied, no fix / timeout,
  insecure and unsupported each have their own words; "Your location stays in this browser. We save only the airport
  code."). Then "You're near MDW · Chicago Midway International · 9 mi", then **one** choice list, "Where are you
  playing?": the golfer's courses (home first, a plain "Home course" tag) and a last option "Somewhere else" that opens
  the airport search in place. Then "Flights between MDW and SAN right now", grouped "To San Diego" / "Back to Chicago",
  or "You can drive this one" (same airport, or under 150 mi straight line). Rejected: keeping Follow buttons on course
  cards, separate "courses" and "pick an airport" sections, "Your airports" / "Add an airport" headings, ORD always
  watched, follow counts. The footer credit is one line.
- **The "+":** the shared gold Tag drew a four-point star that read as "add". Tags are labels, not actions, so the star
  is gone everywhere (it also marked "Counts" on round cards).
- **Accurate airports.** `airports.kind` (large/medium, OurAirports' type) and one rule (`src/lib/live/suggest.ts`): the
  nearest large airport within 75 mi, else any within 75 mi, else a large one within 250 mi. Fairbanks Ranch and
  Rancho Santa Fe → SAN (not CLD). The Chicago Loop → **MDW**, not ORD: Midway is large and 9 mi away against O'Hare's
  15, so the rule (tested) picks it; golfer-b, placed by O'Hare, gets ORD. Flagged for the user: Pebble Beach now gets
  SJC (large, 55 mi) over Monterey (medium, 5 mi); Augusta gets AGS because nothing large is within 75 mi.
- **The worker watches routes.** `trips` (one per golfer, RLS like hw4) → distinct pairs (A↔B is one), most-shared
  first, max 4, none under 150 mi. Per airport one 100 nm call; airline callsigns get their route from **adsbdb**
  (≤ 30 lookups a run, 150 ms apart, moving aircraft first, cached 7 days in a service-role-only table). Flights flying
  the pair go to `trip_flights` with a phase and progress to 5 %; ones that left both circles are found by hex (adsb.lol
  takes a comma list, so one call). `trip_pairs` says whether a pair has been checked and which airlines fly it, so the
  page can say "Finding flights on your route…" and "Southwest flies this route; check back soon." `airport_flights`
  left the Realtime publication; nothing was dropped.
- **Caught on the first live runs:** WN 3224 MDW→SAN showed "95% of the way" while climbing out of San Diego. Airlines
  reuse a flight number all day and adsbdb knows one route per callsign, so it was the next leg. v5 drops a seen-but-
  off-route flight at once; v6 rejects descending into the origin, climbing out of the destination, and (at cruise,
  outside both terminal areas) a track more than 100° off the bearing to the destination. Tests pin each rule.
- **Privacy:** coordinates live only in React state. The airport lookup reads a lat/lon box snapped outward to a
  2-degree grid, so even the request can't place the golfer closely; `trips` stores two codes and a label.
- **adsbdb's terms:** the route data's authors ask that it not be "incorporated into other databases" without
  permission. Our cache is private to the worker and short-lived, and the page shows only each flight's two airports;
  noted in `docs/credits.md` as an open question for the user.
- **Proved:** golfer-a picked Rancho Santa Fe by keyboard (Space) from the Loop: "Finding flights…", then WN 3224 arrived
  by Realtime with no reload; golfer-b chose "Somewhere else" → SAN by O'Hare: waiting, then AA 1543 and UA 2486. Runs
  after the cache warmed: `MDW-SAN 1 flight (1 lookups, 1 tracked), ORD-SAN 2 flights (2 lookups, 0 tracked)`, 1–5 s.
  `test:worker` 56 pass; `test:rls` 6 pass (new: trips). Screenshots: `screenshots/a5/trip/`.

## 2026-11-03 · Airport alternatives, and a faster Tour load
- **What the user said:** the automatic airport was surprising: the Chicago Loop gets MDW when they expected ORD, and
  Pebble Beach gets SJC (55 mi) though MRY is 5 mi away. The rule stays. Following "less is more", the page now offers
  up to **two alternatives** beside each pick: "You're near MDW · … · 9 mi / or [ORD 16 mi] [GYY 21 mi]", and under the
  chosen course "Or fly into [MRY 6 mi] …" (the card already names the airport in use, so the line doesn't repeat it).
  Each is a real quiet Button named "Use ORD, Chicago O'Hare International, 16 miles instead". After a swap, focus goes
  to the line or card that changed (the pressed button is gone). `nearbyAlternatives` (suggest.ts, pure): every
  airport within 75 mi except the pick, large first, then nearest. Tested on the seed: Loop → MDW, ORD offered first;
  Pebble Beach → SJC, MRY offered.
- **Remembering the choice:** the chosen codes go in the trip row (`from_airport`, `to_airport`); nothing about
  coordinates is stored. A saved origin wins while it is still one of the airports offered for where the golfer is now.
  (A trip saved at Pebble Beach with MRY, opened from Chicago, falls back to MDW.) That's how we check "still the same
  automatic pick" without storing the pick. Rejected: a separate "choose your airport" control, a dropdown of all
  airports, and badges on the course cards. Flagged: from Rancho Santa Fe the alternatives are TIJ (Tijuana, large) and
  SNA. The rule puts a cross-border airport second.
- **Tour load, measured** (Playwright, signed in, time to the first leaderboard row, `screenshots/a5/alt/measure.mjs`):
  dev median **1472 → 955 ms**; production build median **1399 → 928 ms** (spread 908–1904 → 913–968). Three causes:
  (1) `useWorkerHealth` made two `worker_runs` reads per source (latest, latest ok), so 4 per load. Now there's one
  shared store per source (one channel, one snapshot for every caller), and a second read only when the latest run
  failed: **2 reads**. (2) The leaderboard's channel and read waited for the event's read. Now the event and board
  channels subscribe together, and once both say SUBSCRIBED, **one** embedded read returns the newest event with its
  board (`tour_events?select=…,tour_leaderboard(…)`). The board channel no longer filters by event. The table holds one
  event, so the messages are the same, and other events' rows are dropped client-side. Subscribe first, then snapshot,
  is unchanged. (3) `listFollows` was a Server Action, and Next dispatches those one at a time, so it queued behind
  `loadClub`. The follow list is now a browser read through RLS. Follow and unfollow stay Server Actions. Flights had
  one worker-health caller (no duplication), but it shares the one-read change, and its `getTrip` read moved to the
  browser for the same queueing reason. Realtime: Tour still joins 5 channels, all "Subscribed to PostgreSQL".
- Screenshots (gitignored): `screenshots/a5/alt/` (Chicago and Pebble Beach at 320/390/1280/2560, swaps, focus ring, Tour).

## 2026-11-03 · Routes from adsb.im, not adsbdb (poll-flights v7)
- **Why:** adsbdb's route data "may not be copied, published, or incorporated into other databases without the explicit
  permission of David J Taylor", and `callsign_routes` was exactly that. The user chose adsb.im's batch **routeset**
  (`POST http://adsb.im/api/0/routeset`), whose routes are Virtual Radar Server's standing data (CC0-1.0).
- **Checked with curl first** (real User-Agent; fixtures `adsbim-routeset-small.json` and 138 callsigns around MDW in
  one call, `adsbim-routeset-mdw*.json`, 0.5 s): an array in request order; `_airport_codes_iata` ("SAN-ORD", "SAN-ORD-SAN",
  "unknown"), `_airports` with each stop's `iata/lat/lon`, `airline_code`, `number`, `plausible`; some entries `null`.
  111 of 138 plausible, 21 implausible (PHL-BOS over Chicago: stale data), 14 multi-stop.
- **Unexpected, flagged for the user:** adsb.im's own API index says routeset data is "augmented with data from parsing
  live ACARS messages as well as analyzing data from the adsb.lol API; as such the data returned should be considered to
  be under the ODBL 1.0 license". So it isn't pure CC0. ODbL allows our cache with attribution, so the switch still
  fixes the problem, but the credit says ODbL, and the source value is `'adsb.im'` rather than `'vrs-cc0'` (which would
  claim a license the rows don't have). Usage notes from the same index: plain http, a contactable User-Agent, batch.
- **What changed:** one POST per run with every uncached callsign and its position (chunks of 100, ≤ 200), instead of
  ≤ 30 GETs 150 ms apart. Implausible, unknown and null answers cache as misses (1 day). The cache keeps every stop
  (`route`, `stops` jsonb), and the board picks the leg each aircraft is flying (`pickLeg`: flightState's other-leg rules
  per leg, then the leg whose phase fits the climb/descent, then the one it's nearest the line of). Flight numbers
  print from a static ICAO→IATA map (UAL2486 → "UA 2486"). Migration `20261102160000` added `source`/`route`/`stops`
  and deleted every adsbdb-derived row. The run detail now ends `routes adsb.im 162/200 found in 2 calls, traffic lol×3`.
- **adsb.lol / adsb.fi health** (the user's priority): the 60 runs before the change showed no 429 and no failure
  (p95 3.3 s over 24 h), but v6's detail never said which source answered, so a fallback was invisible. v8's detail
  does (`traffic fi×3 (lol 429×3)`): in the first 14 runs after the switch, 6 fell back to adsb.fi because adsb.lol said
  429 (Supabase's shared egress), all ok, 1.5–4.5 s; adsb.im never failed. That's 3 point calls and at most one hex call
  a tick, so our own volume isn't the cause and the 100 nm circles stay. One guard added: on a tick where adsb.lol
  already said 429, the hex lookup skips adsb.lol and goes straight to adsb.fi (≤ 4, spaced 1.1 s with the circle calls).
- **Live after v8:** UA 1779 (adsb.im route SAN-ORD-BOS) on the ORD-SAN board as SAN → ORD arriving: the multi-leg pick
  working on a real flight. 300 cached routes, all `source = 'adsb.im'`, 0 adsbdb rows. MDW-SAN: no flight in the air yet;
  adsb.im called SWA3224 ONT-PHX (implausible over Chicago) where adsbdb said MDW-SAN, so Southwest coverage may differ.
