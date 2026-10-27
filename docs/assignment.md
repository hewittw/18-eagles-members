# Assignment 4: Full Stack App (rubric and evidence map)

Source: `../Design, Build, Ship - Assignment 4 - Full Stack App.pdf`. Due **Tue Oct 27, 2026, 5:30 PM**.
Submit in Google Classroom: (1) the Vercel URL, https://18-eagles-members.vercel.app/clubhouse, and (2) the GitHub URL,
https://github.com/hewittw/18-eagles-members (README + a commit history that shows progress).

## Requirements → where it's met
| Requirement | Evidence | Status |
|---|---|---|
| Accounts: sign up / in / out with Clerk; signed-out sees no one's data | `src/proxy.ts`, `ClubhouseGate.tsx`, test 1 in `tests/rls-isolation.spec.ts` | done |
| Data in Supabase, RLS on every table | `supabase/migrations/`, advisors clean | done |
| External API with loading / nothing found / down states | OpenGolfAPI + Open-Meteo via `src/app/api/`, `docs/apis.md` | done |
| Persistence across sign-out and devices | name saved in one browser shows in a fresh one (verified 2026-10-26) | done |
| Keys in env vars only, deny rule | `.claude/settings.json`, `.gitignore`, `scripts/push-env.sh` | done |
| Playwright test, watched failing first | `docs/rls-test/README.md`; also passes against production (`production-run.txt`) | done |
| `/security-review` on a branch, findings handled | `docs/security-review.md`, then merged to `main` (3e12f44) | done |
| Deployed on Vercel; a classmate makes an account | live; classmate test needs the user | live / classmate pending |
| UI/UX quality (design process, principles, flows) | hw3 design system, all 3 feedback items fixed, independent QA (axe 0) | done |
| Stack: Next.js + Tailwind, Clerk (dev keys), Supabase, Vercel Hobby, AGENTS.md only | — | done |

## Steps and their "Ask Your Agent" prompts (answers in `docs/talking-points.md`)
1. Choose tool + API: "Explain this response: what each field means, and which ones my tool needs."
2. Plan the data (2–3 tables, user_id, write it in AGENTS.md): "Draw a diagram of my tables…"
3. Protect keys (deny rule before the first key): "Explain why this deny rule protects my keys… publishable vs secret."
4. Clerk (`npx -y clerk@latest init`), check signed out: "Show me… what clerk init added, file by file."
5. Supabase + MCP scoped to one project; Clerk third-party auth; tables as migrations with RLS: "Explain each RLS policy… and a query it would block."
6. Where to call the API; design loading / empty / down: "Draw a diagram of one request, from the click to the screen."
7. Playwright test, break RLS, watch it fail, fix: "Explain why the test failed… in one sentence."
8. Branch, `/security-review`, read the changes, deploy with env vars, classmate test: "Quiz me…"
Also: "Walk me through the free tier limits for each service… and how to set usage limits and spending alerts."

## Be ready to explain
1. Tracing a save: browser → server → Clerk → Supabase → API.
2. Access control: where the app knows who you are; where it decides what you may see.
3. Where API calls happen, and why there.
4. The failing test, and what changed.
5. Agentic workflow: what we stopped the agent from doing; what we caught reading its changes.

A one-shot submission is marked incomplete.
