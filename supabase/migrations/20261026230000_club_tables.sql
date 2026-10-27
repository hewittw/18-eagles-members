-- 18 Eagles, Week 4: each golfer's journal, one row set per Clerk user.
-- Ownership: every table has user_id = the Clerk user id (the JWT's `sub` claim), filled in by the database
-- itself (default auth.jwt()->>'sub'), and Row Level Security lets a signed-in golfer touch only rows whose
-- user_id matches their own token. Signed-out visitors (the anon role) get no grants at all.
-- The project doesn't auto-expose new tables to the Data API, so each grant below is explicit.

-- 1. profiles: one row per golfer: who they are, their goal and home course, and their bag.
create table public.profiles (
  user_id      text primary key default (auth.jwt() ->> 'sub'),
  name         text check (char_length(name) <= 40),
  entered_index numeric(3,1) check (entered_index between -10 and 54),
  goal         text check (goal in ('100', '90', '80', 'scratch')),
  home_course  text check (char_length(home_course) <= 80),
  last_tee     jsonb not null default '{}'::jsonb,   -- course slug → tee name
  bag          jsonb not null default '[]'::jsonb,   -- the 18 clubs, in or out of the bag
  honors_seen  text[] not null default '{}',
  welcomed_at  bigint,                               -- epoch ms, as the app stores them
  bag_set_at   bigint,
  last_visit   bigint,
  updated_at   timestamptz not null default now(),
  constraint profiles_size check (pg_column_size(last_tee) + pg_column_size(bag) < 20000)
);

-- 2. rounds: one row per card (live or logged). Hole-by-hole entries ride along as jsonb, because a card is
-- always read and written whole and never queried hole by hole on the server.
create table public.rounds (
  user_id     text not null default (auth.jwt() ->> 'sub'),
  id          text not null check (char_length(id) between 4 and 24),   -- the app's own short id
  course_slug text not null check (char_length(course_slug) <= 80),
  tee_name    text not null check (char_length(tee_name) <= 40),
  played_on   date not null,
  holes       text not null check (holes in ('18', 'front', 'back')),
  mode        text not null check (mode in ('live', 'logged')),
  status      text not null check (status in ('playing', 'complete')),
  entries     jsonb not null default '{}'::jsonb check (pg_column_size(entries) < 60000),
  total_only  smallint check (total_only between 18 and 250),
  last_hole   smallint not null default 1 check (last_hole between 1 and 18),
  note        text not null default '' check (char_length(note) <= 600),
  created_at  bigint not null,
  finished_at bigint,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index rounds_user_played_idx on public.rounds (user_id, played_on desc);

-- 3. custom_courses: courses a golfer added themselves (the built-in ~28 courses stay static files).
create table public.custom_courses (
  user_id    text not null default (auth.jwt() ->> 'sub'),
  slug       text not null check (char_length(slug) between 1 and 80),
  course     jsonb not null check (pg_column_size(course) < 40000),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

-- Row Level Security: on for every table, one policy per action, all keyed to the token's `sub`.
alter table public.profiles       enable row level security;
alter table public.rounds         enable row level security;
alter table public.custom_courses enable row level security;

create policy "Golfers read their own profile"   on public.profiles for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers create their own profile" on public.profiles for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers update their own profile" on public.profiles for update to authenticated using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers delete their own profile" on public.profiles for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Golfers read their own rounds"    on public.rounds for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers create their own rounds"  on public.rounds for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers update their own rounds"  on public.rounds for update to authenticated using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers delete their own rounds"  on public.rounds for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Golfers read their own courses"   on public.custom_courses for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers create their own courses" on public.custom_courses for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers update their own courses" on public.custom_courses for update to authenticated using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Golfers delete their own courses" on public.custom_courses for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

-- Data API access: signed-in golfers only. anon gets nothing.
grant select, insert, update, delete on public.profiles, public.rounds, public.custom_courses to authenticated;
revoke all on public.profiles, public.rounds, public.custom_courses from anon;
