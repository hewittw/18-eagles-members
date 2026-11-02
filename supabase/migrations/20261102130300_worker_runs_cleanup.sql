-- Keep worker_runs small: a daily job (04:17 UTC, a quiet minute) deletes runs older than 2 days.
-- At one run every 10 s for the tour plus every 30 s for flights that's ~11,500 rows a day, ~23,000 kept.
-- cron.schedule with a job name replaces an existing job of that name, so re-running this is safe.
select cron.schedule(
  'worker-runs-cleanup',
  '17 4 * * *',
  $$delete from public.worker_runs where started_at < now() - interval '2 days'$$
);
