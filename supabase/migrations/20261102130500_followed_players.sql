-- Each golfer follows up to 20 tour players. The hw4 convention: user_id is the Clerk user id, filled in by the
-- database from the token, RLS on with four policies keyed to it, grants to `authenticated` only.
-- player_key is the shared join key (playerKey(name): "scottie-scheffler"), the same in the worker and the app.
create table public.followed_players (
  user_id    text not null default (auth.jwt() ->> 'sub'),
  player_key text not null check (char_length(player_key) between 1 and 80),
  name       text check (char_length(name) <= 80),
  created_at timestamptz not null default now(),
  primary key (user_id, player_key)
);

alter table public.followed_players enable row level security;
create policy "Golfers read their own followed players"   on public.followed_players for select to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers follow players for themselves"     on public.followed_players for insert to authenticated with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers update their own followed players" on public.followed_players for update to authenticated using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers unfollow their own players"        on public.followed_players for delete to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);

grant select, insert, update, delete on public.followed_players to authenticated;
revoke all on public.followed_players from anon;

-- The limit lives in the database, not only in the UI. A plain (security invoker) trigger: it counts the caller's
-- own rows, which are exactly the rows RLS lets them see. The advisory lock (per golfer, released at commit) stops two
-- quick taps from both slipping in as the 20th. The message starts with `follow_limit` so the app can recognise it.
create or replace function public.followed_players_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('followed_players:' || new.user_id));
  -- Already followed: let the insert reach its on-conflict clause (a re-tap at the limit isn't a new follow).
  if exists (select 1 from public.followed_players f where f.user_id = new.user_id and f.player_key = new.player_key) then
    return new;
  end if;
  if (select count(*) from public.followed_players f where f.user_id = new.user_id) >= 20 then
    raise exception 'follow_limit: you can follow up to 20 players'
      using errcode = 'check_violation', hint = 'Unfollow a player first.';
  end if;
  return new;
end;
$$;

create trigger followed_players_limit
  before insert on public.followed_players
  for each row execute function public.followed_players_limit();
