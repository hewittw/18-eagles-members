-- The worker's shared secret, made inside the database so no person ever sees or copies it.
-- Supabase Cron reads it from vault.decrypted_secrets and sends it as the `x-worker-secret` header; the poll-*
-- Edge Functions (verify_jwt = false) ask `worker_secret_ok(p)` whether the header matches before doing anything.
-- Re-running this migration keeps the existing secret.
create extension if not exists supabase_vault with schema vault;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'worker_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'worker_secret',
      'Sent by Supabase Cron as x-worker-secret; checked by the poll-* Edge Functions via public.worker_secret_ok().'
    );
  end if;
end $$;

-- Security definer so it can read the Vault; search_path '' so every name is schema-qualified and nothing can be
-- shadowed. It returns only true/false, never the secret.
create or replace function public.worker_secret_ok(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p is not null and char_length(p) between 1 and 200
    and exists (select 1 from vault.decrypted_secrets s where s.name = 'worker_secret' and s.decrypted_secret = p),
    false
  );
$$;

-- Only the worker (secret key = service_role) may ask. Signed-out and signed-in callers can't even probe it.
revoke execute on function public.worker_secret_ok(text) from public, anon, authenticated;
grant execute on function public.worker_secret_ok(text) to service_role;
