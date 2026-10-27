# Design, Build, Ship — Assignment 4: Full Stack App (18 Eagles, continued)

MPCS 51238 · Autumn 2026 · UChicago · **Due Tue Oct 27, 5:30 PM**

This folder is the project root and the GitHub repo root (`hewittw/18-eagles-members`, work on branch `full-stack`,
merge to `main` after `/security-review`). It deploys to Vercel project `18-eagles-members`, live at
https://18-eagles-members.vercel.app (the submitted URL: `/clubhouse`). hw3's repo and site stay frozen.
This is the only context file. Don't add a CLAUDE.md here or in any folder above it.

## What We're Building
**18 Eagles**, a golf round journal (hw3), now with accounts: each golfer signs in with Clerk and their journal is saved
in Supabase, private to them, on every device. Live course data (OpenGolfAPI) and conditions (Open-Meteo) make it more
useful: find a course and fill its card in one step, see wind, rain and daylight for your tee time. The look stays:
a high-end clubhouse, Masters tradition remixed with Rancho Santa Fe, never copied.
- **Hub** (`/`): progress page. **Mood board**, **design system**, **research**, **flows**: public process pages.
- **The tool** (`/clubhouse/…`): `/clubhouse` is public (signed out: the welcome page, nobody's data). Everything under
  `/clubhouse/*` requires sign-in (`src/proxy.ts`).
Details: `docs/brief.md`, flows in `flows.md`, the full Week 4 rubric in `docs/assignment.md`.

## Data Model (read before building anything that saves)
Every table holding someone's data has `user_id text not null default (auth.jwt()->>'sub')` (the Clerk user id) and
RLS on, with four policies (select / insert / update / delete) requiring `((select auth.jwt())->>'sub') = user_id`.
Grants go to `authenticated` only, explicitly (new tables are NOT auto-exposed); `anon` gets nothing.
| table | key | holds |
|---|---|---|
| `profiles` | `user_id` | name, entered_index, goal, home_course, last_tee (jsonb), bag (jsonb), honors_seen, timestamps |
| `rounds` | `(user_id, id)` | one card: course_slug, tee_name, played_on, holes, mode, status, entries (jsonb, hole by hole), total_only, note, weather (jsonb) |
| `custom_courses` | `(user_id, slug)` | a course the golfer added (the Course object as jsonb) |
Built-in courses stay static files (`src/data/courses/`). Migrations live in `supabase/migrations/`.

## How data flows (don't break this)
Browser → `src/lib/store.ts` (in-memory Store, same API as hw3) → debounced Server Action `syncClub` / `loadClub`
(`src/lib/server/club-actions.ts`) → Clerk `auth()` → Supabase with the **publishable key + the user's Clerk token**
(`src/lib/server/supabase.ts`) → RLS. Never use a secret/service-role key. Reads have no user_id filter on purpose:
RLS is the gatekeeper and `tests/rls-isolation.spec.ts` proves it. External APIs are called only from our route
handlers in `src/app/api/` (auth check, validation, timeout, cache, trimmed response), never from the browser.

## Hard Rules (every task)
- **NEVER spend money.** Free tiers only (Clerk development keys, Supabase Free, Vercel Hobby, keyless APIs). Never
  upgrade a plan, add a payment method, or enable a paid or metered add-on. Supabase branching is paid: never use it.
- **Keys:** only in `.env.local` (gitignored) and Vercel env vars. The agent never reads `.env*` (deny rule in
  `.claude/settings.json`) and never prints a key. `scripts/push-env.sh` copies them to Vercel without printing.
- **Database:** the Supabase MCP (project-scoped) may apply schema migrations; `execute_sql` is denied, so the agent
  never writes rows. Save every migration as a file too. Destructive DDL needs the user.
- Next.js App Router + Tailwind. Design tokens go in `@theme`, classes in the markup. No packages we don't need (no chart
  libraries: charts are hand-built SVG). Push back if one is suggested.
- All images are static files in `public/`, with credits and licenses in `docs/credits.md` (API data attributions too).
- **Accessibility is required, not polish** (`docs/accessibility.md`): keyboard + visible focus ring, a real `<label>`
  on every field, contrast ≥ 4.5:1 (3:1 large text / UI boundaries), real `<button>`/`<a>` only.
- **Forms**: one column, a label on every field, errors next to the field that say what to do next, never lose input.
- **API states**: every external-data UI designs loading, nothing found, and API down.
- Use shared components (`src/components/`) everywhere. Every control has rest, hover, focus-visible, pressed,
  selected, and disabled states.
- Works at every size, phones to 2560. Verify UI in a real browser before saying it's done (`verify-ui` skill;
  signed in: `node scripts/shot-as.mjs golfer-a <outDir> <width> <paths…>`). A claim isn't evidence; a screenshot is.
- Never ship the agent's default look. Check `docs/avoid.md` before any visual work.
- No unit tests while prototyping unless asked; the one required Playwright test is `npm run test:rls`.

## Our Bar
- Finished and beautiful. High-end, specific, and unmistakably golf. Uniqueness is graded across ~28 students.
- The user steers and the agent executes. When unsure about a direction, offer options (AskUserQuestion).
- A one-shot result is graded incomplete, so iterate visibly in small steps.

## Keep a Trail (standing practice)
- **Commit after each meaningful step**, naming the change and the reason. The commit history is graded.
- **`DESIGN_LOG.md`**: append decisions as they happen (what we chose, why, what we rejected, where the user pushed back).

## Read When Needed
- **Resuming? Read `docs/HANDOFF.md` first** (current status and next steps).
- Week 4 rubric + "be ready to explain" → `docs/assignment.md` (hw3's is `docs/assignment-w3.md`)
- Answers to every "Ask Your Agent" prompt, diagrams → `docs/talking-points.md`
- The RLS test, failing then passing → `docs/rls-test/README.md`
- APIs, one real response explained → `docs/apis.md`
- Tool brief → `docs/brief.md` · Accessibility → `docs/accessibility.md` · Avoid → `docs/avoid.md` · Styles → `docs/styles/clubhouse.md`
- Writing Next.js code → the installed version's docs (`node_modules/next/dist/docs/` or next-devtools MCP)

## Tools Available
- MCP: `playwright` (its own fresh browser), `next-devtools`, `context7`, `supabase` (project `rihtmjtzrufkravyunuq`).
- Scripts: `scripts/shot.mjs`, `scripts/shot-as.mjs` (signed in as a Clerk test user), `scripts/matrix.mjs` (11 sizes),
  `scripts/push-env.sh` (user-run), `scripts/grade-photos.mjs`.
- CLI: `gh` (hewittw), `vercel` (team hew2), `npx clerk` (logged in; app "18 Eagles", dev instance). Test users:
  `golfer-a+clerk_test@example.com`, `golfer-b+clerk_test@example.com` (code 424242).
- **Never** use `chrome-devtools` MCP or Claude in Chrome (`/chrome`), or anything touching the user's own Chrome.

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
