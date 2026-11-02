-- Assignment 5: Supabase Cron runs the workers (applied after both Edge Functions were deployed and tested once).
-- From supabase/cron.sql.example. The Vault secret is read at each tick and never appears here.
-- Every 10 s: the live leaderboard (body {} = leaderboard).
select cron.schedule(
  'poll-tour',
  '10 seconds',
  $$
  select net.http_post(
    url := 'https://rihtmjtzrufkravyunuq.supabase.co/functions/v1/poll-tour',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 9000
  );
  $$
);

-- Hourly, at minute 7: the world ranking.
select cron.schedule(
  'poll-rankings',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://rihtmjtzrufkravyunuq.supabase.co/functions/v1/poll-tour',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
    ),
    body := '{"part":"rankings"}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- pg_cron keeps a row per job run; at a run every 10 s and 30 s that's ~11,500 rows a day. Keep one day.
select cron.schedule(
  'cron-history-cleanup',
  '23 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$
);
