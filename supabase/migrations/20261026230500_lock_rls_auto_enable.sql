-- Security advisor (lints 0028/0029): Supabase's auto-RLS event-trigger helper is SECURITY DEFINER and was
-- callable over /rest/v1/rpc/rls_auto_enable by anon and authenticated. Event triggers don't need EXECUTE
-- grants, so no API role should be able to call it directly.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
