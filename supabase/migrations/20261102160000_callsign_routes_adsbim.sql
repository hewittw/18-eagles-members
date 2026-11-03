-- callsign_routes now caches adsb.im's routeset (http://adsb.im/api/0/routeset), not adsbdb. adsbdb's terms forbid
-- copying its route data into another database without permission, so the rows it gave us are deleted here (a cache
-- of third-party data we shouldn't keep; the worker refills from adsb.im within a few runs).
-- adsb.im's routes are Virtual Radar Server's standing data (github.com/vradarserver/standing-data, CC0-1.0),
-- which adsb.im augments with routes parsed from live ACARS and adsb.lol data, and says its answers "should be
-- considered to be under the ODbL 1.0 license": caching is allowed with attribution (docs/credits.md). Still private
-- to the worker: RLS on, no policies, no grants to anon or authenticated (unchanged).
--   source: where the row came from ('adsb.im'); rows from any other source are not read and may not be written.
--   route:  every stop of the flight number, "SAN-ORD-SAN"; origin/destination stay the leg it was on when looked up.
--   stops:  the same stops with positions, [{"code":"SAN","lat":32.73,"lon":-117.19}, ...], so the worker can tell
--           which leg an aircraft is on at any moment.
alter table public.callsign_routes
  add column source text,
  add column route  text check (route ~ '^[A-Z0-9]{3}(-[A-Z0-9]{3}){1,7}$'),
  add column stops  jsonb check (stops is null or (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) between 2 and 8));

-- Every row so far came from adsbdb (no source column yet).
delete from public.callsign_routes where source is null;

alter table public.callsign_routes
  alter column source set not null,
  add constraint callsign_routes_source_check check (source in ('adsb.im'));

comment on table public.callsign_routes is
  'poll-flights cache of adsb.im routeset answers (VRS standing data CC0 + adsb.im additions, ODbL 1.0). Worker-only: 7 days found, 1 day not found.';
