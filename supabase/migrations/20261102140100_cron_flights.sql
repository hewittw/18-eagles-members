-- Assignment 5: Supabase Cron runs the workers. The Vault secret is read at each tick and never appears here.
-- Applied after poll-flights was deployed and tested once.

-- Every 30 s: flights around the followed airports.
select cron.schedule(
  'poll-flights',
  '30 seconds',
  $$
  select net.http_post(
    url := 'https://rihtmjtzrufkravyunuq.supabase.co/functions/v1/poll-flights',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
