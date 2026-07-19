-- V8 automatic full-data cross-reference engine
alter table public.research_events add column if not exists auto_classification text;
alter table public.research_events add column if not exists confidence_score numeric;
alter table public.research_events add column if not exists explanation_status text default 'unexplained';
alter table public.research_events add column if not exists matched_disclosure_count integer default 0;
alter table public.research_events add column if not exists matched_pump_cycle_count integer default 0;
alter table public.research_events add column if not exists pre_car_5 numeric;
alter table public.research_events add column if not exists post_car_5 numeric;
alter table public.research_events add column if not exists cross_reference_summary text;
alter table public.research_events add column if not exists cross_referenced_at timestamptz;

create table if not exists public.event_cross_references(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 event_id bigint not null references public.research_events(id) on delete cascade unique,
 pre_car_5 numeric, post_car_5 numeric,
 matched_disclosure_count integer not null default 0,
 matched_pump_cycle_count integer not null default 0,
 nearest_disclosure_id uuid references public.nepse_disclosures(id) on delete set null,
 nearest_disclosure_day_difference integer,
 strongest_pump_cycle_id uuid references public.pump_cycles(id) on delete set null,
 auto_classification text,
 confidence_score numeric,
 explanation_status text not null default 'unexplained',
 evidence_summary text,
 evidence_json jsonb not null default '{}'::jsonb,
 cross_referenced_at timestamptz not null default now()
);
create index if not exists event_cross_references_project_status_idx on public.event_cross_references(project_id,explanation_status);
alter table public.event_cross_references enable row level security;
drop policy if exists "members manage event cross references" on public.event_cross_references;
create policy "members manage event cross references" on public.event_cross_references for all to authenticated using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));

alter table public.analysis_jobs drop constraint if exists analysis_jobs_job_type_check;
alter table public.analysis_jobs add constraint analysis_jobs_job_type_check check(job_type in ('event_detection','pump_detection','cross_reference'));

create or replace function public.count_research_market_rows(p_project_id uuid)
returns bigint language sql stable security definer set search_path=public as $$
 select count(*) from public.research_market_data where project_id=p_project_id and public.is_project_member(p_project_id);
$$;
revoke all on function public.count_research_market_rows(uuid) from public;
grant execute on function public.count_research_market_rows(uuid) to authenticated;

create or replace function public.get_dashboard_event_stats(p_project_id uuid)
returns table(total_events bigint,reviewed_events bigint,unexplained_events bigint,high_insider_events bigint,cross_referenced_events bigint,explained_events bigint,high_confidence_events bigint)
language sql stable security definer set search_path=public as $$
 select count(*)::bigint,
 count(*) filter(where review_status='reviewed')::bigint,
 count(*) filter(where coalesce(explanation_status,'unexplained')<>'explained')::bigint,
 count(*) filter(where insider_score>=70)::bigint,
 count(*) filter(where cross_referenced_at is not null)::bigint,
 count(*) filter(where explanation_status='explained')::bigint,
 count(*) filter(where confidence_score>=70)::bigint
 from public.research_events where project_id=p_project_id and public.is_project_member(p_project_id);
$$;
revoke all on function public.get_dashboard_event_stats(uuid) from public;
grant execute on function public.get_dashboard_event_stats(uuid) to authenticated;

create or replace function public.get_event_year_counts(p_project_id uuid)
returns table(event_year integer,event_count bigint)
language sql stable security definer set search_path=public as $$
 select e.event_year,count(*)::bigint from public.research_events e where e.project_id=p_project_id and public.is_project_member(p_project_id) group by e.event_year order by e.event_year;
$$;
revoke all on function public.get_event_year_counts(uuid) from public;
grant execute on function public.get_event_year_counts(uuid) to authenticated;
