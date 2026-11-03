-- Assignment 5, the Pro Shop: Supabase Cron runs poll-deals (applied after it was deployed and run twice by hand:
-- 138 on sale and 138 written, then 0 written). The Vault secret is read at each tick and never appears here.
-- Every 5 minutes. One run = six requests, one per store, 1.5 s apart (~10 s in all): 288 runs and 1,728 requests a
-- day, 288 per store. Sales change on a scale of hours; five minutes is plenty and still feels live.
select cron.schedule(
  'poll-deals',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://rihtmjtzrufkravyunuq.supabase.co/functions/v1/poll-deals',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
