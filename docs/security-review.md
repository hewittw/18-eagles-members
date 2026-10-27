# /security-review on the `full-stack` branch

Run 2026-10-27 (about 00:15 Chicago) with Claude Code's `/security-review`, on `full-stack` against `main` (39 commits),
before merging. Scope: all code, migrations, scripts and config. Images, vendored skill docs and markdown were excluded.

## Result: no high- or medium-confidence vulnerabilities
What the reviewer checked, and why it holds:
- **Access:** `/clubhouse/*` needs a Clerk session (`src/proxy.ts`). Each `/api/*` handler calls `auth()` and returns 401
  first. The Server Actions go through `supabaseForUser()`, which throws when no one is signed in.
- **RLS / writing as someone else:** `syncClub` sets `user_id` from the server-side Clerk `userId`, never from the
  client. Every table has `with check (sub = user_id)` on insert and update, `anon` has no grants, and the
  break-on-purpose policy was restored. No secret or service-role key exists anywhere.
- **SSRF / injection:** API hosts are fixed. User input only reaches the query string through `URLSearchParams`,
  after validation (UUID course id, two-letter state, numeric lat/lng in range).
- **Dev-only `simulate=` (forces "API down")** is ignored in production, on both the server and the client.
- **Shared cache (`"use cache"`):** it keys only on public inputs, holds only public third-party data, and responses
  are sent `Cache-Control: private`.
- **XSS:** there's no `dangerouslySetInnerHTML`. The OpenGolfAPI `website` link is filtered to http(s), and React 19
  blocks `javascript:` hrefs.
- **Secrets:** no keys are in the diff. `.env*` and the Playwright session files are gitignored.

## Hardening notes, and what we did (commit "security: …")
| # | Note | Action |
|---|---|---|
| 1 | `syncClub` stores client JSON with only size limits | **Fixed:** enum and date checks on rounds and goal before Postgres's own checks; custom courses keep only http(s) `sources` / photo `sourceUrl` |
| 2 | Course-page links rely on React blocking `javascript:` | **Fixed:** links are rendered only if `httpUrl()` accepts them (`src/lib/safe-url.ts`) |
| 3 | `/api/*` isn't in the proxy's protected list | **Kept as is, on purpose:** `auth.protect()` answers API calls with a bare 404, while our handlers return a 401 with a sentence the UI shows. Every handler checks `auth()` first (verified by the review). |
| 4 | Enums are validated only by database constraints | **Fixed** together with #1 |
| 5 | `.mcp.json` commits the Supabase project ref | **Accepted:** the ref isn't a secret (it's in the public Supabase URL every browser sees) |

After the fixes, the RLS test passed again (3/3).

## What we caught by reading the agents' changes ourselves (before and during review)
- The Clerk app forced Organizations, so every session was "pending" and the app treated signed-in golfers as signed out.
- `vercel link` writes `.env.local`. It was run in a temp dir, so the user's keys were never at risk of being overwritten.
- The Vercel framework was set to "Other" (the site 404'd). Pinned `nextjs` in `vercel.json`.
- Supabase's own `rls_auto_enable()` was callable by anyone through `/rest/v1/rpc` (security advisor). EXECUTE revoked.
- Per-row `auth.jwt()` evaluation in the policies (performance advisor). Rewritten.
- An agent command that tried to count lines in `.env.local` was blocked by the deny rule, as intended.
