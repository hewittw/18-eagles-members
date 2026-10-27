---
name: up-to-speed
description: Loads the full Week 4 / Assignment 4 handoff (what the assignment asks, every decision so far, what's set up, the hard rules, and what comes next) so a fresh session continues exactly where the setup session stopped. Use at the start of a new session, or when the user says "up to speed", "catch up", "where are we", or "pick up where we left off".
---

# Up to speed: Assignment 4, Full Stack 18 Eagles

> **Update 2026-10-27:** setup and nearly all the build are DONE. The current status and what's left live in
> `docs/HANDOFF.md`; read it first. The "Next steps" below are the original setup plan, kept for history.

You are continuing a session that already did all of the setup. Read this whole file, then reply with a 5-line status
(where we are, what's next) and ask for anything listed under "Waiting on the user". Don't redo finished steps.

## Hard rules (in addition to AGENTS.md)
- **NEVER spend money.** Free tiers only: Clerk development keys, Supabase Free, Vercel Hobby. No upgrades, no payment
  methods, no paid or metered add-ons. Supabase **branching is paid**, so never use it. If an action might cost money, stop and ask.
- **Never read `.env` or `.env.*`** (a deny rule in `.claude/settings.json`). The user edits `.env.local`. Never ask them to paste secrets into chat.
- **The Supabase MCP is read-only** (`.mcp.json`: `read_only=true&features=docs,database,debugging,development`,
  locked to project `rihtmjtzrufkravyunuq`). The user chose this on purpose. **Migrations go like this:** write a SQL file in
  `supabase/migrations/<timestamp>_<name>.sql` → explain it in plain words → the user pastes it into Supabase → SQL
  Editor → Run → you check the result with the MCP (list tables, RLS on, policies present). Never loosen read-only
  without asking.
- Never use chrome-devtools MCP or the user's own Chrome. Use the Playwright MCP / scripts (isolated Chromium).
- The user wants to **understand** each step, because the course grades "be ready to explain" and marks a one-shot
  submission incomplete. Work in small steps, explain what you did and why, and answer each step's "Ask Your Agent" prompt
  as you go. Commit after every meaningful step with a descriptive message (the history is graded).
- When you set something up through a CLI or MCP, say what it added. Afterwards, check `/mcp` and `/context`.

## The assignment (due Tue 2026-10-27, 5:30 PM)
Full brief: `../Design, Build, Ship - Assignment 4 - Full Stack App.pdf` (read it if you need detail). Course
materials: `../Design, Build, Ship - Week 4 - Slides/` and `../Design, Build, Ship - Week 4 - Async/` (videos plus .vtt transcripts).

**Requirements:** Clerk sign up/in/out, and a signed-out visitor sees no one's data · data in Supabase with RLS on
every table · one external API with designed **loading / nothing found / API down** states · data persists across
sign-out and other devices · keys only in env vars, plus the deny rule · **one Playwright test: two users each save
something and neither sees the other's, watched FAILING (RLS broken on purpose) before it passes** · `/security-review`
run on a branch and its findings handled · deployed on Vercel where a classmate can sign up and use it · UI/UX quality.
**Stack:** Next.js + Tailwind, Clerk, Supabase, Vercel Hobby, a GitHub repo with a README. `AGENTS.md` is the only
context file (no CLAUDE.md).
**Submit:** the Vercel URL and the GitHub URL.
**Be ready to explain:**
1. Trace a save through the browser, server, Clerk, Supabase and the API.
2. Where the app knows who you are, and where it decides what you may see.
3. Where the API calls happen, and why there.
4. What the failing test looked like, and what changed.
5. What we stopped the agent from doing (for example: the MCP is read-only, it can't read .env, there's no branching) and what we caught in review.

Step-by-step "Ask Your Agent" prompts from the PDF:
1. Explain one real API response field by field.
2. Diagram the tables and how each row belongs to one person.
3. Why the deny rule protects the keys; publishable vs secret keys.
4. What `clerk init` added, file by file.
5. Each RLS policy in plain words, and a query it would block.
6. Diagram one request from the click to the screen.
7. Why the test failed with RLS broken, in one sentence.
8. Quiz the user on the "be ready to explain" questions.

## Decisions made (and why)
- **Extend Assignment 3, "18 Eagles"** (a golf round journal: hole-by-hole scoring, handicap, stats, trophies; it was
  localStorage only). This folder `week4/hw4` is a `git clone` of `week3/hw3` with the full history, on **branch
  `full-stack`**. **There's no git remote yet**: we removed origin so `github.com/hewittw/18-eagles` and
  `18-eagles.vercel.app` (the graded hw3) stay frozen. Plan: a new GitHub repo plus a **new** Vercel project. Ask before
  creating either, because both are outward-facing.
- **APIs:** the user wants "a couple", starting with **weather** (Open-Meteo, no key; for example, the forecast at your home
  course or for a tee time). Others are still to be decided with the user.
- **How Supabase is reached: the Framework client (`@supabase/ssr`), with the publishable key plus the user's Clerk token,
  so RLS enforces ownership.** Not the secret/service-role key, which would bypass RLS and make the RLS test meaningless.
  Server code (server actions / route handlers) checks Clerk `auth()` first. External APIs go through our own route
  (for example `/api/weather`) so we can cache, trim the response and stay under rate limits. The user asked "why not
  Server/Build APIs?" and accepted this reasoning: two layers of protection.
- **Supabase project settings at creation:** Data API ON, "automatically expose new tables" **OFF**, automatic RLS **ON**.
  ⇒ **Every migration must `GRANT select, insert, update, delete ... TO authenticated`** explicitly on each table, or the
  Data API can't see it. Each table holding someone's data needs `user_id text not null default auth.jwt()->>'sub'` plus
  policies of the form `(select auth.jwt()->>'sub') = user_id`.
- **Clerk ↔ Supabase:** connected by hand. The Clerk session token has the custom claim `{"role": "authenticated"}`,
  and Supabase's Third-Party Auth has the Clerk provider with the Frontend API URL.

## What's set up (commits on `full-stack`)
- `.claude/settings.json`: deny `Read(./.env)`, `Read(./.env.*)`, `mcp__chrome-devtools`; `enabledMcpjsonServers: ["supabase"]`.
- `AGENTS.md`: the never-spend-money hard rule was added. **The rest still describes hw3 ("localStorage only, no
  database/accounts/APIs"), so it must be rewritten for Week 4**, including the data model (assignment step 2), before building.
- `@supabase/supabase-js` and `@supabase/ssr` installed. Supabase agent skills are in `.claude/skills/supabase` and
  `supabase-postgres-best-practices` (use them for schema/RLS work). `verify-ui` is also there from earlier weeks.
- `.env.local` (the user's; you can't read it) holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  **The Clerk keys are not there yet.** `clerk init` writes them.
- The Clerk app "18 Eagles" (Consumer, Email + Google, Development instance), the Supabase project `18-eagles`
  (ref `rihtmjtzrufkravyunuq`, Free, East US), and the MCP authenticated read-only.

## Next steps, in order
1. **`npx -y clerk@latest init`.** The user will paste Clerk's dashboard "Copy prompt"; follow it, show the checklist,
   and wait for a yes. The user approves the CLI login in the browser. Then explain what it added, file by file, and check
   that signed out you can't reach `/clubhouse/*`.
2. **Plan the data with the user** (2–3 tables: probably rounds, with holes as jsonb or a child table, plus a profile/bag;
   courses could stay static), write it into AGENTS.md, and get their OK.
3. Migrations (SQL files → the user runs them → verify with the MCP). Replace the localStorage reads/writes with Supabase,
   per user. Decide whether to import someone's existing localStorage data on first sign-in, and ask.
4. Weather (and any other APIs) through server routes, with the loading / empty / down states designed in the 18 Eagles style.
5. **Address the user's hw3 feedback**, which they'll paste in. If they haven't, ask for it.
6. The signed-out marketing/landing state (the hub/landing is public; everyone's data is private).
7. The Playwright test: two Clerk test users (dev instance test emails `name+clerk_test@example.com`, verification code
   `424242`; the passwords go in `.env.local`, which the user adds). Break RLS → watch it fail → fix → pass. Record what it looked like.
8. `/security-review` on the branch, fix the findings, merge. Create the GitHub repo and Vercel project (ask first). The user
   pastes the env vars into Vercel (`CLERK_SECRET_KEY` marked secret), deploys, and shares the **public**
   `*.vercel.app` URL (not the team-scoped one). Get a classmate to test. Update the README (new URL, stack, RLS, test).

## Waiting on the user
- Their **hw3 feedback** (they want to address it this week).
- Clerk's setup prompt and the CLI login approval.
- Running migration SQL, adding the test-user passwords to `.env.local`, the Vercel env vars, and a classmate test.
- Leftovers they were asked to delete (check, and remind them if still present): `../.mcp.json` (a stray Supabase MCP config
  with branching turned on) and `.claude/settings.local.json` (harmless).

## Pointers
- The course playbook: `../../playbook/PLAYBOOK.md` (machine setup, the verify-with-evidence habit, deploy recipes, gotchas).
- hw3 docs carried over in `docs/` (brief, avoid.md, styles, accessibility, verification) and `DESIGN_LOG.md`: keep
  appending decisions there. `docs/assignment.md` is the **hw3** rubric; write a Week 4 version (or update it) from the PDF.
- Instructor walkthrough tips: Clerk ↔ Supabase must be connected on both sides (done). Vercel needs the env vars before
  the first working deploy. The Vercel URL can come out team-scoped or private, so share the public one.
