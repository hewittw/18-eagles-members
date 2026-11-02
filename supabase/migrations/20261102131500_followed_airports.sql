-- DEPENDS ON 20261102131000_airports.sql (the Flights agent's migration, which creates public.airports).
-- Apply that one first: followed_airports.airport references airports(code).
--
-- Each golfer follows up to 6 airports. Same hw4 convention as followed_players: user_id from the Clerk token,
-- RLS on with four policies, grants to `authenticated` only. The flights worker reads the distinct followed airports
-- with the secret key, so service_role gets select.
create table public.followed_airports (
  user_id    text not null default (auth.jwt() ->> 'sub'),
  airport    text not null references public.airports (code),
  created_at timestamptz not null default now(),
  primary key (user_id, airport)
);
-- The primary key starts with user_id; the worker groups by airport, and the foreign key wants its own index.
create index followed_airports_airport_idx on public.followed_airports (airport);

alter table public.followed_airports enable row level security;
create policy "Golfers read their own followed airports"   on public.followed_airports for select to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers follow airports for themselves"     on public.followed_airports for insert to authenticated with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers update their own followed airports" on public.followed_airports for update to authenticated using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers unfollow their own airports"        on public.followed_airports for delete to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);

grant select, insert, update, delete on public.followed_airports to authenticated;
revoke all on public.followed_airports from anon;
grant select on public.followed_airports to service_role;

-- Up to 6, enforced in the database (see followed_players_limit for why it's a plain trigger with a lock).
create or replace function public.followed_airports_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('followed_airports:' || new.user_id));
  -- Already followed: let the insert reach its on-conflict clause (a re-tap at the limit isn't a new follow).
  if exists (select 1 from public.followed_airports f where f.user_id = new.user_id and f.airport = new.airport) then
    return new;
  end if;
  if (select count(*) from public.followed_airports f where f.user_id = new.user_id) >= 6 then
    raise exception 'follow_limit: you can follow up to 6 airports'
      using errcode = 'check_violation', hint = 'Unfollow an airport first.';
  end if;
  return new;
end;
$$;

create trigger followed_airports_limit
  before insert on public.followed_airports
  for each row execute function public.followed_airports_limit();
