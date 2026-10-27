-- Performance advisor 0003 (auth_rls_initplan): evaluate auth.jwt() once per query, not once per row.
-- Same rule as before (the row's user_id must equal the caller's Clerk sub), written as ((select auth.jwt()) ->> 'sub').
alter policy "Golfers read their own profile"   on public.profiles using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers create their own profile" on public.profiles with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers update their own profile" on public.profiles using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers delete their own profile" on public.profiles using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers read their own rounds"   on public.rounds using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers create their own rounds" on public.rounds with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers update their own rounds" on public.rounds using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers delete their own rounds" on public.rounds using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers read their own courses"   on public.custom_courses using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers create their own courses" on public.custom_courses with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers update their own courses" on public.custom_courses using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Golfers delete their own courses" on public.custom_courses using (((select auth.jwt()) ->> 'sub') = user_id);
