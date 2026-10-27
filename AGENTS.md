# Design, Build, Ship — Assignment 3: Patterns & Flows (An Everyday Tool)

MPCS 51238 · Autumn 2026 · UChicago · **Due Tue Oct 20, 5:30 PM**

This folder is the project root, the GitHub repo root, and the Vercel deploy root.
This is the only context file. Don't add a CLAUDE.md here or in any folder above it.

## What We're Building
A personal **golf round journal** for one golfer: play or log a round hole by hole, keep the history,
see a handicap and playing breakdowns over time. It should feel like a high-end golf clubhouse and locker room:
modern, plus old-school Masters tradition, remixed with the Rancho Santa Fe Golf Club feel. Never copy either.

One Next.js app with these parts:
- **Hub** (`/`): the progress home base. Links to the mood board, design system, research, flows, and the tool.
- **Mood board** (`/mood-board`) and **design system** (`/design-system`): one direction, "clubhouse".
- **Research** (`/research`): how 3 similar golf apps onboard someone new.
- **The tool** (`/<tool-slug>/…`): the submitted URL. Its own shared nav and a route for each step of the flow.
Details: `docs/brief.md`. Flows: `flows.md` (Mermaid, also shown in `README.md`).

## Hard Rules (every task)
- **NEVER spend money.** Free tiers only (Clerk dev keys, Supabase free, Vercel Hobby). Never upgrade a plan, add a
  payment method, or enable a paid or metered add-on. If an action could cost money, stop and ask.
- Next.js App Router + Tailwind. Design tokens go in `@theme`, classes in the markup.
- Data is saved only in the browser with **localStorage**. No database, accounts, backend, external APIs at runtime,
  or packages we don't need (no chart libraries: charts are hand-built SVG). Push back if one is suggested.
- All images are static files in `public/`, with credits and licenses in `docs/credits.md`.
- **Accessibility is required, not polish** (`docs/accessibility.md`): every control works by keyboard with a
  visible focus ring, every field has a real `<label>`, text contrast ≥ 4.5:1 (3:1 for large text and UI
  boundaries), and real `<button>`/`<a>` elements only.
- **Forms**: one column, a label on every field, errors next to the field that say what to do next
  ("Enter the course name", not "Invalid input"), and never lose what the person typed.
- Use shared components (`src/components/`) everywhere. Don't restyle a one-off button inside a page.
- Every control gets visible rest, hover, focus-visible, pressed, selected, and disabled states.
- Works at every size, phones to 2560. Before saying any UI change is done, verify it in a real browser
  (the `verify-ui` skill). A claim isn't evidence; a screenshot is.
- Never ship the agent's default look. Check `docs/avoid.md` before any visual work.
- No unit tests while prototyping unless asked.

## Our Bar
- Finished and beautiful. High-end, specific, and unmistakably golf. Uniqueness is graded across ~28 students.
- The user steers and the agent executes. When unsure about a direction, offer options (AskUserQuestion).
- A one-shot result is graded incomplete, so iterate visibly in small steps.

## Keep a Trail (standing practice)
- **Commit after each meaningful step**, naming the change and the reason, e.g.
  `round: add club-per-shot buttons on the hole screen`, not `update`. The commit history is graded.
- **`DESIGN_LOG.md`**: append as decisions happen: what we chose, why, what we rejected, and where the user
  pushed back. It feeds the in-class explanation.

## Read When Needed
- **Resuming in a new session? Read `docs/HANDOFF.md` first:** the current status and next steps.
- Full requirements and grading checklist → `docs/assignment.md`
- Tool brief, routes, data → `docs/brief.md`
- Accessibility checklist (owned by the agent) → `docs/accessibility.md`
- Looks to avoid → `docs/avoid.md`
- Style tokens and rules → `docs/styles/clubhouse.md` (written with the design system)
- Writing Next.js code → read the docs for the installed version (`node_modules/next/dist/docs/` or next-devtools MCP)

## Tools Available
- MCP: `playwright` (its own fresh browser), `next-devtools` (dev-server errors, routes, docs), `context7`.
- Scripts: `scripts/shot.mjs` (one screenshot), `scripts/matrix.mjs` (11 screen sizes), `scripts/capture-references.mjs`.
- CLI: `gh` (logged in as hewittw), `vercel` (logged in).
- **Never** use `chrome-devtools` MCP or Claude in Chrome (`/chrome`), or anything that touches the user's own
  Chrome or a logged-in browser profile. Browser checks are Playwright only.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
