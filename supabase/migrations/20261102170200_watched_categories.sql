-- Each golfer watches Pro Shop categories ("Balls", "Training aids"): those deals come first, under "Your watch list".
-- The hw4 convention: user_id is the Clerk user id, filled in by the database from the token, RLS on with four
-- policies keyed to it, grants to `authenticated` only, nothing for anon.
create table public.watched_categories (
  user_id    text not null default (auth.jwt() ->> 'sub'),
  category   text not null check (category in ('apparel', 'hats', 'balls', 'bags', 'training', 'other')),
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.watched_categories enable row level security;
create policy "Golfers read their own watched categories"   on public.watched_categories for select to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers watch categories for themselves"     on public.watched_categories for insert to authenticated with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers update their own watched categories" on public.watched_categories for update to authenticated using (((select auth.jwt()) ->> 'sub') = user_id) with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Golfers unwatch their own categories"        on public.watched_categories for delete to authenticated using (((select auth.jwt()) ->> 'sub') = user_id);

grant select, insert, update, delete on public.watched_categories to authenticated;
revoke all on public.watched_categories from anon;

-- The limit lives in the database, not only in the UI (the same pattern as followed_players): at most 4 of the 6, so a
-- watch list still means "these first". A plain (security invoker) trigger counting the caller's own rows, with a
-- per-golfer advisory lock so two quick taps can't both slip in. The message starts with `follow_limit`, which the app
-- already recognises.
create or replace function public.watched_categories_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('watched_categories:' || new.user_id));
  if exists (select 1 from public.watched_categories w where w.user_id = new.user_id and w.category = new.category) then
    return new;
  end if;
  if (select count(*) from public.watched_categories w where w.user_id = new.user_id) >= 4 then
    raise exception 'follow_limit: you can watch up to 4 categories'
      using errcode = 'check_violation', hint = 'Stop watching one first.';
  end if;
  return new;
end;
$$;

create trigger watched_categories_limit
  before insert on public.watched_categories
  for each row execute function public.watched_categories_limit();
