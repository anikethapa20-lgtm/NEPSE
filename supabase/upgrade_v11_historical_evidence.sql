create table if not exists public.evidence_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'queued',
  records_saved integer not null default 0,
  disclosures_saved integer not null default 0,
  pages_scanned integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists evidence_backfill_runs_source_idx
on public.evidence_backfill_runs(source_key, created_at desc);

alter table public.evidence_backfill_runs enable row level security;

drop policy if exists "authenticated read evidence backfill runs"
on public.evidence_backfill_runs;

create policy "authenticated read evidence backfill runs"
on public.evidence_backfill_runs
for select
to authenticated
using (true);

create or replace function public.get_evidence_coverage_by_year()
returns table (
  evidence_year integer,
  official_records bigint,
  news_records bigint,
  symbol_linked_records bigint,
  disclosure_records bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with years as (
    select generate_series(2015, extract(year from now())::integer) as evidence_year
  ), evidence as (
    select
      extract(year from published_at)::integer as evidence_year,
      count(*) filter (where validation_status = 'official')::bigint as official_records,
      count(*) filter (where source_type = 'news')::bigint as news_records,
      count(*) filter (where symbol is not null)::bigint as symbol_linked_records
    from public.internet_evidence
    where is_relevant = true
      and published_at is not null
    group by 1
  ), disclosures as (
    select
      extract(year from published_at)::integer as evidence_year,
      count(*)::bigint as disclosure_records
    from public.nepse_disclosures
    where published_at is not null
    group by 1
  )
  select
    y.evidence_year,
    coalesce(e.official_records, 0),
    coalesce(e.news_records, 0),
    coalesce(e.symbol_linked_records, 0),
    coalesce(d.disclosure_records, 0)
  from years y
  left join evidence e using (evidence_year)
  left join disclosures d using (evidence_year)
  order by y.evidence_year;
$$;

revoke all on function public.get_evidence_coverage_by_year() from public;
grant execute on function public.get_evidence_coverage_by_year() to authenticated;

create or replace function public.get_evidence_backfill_status()
returns table (
  source_key text,
  status text,
  records_saved integer,
  disclosures_saved integer,
  pages_scanned integer,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (r.source_key)
    r.source_key,
    r.status,
    r.records_saved,
    r.disclosures_saved,
    r.pages_scanned,
    r.started_at,
    r.completed_at,
    r.error_message
  from public.evidence_backfill_runs r
  order by r.source_key, r.created_at desc;
$$;

revoke all on function public.get_evidence_backfill_status() from public;
grant execute on function public.get_evidence_backfill_status() to authenticated;

notify pgrst, 'reload schema';
