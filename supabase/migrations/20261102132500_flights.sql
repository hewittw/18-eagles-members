-- airport_flights: the live board. One row per aircraft within 15 nm of a followed airport, written only by the
-- poll-flights worker (the secret key) and only when something a golfer would see changed. The columns are already
-- coarsened (altitude to 1,000 ft, 0 on the ground; distance to whole nm; a phase instead of a vertical rate), so a
-- plane holding steady doesn't count as a change and doesn't cost a Realtime message. There is deliberately no
-- seen_at column: it would change every row on every run.
create table public.airport_flights (
  airport       text not null references public.airports (code) on delete cascade,
  hex           text not null check (hex ~ '^~?[0-9a-f]{6}$'),
  callsign      text check (char_length(callsign) <= 12),
  airline       text check (char_length(airline) <= 40),
  aircraft_type text check (char_length(aircraft_type) <= 8),
  phase         text not null check (phase in ('arriving', 'departing', 'ground', 'overhead')),
  alt_ft        int check (alt_ft between 0 and 60000),
  dist_nm       int check (dist_nm between 0 and 100),
  updated_at    timestamptz not null default now(),
  primary key (airport, hex)
);
-- The primary key starts with airport, which covers the foreign key and the page's `airport=in.(…)` filter.

alter table public.airport_flights enable row level security;
create policy "Signed-in golfers read airport flights" on public.airport_flights for select to authenticated using (true);

grant select on public.airport_flights to authenticated;
revoke all on public.airport_flights from anon;
-- The project doesn't auto-expose new tables, so the worker's role is granted explicitly (it bypasses RLS, not grants).
grant select, insert, update, delete on public.airport_flights to service_role;

-- Realtime pushes each insert/update/delete to the open Flights pages. All three requirements hold: the publication
-- (here), the select grant to authenticated, and the select policy.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'airport_flights'
  ) then
    alter publication supabase_realtime add table public.airport_flights;
  end if;
end $$;
-- Deletes carry only the primary key (the default replica identity: airport + hex), which is all the page needs to
-- drop a row. Realtime can't filter DELETE events, so the page listens to deletes unfiltered and ignores airports it
-- doesn't follow; inserts and updates are filtered by airport.
