# Handoff: pick up where the last session left off (Week 4)

Read this first in a new session, then `AGENTS.md` (always loaded), `docs/assignment.md` (rubric + evidence map) and
`docs/talking-points.md`. Decisions are in `DESIGN_LOG.md` (newest at the bottom).

**Due: Tue Oct 27, 2026, 5:30 PM.** Submit **https://18-eagles-members.vercel.app/clubhouse** and
**https://github.com/hewittw/18-eagles-members** in Google Classroom.

## How to work here
- Branch `full-stack` → merge to `main` (after `/security-review`, done: `docs/security-review.md`).
- Dev: `npx next dev -p 3300`. Signed-in screenshots: `node scripts/shot-as.mjs golfer-a <outDir> <width> <paths…>`.
  RLS test: `npm run test:rls` (add `BASE=https://18-eagles-members.vercel.app` to run it against production).
- Deploy a clean worktree of HEAD (half-finished agent files never ship):
  ```
  W=$TMPDIR/deploy-wt-w4; git worktree remove --force $W 2>/dev/null; git worktree add --detach $W HEAD
  mkdir -p $W/.vercel && cp .vercel/project.json $W/.vercel/ && cd $W && vercel deploy --prod --yes
  ```
- Env vars are already in Vercel (Production), copied by `scripts/push-env.sh`. Never read `.env*`.
- Database: schema changes via the Supabase MCP `apply_migration` + a file in `supabase/migrations/`. Never write rows
  (`execute_sql` is denied). Destructive DDL needs the user.

## Status (2026-10-27, early morning)
Done: Clerk accounts; Supabase tables + RLS; persistence across devices (verified); OpenGolfAPI + Open-Meteo through our
routes with all three states; the instructor feedback (course search fills the form with only the name required, photos
graded into one set with 4 hero swaps, the receding header); account menu, welcome, sign-in pages; the RLS test watched
failing then passing; `/security-review` with hardening; README, AGENTS.md, talking points, rubric map.

Open / needs the user:
- **A classmate makes an account on the live site and uses it** (required; only the user can arrange it).
- Optional: claim nothing else in Clerk (dev keys are what the brief asks for). Supabase Free pauses after 7 idle days:
  open the app once a week until grades are back.
- Practise the 5 "be ready to explain" answers in `docs/talking-points.md` (ask the agent to quiz you, step 8).
