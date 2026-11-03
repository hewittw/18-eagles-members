-- The pivot (README "Pivot: Flights → Pro Shop"): Flights is retired. Stop calling adsb.lol / adsb.fi / adsb.im.
-- Nothing is dropped: the flights tables, their rows and the deployed poll-flights function stay as they are
-- (destructive DDL needs the user). This only unschedules the cron job and takes the flights tables out of the
-- Realtime publication, so nothing reaches a page that no longer exists.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'poll-flights') then
    perform cron.unschedule('poll-flights');
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['airport_flights', 'trip_flights', 'trip_pairs'] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;
