-- Realtime pushes each new worker run to the open pages (the freshness line). All three Realtime requirements now
-- hold for worker_runs: it's in the publication (here), `authenticated` has select, and a select policy allows it.
-- The Tour and Flights migrations add their own tables to the same publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'worker_runs'
  ) then
    alter publication supabase_realtime add table public.worker_runs;
  end if;
end $$;
