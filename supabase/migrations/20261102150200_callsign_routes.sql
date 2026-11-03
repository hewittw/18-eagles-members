-- callsign_routes: the poll-flights worker's cache of adsbdb answers (https://www.adsbdb.com), so a callsign is
-- looked up at most once a week (a "not found" at most once a day). Private to the worker: RLS on with no policies,
-- and no grants to anon or authenticated, so nobody but service_role can read or write it. adsbdb's route data may not
-- be republished as a database (docs/credits.md): this is a short-lived working cache, never exposed.
create table public.callsign_routes (
  callsign    text primary key check (callsign ~ '^[A-Z0-9]{3,8}$'),
  origin      text check (origin ~ '^[A-Z0-9]{3}$'),
  destination text check (destination ~ '^[A-Z0-9]{3}$'),
  airline     text check (char_length(airline) <= 60),
  flight      text check (char_length(flight) <= 12),
  found       boolean not null,
  fetched_at  timestamptz not null default now()
);

alter table public.callsign_routes enable row level security;
revoke all on public.callsign_routes from anon, authenticated;
grant select, insert, update, delete on public.callsign_routes to service_role;
