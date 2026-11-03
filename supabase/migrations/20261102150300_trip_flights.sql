-- trip_flights: the route board. One row per aircraft flying between the two airports of a watched pair, in either
-- direction, written only by poll-flights (the secret key) and only when something a golfer sees changed. Coarsened
-- before comparing: altitude to 1,000 ft (0 on the ground), progress to 5 %, a phase instead of a vertical rate.
-- pair_key is the two codes sorted ('ORD-SAN'), so ORD→SAN and SAN→ORD share one board.
create table public.trip_flights (
  pair_key      text not null check (pair_key ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$'),
  hex           text not null check (hex ~ '^~?[0-9a-f]{6}$'),
  callsign      text check (char_length(callsign) <= 12),
  flight        text check (char_length(flight) <= 12),
  airline       text check (char_length(airline) <= 60),
  aircraft_type text check (char_length(aircraft_type) <= 8),
  origin        text not null check (origin ~ '^[A-Z0-9]{3}$'),
  destination   text not null check (destination ~ '^[A-Z0-9]{3}$'),
  phase         text not null check (phase in ('departing', 'en_route', 'arriving', 'landed')),
  alt_ft        int check (alt_ft between 0 and 60000),
  progress_pct  int check (progress_pct between 0 and 100),
  updated_at    timestamptz not null default now(),
  primary key (pair_key, hex)
);

alter table public.trip_flights enable row level security;
create policy "Signed-in golfers read trip flights" on public.trip_flights for select to authenticated using (true);
grant select on public.trip_flights to authenticated;
revoke all on public.trip_flights from anon;
grant select, insert, update, delete on public.trip_flights to service_role;

-- trip_pairs: one row per watched pair, written once when the worker first checks it (so the page can tell
-- "finding flights on your route" from "none in the air"), and again only when the airlines known to fly it change.
create table public.trip_pairs (
  pair_key   text primary key check (pair_key ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$'),
  airlines   text[] not null default '{}' check (cardinality(airlines) <= 6),
  checked_at timestamptz not null default now()
);
alter table public.trip_pairs enable row level security;
create policy "Signed-in golfers read trip pairs" on public.trip_pairs for select to authenticated using (true);
grant select on public.trip_pairs to authenticated;
revoke all on public.trip_pairs from anon;
grant select, insert, update, delete on public.trip_pairs to service_role;

-- Realtime: the route board and its pair row. airport_flights is no longer written, so it leaves the publication
-- (the table stays; nothing is dropped).
alter publication supabase_realtime add table public.trip_flights, public.trip_pairs;
alter publication supabase_realtime drop table public.airport_flights;
