-- NEPSE Research Intelligence System V13.2
-- Final research completion, integrity checks, and publication-readiness controls.

alter table public.research_events
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processed_at timestamptz,
  add column if not exists terminal_outcome text,
  add column if not exists processing_version text,
  add column if not exists processing_error text,
  add column if not exists evidence_checked_at timestamptz;

alter table public.research_events drop constraint if exists research_events_processing_status_check;
alter table public.research_events add constraint research_events_processing_status_check
  check (processing_status in ('pending','processing','completed','failed'));
alter table public.research_events drop constraint if exists research_events_terminal_outcome_check;
alter table public.research_events add constraint research_events_terminal_outcome_check
  check (terminal_outcome is null or terminal_outcome in ('explained','unexplained','requires_review','insufficient_data','processing_failed'));

alter table public.analysis_jobs add column if not exists heartbeat_at timestamptz;
alter table public.analysis_jobs add column if not exists attempt_count integer not null default 0;
alter table public.analysis_jobs add column if not exists worker_version text;
alter table public.analysis_jobs add column if not exists records_total bigint;
alter table public.analysis_jobs add column if not exists records_processed bigint;

create table if not exists public.research_validation_runs(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  validation_version text not null,
  status text not null check(status in ('passed','warning','failed')),
  market_rows bigint not null default 0,
  duplicate_market_rows bigint not null default 0,
  invalid_ohlc_rows bigint not null default 0,
  null_symbol_rows bigint not null default 0,
  total_events bigint not null default 0,
  completed_events bigint not null default 0,
  failed_events bigint not null default 0,
  orphan_events bigint not null default 0,
  missing_cross_references bigint not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.research_validation_runs enable row level security;
drop policy if exists "members read validation runs" on public.research_validation_runs;
create policy "members read validation runs" on public.research_validation_runs for select to authenticated
using(public.is_project_member(project_id));

create index if not exists research_market_data_project_symbol_date_v132_idx on public.research_market_data(project_id,symbol,trade_date);
create index if not exists research_events_project_terminal_v132_idx on public.research_events(project_id,processing_status,terminal_outcome);
create index if not exists event_cross_references_project_event_v132_idx on public.event_cross_references(project_id,event_id);
create index if not exists analysis_jobs_project_status_v132_idx on public.analysis_jobs(project_id,status,created_at);

-- Normalize legacy rows. A completed result may remain unexplained; unexplained is a valid terminal research outcome.
update public.research_events
set processing_status = case
      when cross_referenced_at is not null then 'completed'
      when processing_status not in ('pending','processing','completed','failed') then 'pending'
      else processing_status end,
    processed_at = case when cross_referenced_at is not null then coalesce(processed_at,cross_referenced_at) else processed_at end,
    evidence_checked_at = case when cross_referenced_at is not null then coalesce(evidence_checked_at,cross_referenced_at) else evidence_checked_at end,
    processing_version = case when cross_referenced_at is not null then coalesce(processing_version,'v13.2') else processing_version end,
    terminal_outcome = case
      when cross_referenced_at is null then terminal_outcome
      when explanation_status='explained' then 'explained'
      when explanation_status='requires_review' then 'requires_review'
      when explanation_status='unexplained' then 'unexplained'
      else coalesce(terminal_outcome,'unexplained') end;

create or replace function public.get_market_symbols(p_project_id uuid)
returns table(symbol text,row_count bigint,first_date date,last_date date)
language sql stable security definer set search_path=public as $$
 select upper(trim(m.symbol)),count(*)::bigint,min(m.trade_date),max(m.trade_date)
 from research_market_data m
 where m.project_id=p_project_id and public.is_project_member(p_project_id)
 group by upper(trim(m.symbol)) order by upper(trim(m.symbol));
$$;

create or replace function public.get_v13_research_summary(p_project_id uuid)
returns table(
 market_rows bigint,total_events bigint,processed_events bigint,pending_events bigint,failed_events bigint,
 explained_events bigint,unexplained_events bigint,review_events bigint,insufficient_data_events bigint,
 companies bigint,mean_pre_car numeric,mean_post_car numeric,completion_percent numeric,publication_ready boolean
)
language sql stable security definer set search_path=public as $$
 with m as(
   select count(*)::bigint market_rows,count(distinct upper(trim(symbol)))::bigint companies
   from research_market_data where project_id=p_project_id
 ), e as(
   select count(*)::bigint total_events,
     count(*) filter(where processing_status='completed')::bigint processed_events,
     count(*) filter(where processing_status in ('pending','processing'))::bigint pending_events,
     count(*) filter(where processing_status='failed')::bigint failed_events,
     count(*) filter(where terminal_outcome='explained')::bigint explained_events,
     count(*) filter(where terminal_outcome='unexplained')::bigint unexplained_events,
     count(*) filter(where terminal_outcome='requires_review')::bigint review_events,
     count(*) filter(where terminal_outcome='insufficient_data')::bigint insufficient_data_events,
     avg(pre_car_5) mean_pre_car,avg(post_car_5) mean_post_car
   from research_events where project_id=p_project_id
 )
 select m.market_rows,e.total_events,e.processed_events,e.pending_events,e.failed_events,
   e.explained_events,e.unexplained_events,e.review_events,e.insufficient_data_events,m.companies,
   e.mean_pre_car,e.mean_post_car,
   case when e.total_events=0 then 0 else round(e.processed_events::numeric*100/e.total_events,2) end,
   (m.market_rows>0 and e.total_events>0 and e.processed_events=e.total_events and e.pending_events=0 and e.failed_events=0)
 from m cross join e
 where public.is_project_member(p_project_id);
$$;

create or replace function public.get_research_outcome_counts(p_project_id uuid)
returns table(outcome text,event_count bigint,share_percent numeric)
language sql stable security definer set search_path=public as $$
 with x as(
  select coalesce(terminal_outcome,case when processing_status='failed' then 'processing_failed' else 'pending' end) outcome,count(*)::bigint n
  from research_events where project_id=p_project_id group by 1
 ),t as(select sum(n)::numeric total from x)
 select x.outcome,x.n,case when t.total=0 then 0 else round(x.n*100/t.total,2) end from x cross join t order by x.n desc;
$$;

create or replace function public.get_research_readiness(p_project_id uuid)
returns table(check_name text,status text,observed_value text,required_value text)
language sql stable security definer set search_path=public as $$
 with s as(select * from public.get_v13_research_summary(p_project_id))
 select * from(
  select 'Market data loaded',case when market_rows>0 then 'pass' else 'fail' end,market_rows::text,'> 0' from s
  union all select 'All events processed',case when processed_events=total_events and total_events>0 then 'pass' else 'fail' end,processed_events||' / '||total_events,'100% of events' from s
  union all select 'No failed events',case when failed_events=0 then 'pass' else 'fail' end,failed_events::text,'0' from s
  union all select 'No pending events',case when pending_events=0 then 'pass' else 'fail' end,pending_events::text,'0' from s
  union all select 'Terminal outcomes assigned',case when processed_events=(explained_events+unexplained_events+review_events+insufficient_data_events) then 'pass' else 'fail' end,(explained_events+unexplained_events+review_events+insufficient_data_events)::text,processed_events::text from s
 ) q;
$$;

grant execute on function public.get_market_symbols(uuid) to authenticated;
grant execute on function public.get_v13_research_summary(uuid) to authenticated;
grant execute on function public.get_research_outcome_counts(uuid) to authenticated;
grant execute on function public.get_research_readiness(uuid) to authenticated;
