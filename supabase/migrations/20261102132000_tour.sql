-- 18 Eagles, Assignment 5: the Tour tables (written by the poll-tour worker, read by every signed-in golfer).
-- tour_events:      this week's PGA TOUR event from ESPN (one row per event the worker has seen).
-- tour_leaderboard: one row per player in that event's field. Rows for players ESPN stops listing are deleted.
-- tour_rankings:    the Official World Golf Ranking top 200 (OWGR), keyed by player_key so it joins the leaderboard.
-- player_key is playerKey(name) (supabase/functions/_shared/keys.ts): ESPN and OWGR use different player IDs.
--
-- Shared, worker-written tables: RLS on, one select policy for `authenticated`, select granted to `authenticated`,
-- nothing for `anon`. The worker uses the secret key (service_role), which bypasses RLS but not grants, and this
-- project doesn't auto-expose new tables, so service_role is granted explicitly.

create table public.tour_events (
  id            text primary key,                     -- ESPN event id, e.g. '401850978'
  name          text not null,
  short_name    text,
  state         text not null check (state in ('pre', 'in', 'post')),
  status_detail text,                                 -- ESPN's words: 'Final', 'Round 2 - In Progress', 'Thu, Oct 29'
  round         int,
  starts_at     timestamptz,
  ends_at       timestamptz,
  course        text,
  updated_at    timestamptz not null default now()
);

create table public.tour_leaderboard (
  event_id    text not null references public.tour_events (id) on delete cascade,
  player_key  text not null check (char_length(player_key) between 1 and 80),
  athlete_id  text,
  name        text not null,
  country     text,
  position    text,      -- '1', 'T5', or null (cut, withdrawn, not started)
  sort_order  int,
  to_par      text,      -- '-25', 'E', '+3'
  today       text,      -- this round to par, or null before the player tees off
  thru        text,      -- '18' / 'F' / '7', or the tee time as an ISO instant before they start
  status      text,      -- 'playing' | 'finished' | 'not_started' | 'cut' | 'wd' | 'dq' | 'mdf'
  updated_at  timestamptz not null default now(),
  primary key (event_id, player_key)
);
-- The page reads the board in order for one event (the PK already leads with event_id).
create index tour_leaderboard_event_sort_idx on public.tour_leaderboard (event_id, sort_order);

create table public.tour_rankings (
  player_key  text primary key check (char_length(player_key) between 1 and 80),
  name        text not null,
  country     text,
  rank        int not null,
  prev_rank   int,
  points      numeric,   -- OWGR average points, to 2 decimals
  updated_at  timestamptz not null default now()
);
create index tour_rankings_rank_idx on public.tour_rankings (rank);

alter table public.tour_events      enable row level security;
alter table public.tour_leaderboard enable row level security;
alter table public.tour_rankings    enable row level security;

create policy "Signed-in golfers read tour events"      on public.tour_events      for select to authenticated using (true);
create policy "Signed-in golfers read the leaderboard"  on public.tour_leaderboard for select to authenticated using (true);
create policy "Signed-in golfers read the world ranking" on public.tour_rankings   for select to authenticated using (true);

revoke all on public.tour_events, public.tour_leaderboard, public.tour_rankings from anon;
grant select on public.tour_events, public.tour_leaderboard, public.tour_rankings to authenticated;
grant select, insert, update, delete on public.tour_events, public.tour_leaderboard, public.tour_rankings to service_role;

-- Realtime: all three requirements now hold for these tables (publication here, the grant, the policy).
do $$
declare t text;
begin
  foreach t in array array['tour_events', 'tour_leaderboard', 'tour_rankings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
