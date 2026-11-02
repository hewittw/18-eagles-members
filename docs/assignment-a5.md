# Assignment 5: Live Data System (due Tue Nov 3, 5:30 PM). Full brief: `docs/assignment-a5.pdf`
Follow the PDF, not the slides: the worker is a **Supabase Edge Function run by Supabase Cron** (no Railway).
- **Live source** that changes on its own. **Data flow** chart before code (`docs/data-flow.md`).
- **Worker**: Edge Function, Cron every few seconds (10 s is the free-tier sweet spot; less often if the source limits),
  upserts only what changed, writes with the Supabase secret key (given by Supabase on its servers, never in code),
  records each run in a table. A test runs it on a saved copy of the source's response.
- **Live page**: updates without refresh (Realtime: publication + grant + RLS policy), shows freshness, with loading,
  fresh, stale (older than a few missed runs) and down (last run failed) states.
- **Personal**: each person chooses what they follow, RLS on their choices.
- **Deployed**: page on Vercel, worker running; a classmate can sign in, follow, and watch it update.
- `supabase` in tsconfig `exclude`. Context file is AGENTS.md. Free tiers only; Realtime counts every change × every open page.
- Be ready to explain: tracing a data change; the data flow and what breaks; freshness; what the tests check and what the logs showed.
