-- NEPSE Research System V9: streamlined UI + real-world evidence layer

create table if not exists public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  company_name text,
  aliases text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.internet_evidence (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_type text not null check (source_type in ('regulator','exchange','company','news','other')),
  source_url text not null,
  title text not null,
  published_at timestamptz,
  summary text,
  raw_text text,
  symbol text,
  company_name text,
  authority_score numeric not null default 50 check (authority_score between 0 and 100),
  content_hash text not null unique,
  fetched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists internet_evidence_symbol_date_idx on public.internet_evidence(symbol,published_at desc);
create index if not exists internet_evidence_source_idx on public.internet_evidence(source_type,source_name);

alter table public.company_aliases enable row level security;
alter table public.internet_evidence enable row level security;

drop policy if exists "authenticated read company aliases" on public.company_aliases;
create policy "authenticated read company aliases" on public.company_aliases for select to authenticated using (true);
drop policy if exists "authenticated read internet evidence" on public.internet_evidence;
create policy "authenticated read internet evidence" on public.internet_evidence for select to authenticated using (true);

alter table public.event_cross_references add column if not exists matched_internet_evidence_count integer not null default 0;
alter table public.event_cross_references add column if not exists strongest_internet_evidence_id uuid references public.internet_evidence(id) on delete set null;
alter table public.research_events add column if not exists matched_internet_evidence_count integer not null default 0;

-- Keep the worker job types aligned with the UI.
alter table public.analysis_jobs drop constraint if exists analysis_jobs_job_type_check;
alter table public.analysis_jobs add constraint analysis_jobs_job_type_check check (job_type in ('event_detection','pump_detection','cross_reference'));

-- Seed ticker aliases from the research event universe. Company names can be added later.
insert into public.company_aliases(symbol)
select distinct upper(symbol)
from public.research_events
where symbol is not null and trim(symbol) <> ''
on conflict(symbol) do nothing;

notify pgrst, 'reload schema';
