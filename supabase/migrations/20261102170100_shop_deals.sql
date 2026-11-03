-- The Pro Shop (README "Pivot: Flights → Pro Shop"). shop_deals: what six golf brands have on sale right now, read
-- from their public Shopify feeds by the poll-deals worker (the secret key) and written only when something a golfer
-- would see changed (a new sale, a price change, selling out, a sale ending). Shared, worker-written: the hw5
-- convention (RLS on, one select policy for signed-in golfers, select granted to authenticated, nothing for anon).
-- The columns are already coarsened (prices to the cent, a whole-percent discount, one in-stock boolean, a fixed-width
-- image URL), so a store re-saving a product is not a change. No seen_at column: it would change every row every run.

-- 1. The worker's runs get a new source.
alter table public.worker_runs drop constraint worker_runs_source_check;
alter table public.worker_runs add constraint worker_runs_source_check
  check (source in ('tour', 'rankings', 'flights', 'deals'));

-- 2. The sale items.
create table public.shop_deals (
  id            text primary key check (id ~ '^[a-z-]{2,20}:[0-9]{1,20}$'),  -- "bad-birdie:10643538084033"
  brand         text not null check (brand ~ '^[a-z-]{2,20}$'),
  title         text not null check (char_length(title) between 1 and 140),
  category      text not null check (category in ('apparel', 'hats', 'balls', 'bags', 'training', 'other')),
  price         numeric(10, 2) not null check (price > 0),
  was_price     numeric(10, 2) not null check (was_price > price),
  pct_off       int not null check (pct_off between 1 and 99),
  available     boolean not null,
  image         text check (image ~ '^https://cdn\.shopify\.com/'),
  url           text not null check (url ~ '^https://[a-z0-9.-]+/products/'),
  first_seen_at timestamptz not null default now(),  -- set once on insert ("new" on the page); updates leave it
  updated_at    timestamptz not null default now()
);
-- The worker reads a brand's rows (brand = any(...)); the page reads them all (~150) and sorts in the browser.
create index shop_deals_brand_idx on public.shop_deals (brand);

alter table public.shop_deals enable row level security;
create policy "Signed-in golfers read shop deals" on public.shop_deals for select to authenticated using (true);

grant select on public.shop_deals to authenticated;
revoke all on public.shop_deals from anon;
-- The project doesn't auto-expose new tables, so the worker's role is granted explicitly (it bypasses RLS, not grants).
grant select, insert, update, delete on public.shop_deals to service_role;

-- 3. Realtime: all three requirements hold (the publication here, the select grant, the select policy). Deletes carry
-- only the primary key (id), which is all the page needs to drop a card.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_deals'
  ) then
    alter publication supabase_realtime add table public.shop_deals;
  end if;
end $$;
