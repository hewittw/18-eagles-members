-- The fix: a golfer reads only rows whose user_id matches their own Clerk token's sub.
alter policy "Golfers read their own rounds" on public.rounds using ((select auth.jwt() ->> 'sub') = user_id);
