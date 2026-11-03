-- trips: one trip per golfer, the Flights page's choice. from_airport is the airport nearest the golfer's location
-- (worked out in the browser; the coordinates themselves are never sent or stored), to_airport the one they fly into
-- for the course they picked, dest_label what they picked ("Fairbanks Ranch", or an airport's name).
-- The hw4 convention: user_id from the Clerk token, RLS on with four policies, grants to authenticated only, nothing
-- for anon. The poll-flights worker reads every trip (service_role) to choose which routes to watch.
create table public.trips (
  user_id      text primary key default (auth.jwt() ->> 'sub'),
  from_airport text not null references public.airports (code),
  to_airport   text not null references public.airports (code),
  dest_label   text check (char_length(dest_label) <= 80),
  updated_at   timestamptz not null default now()
);
-- The foreign keys want their own indexes (the primary key is user_id).
create index trips_from_airport_idx on public.trips (from_airport);
create index trips_to_airport_idx on public.trips (to_airport);

alter table public.trips enable row level security;
create policy "Golfers read their own trip"   on public.trips for select to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers plan their own trip"   on public.trips for insert to authenticated with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers change their own trip" on public.trips for update to authenticated using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers clear their own trip"  on public.trips for delete to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);

grant select, insert, update, delete on public.trips to authenticated;
revoke all on public.trips from anon;
grant select on public.trips to service_role;
