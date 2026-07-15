create table if not exists public.nepse_sync_runs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null,
  status text not null default 'running',
  records_saved integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.nepse_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  market_open boolean,
  total_turnover numeric,
  summary jsonb,
  raw_status jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists public.nepse_securities (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  security_name text,
  company_name text,
  security_id text,
  active boolean not null default true,
  raw_data jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.nepse_live_prices (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  trade_date date not null,
  last_traded_price numeric,
  open_price numeric,
  high_price numeric,
  low_price numeric,
  close_price numeric,
  volume numeric,
  turnover numeric,
  transactions numeric,
  raw_data jsonb,
  fetched_at timestamptz not null default now(),
  unique(symbol, trade_date)
);

create table if not exists public.nepse_indices (
  id uuid primary key default gen_random_uuid(),
  index_name text not null,
  trade_date date not null,
  index_value numeric,
  change_value numeric,
  change_percent numeric,
  raw_data jsonb,
  fetched_at timestamptz not null default now(),
  unique(index_name, trade_date)
);

create table if not exists public.nepse_disclosures (
  id uuid primary key default gen_random_uuid(),
  disclosure_key text not null unique,
  symbol text,
  title text,
  published_at timestamptz,
  category text,
  raw_data jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.nepse_sync_runs enable row level security;
alter table public.nepse_market_snapshots enable row level security;
alter table public.nepse_securities enable row level security;
alter table public.nepse_live_prices enable row level security;
alter table public.nepse_indices enable row level security;
alter table public.nepse_disclosures enable row level security;

drop policy if exists "members read sync runs"
on public.nepse_sync_runs;

create policy "members read sync runs"
on public.nepse_sync_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members
    where user_id = auth.uid()
  )
);

drop policy if exists "members read market snapshots"
on public.nepse_market_snapshots;

create policy "members read market snapshots"
on public.nepse_market_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members
    where user_id = auth.uid()
  )
);

drop policy if exists "members read securities"
on public.nepse_securities;

create policy "members read securities"
on public.nepse_securities
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members
    where user_id = auth.uid()
  )
);

drop policy if exists "members read prices"
on public.nepse_live_prices;

create policy "members read prices"
on public.nepse_live_prices
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members
    where user_id = auth.uid()
  )
);

drop policy if exists "members read indices"
on public.nepse_indices;

create policy "members read indices"
on public.nepse_indices
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members
    where user_id = auth.uid()
  )
);

drop policy if exists "members read disclosures"
on public.nepse_disclosures;

create policy "members read disclosures"
on public.nepse_disclosures
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members
    where user_id = auth.uid()
  )
);