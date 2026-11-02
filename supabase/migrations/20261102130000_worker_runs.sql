-- 18 Eagles, Assignment 5: the worker's foundation.
-- 1. The two extensions Supabase Cron needs: pg_cron (the schedule) and pg_net (an HTTP POST from Postgres to an
--    Edge Function). pg_cron goes in pg_catalog, as Supabase's own dashboard installs it; pg_net in `extensions`.
-- 2. worker_runs: one row per worker run, success or failure. The pages read the latest row for their source to say
--    "Updated 8 seconds ago", "stale", or "down". Shared, worker-written: every signed-in golfer may read it, nobody
--    but the worker (the secret key, which bypasses RLS) writes it. anon gets nothing.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.worker_runs (
  id           bigint generated always as identity primary key,
  source       text not null check (source in ('tour', 'rankings', 'flights')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean not null,
  rows_changed int not null default 0,
  detail       text check (char_length(detail) <= 500)
);
-- "The latest run for this source" is the only query the pages make.
create index worker_runs_source_started_idx on public.worker_runs (source, started_at desc);

alter table public.worker_runs enable row level security;
create policy "Signed-in golfers read worker runs" on public.worker_runs for select to authenticated using (true);

-- Read only for golfers; no insert/update/delete grant, so even a bad policy couldn't let a browser write a run.
grant select on public.worker_runs to authenticated;
revoke all on public.worker_runs from anon;
-- The project doesn't auto-expose new tables, so the worker's role is granted explicitly too (it bypasses RLS,
-- not grants). The daily cleanup runs as postgres through pg_cron and needs nothing here.
grant select, insert, delete on public.worker_runs to service_role;
