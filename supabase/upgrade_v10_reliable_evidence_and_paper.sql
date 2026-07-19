-- NEPSE Research System V10
-- Reliable evidence ingestion, disclosure matching, paper metrics, and idempotent schema alignment.

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

alter table public.internet_evidence add column if not exists evidence_type text;
alter table public.internet_evidence add column if not exists relevance_score numeric not null default 0;
alter table public.internet_evidence add column if not exists matched_terms text[] not null default '{}';
alter table public.internet_evidence add column if not exists is_relevant boolean not null default false;
alter table public.internet_evidence add column if not exists validation_status text not null default 'automatic';
alter table public.internet_evidence add column if not exists source_domain text;
alter table public.internet_evidence add column if not exists language text;

create index if not exists internet_evidence_symbol_date_idx on public.internet_evidence(symbol,published_at desc);
create index if not exists internet_evidence_relevance_idx on public.internet_evidence(is_relevant,relevance_score desc,published_at desc);

alter table public.company_aliases enable row level security;
alter table public.internet_evidence enable row level security;
drop policy if exists "authenticated read company aliases" on public.company_aliases;
create policy "authenticated read company aliases" on public.company_aliases for select to authenticated using (true);
drop policy if exists "authenticated read internet evidence" on public.internet_evidence;
create policy "authenticated read internet evidence" on public.internet_evidence for select to authenticated using (true);

-- Complete disclosure table used by the application and matcher.
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
alter table public.nepse_disclosures add column if not exists source_url text;
alter table public.nepse_disclosures add column if not exists source_name text;
alter table public.nepse_disclosures add column if not exists authority_score numeric;
alter table public.nepse_disclosures add column if not exists summary text;
create unique index if not exists nepse_disclosures_source_url_uidx on public.nepse_disclosures(source_url) where source_url is not null;

alter table public.nepse_disclosures enable row level security;
drop policy if exists "members read disclosures v10" on public.nepse_disclosures;
create policy "members read disclosures v10" on public.nepse_disclosures for select to authenticated
using (exists(select 1 from public.project_members where user_id=auth.uid()));

-- Align cross-reference fields.
alter table public.event_cross_references add column if not exists matched_internet_evidence_count integer not null default 0;
alter table public.event_cross_references add column if not exists strongest_internet_evidence_id uuid references public.internet_evidence(id) on delete set null;
alter table public.research_events add column if not exists matched_internet_evidence_count integer not null default 0;

-- Keep worker job types aligned with UI.
alter table public.analysis_jobs drop constraint if exists analysis_jobs_job_type_check;
alter table public.analysis_jobs add constraint analysis_jobs_job_type_check
check (job_type in ('event_detection','pump_detection','cross_reference'));

-- Event-to-disclosure links.
create table if not exists public.event_announcement_matches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id bigint not null references public.research_events(id) on delete cascade,
  disclosure_id uuid not null references public.nepse_disclosures(id) on delete cascade,
  day_difference integer not null,
  match_status text not null default 'automatic',
  created_at timestamptz not null default now(),
  unique(event_id,disclosure_id)
);
alter table public.event_announcement_matches enable row level security;
drop policy if exists "members manage event matches v10" on public.event_announcement_matches;
create policy "members manage event matches v10" on public.event_announcement_matches for all to authenticated
using(public.is_project_member(project_id)) with check(public.is_project_member(project_id));

-- Match exact tickers and dates. This function is called by the UI.
drop function if exists public.match_event_announcements(uuid,integer);
create function public.match_event_announcements(p_project_id uuid,p_window_days integer default 10)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if not public.is_project_member(p_project_id) then raise exception 'Not authorized'; end if;

  insert into public.event_announcement_matches(project_id,event_id,disclosure_id,day_difference)
  select p_project_id,e.id,d.id,(d.published_at::date-e.event_date)
  from public.research_events e
  join public.nepse_disclosures d on upper(trim(coalesce(d.symbol,'')))=upper(trim(e.symbol))
  where e.project_id=p_project_id
    and d.published_at is not null
    and abs(d.published_at::date-e.event_date)<=greatest(1,p_window_days)
  on conflict(event_id,disclosure_id) do update set day_difference=excluded.day_difference;
  get diagnostics n=row_count;

  update public.research_events e set
    matched_disclosure_count=(select count(*) from public.event_announcement_matches m where m.event_id=e.id),
    announcement_match=case
      when exists(select 1 from public.event_announcement_matches m where m.event_id=e.id and m.day_difference<0) then 'Public disclosure before event'
      when exists(select 1 from public.event_announcement_matches m where m.event_id=e.id and m.day_difference=0) then 'Disclosure on event day'
      when exists(select 1 from public.event_announcement_matches m where m.event_id=e.id and m.day_difference>0) then 'Disclosure after event'
      else 'Unmatched' end
  where e.project_id=p_project_id;
  return n;
end $$;
revoke all on function public.match_event_announcements(uuid,integer) from public;
grant execute on function public.match_event_announcements(uuid,integer) to authenticated;

-- Paper-ready summary metrics.
drop function if exists public.get_paper_summary(uuid);
create function public.get_paper_summary(p_project_id uuid)
returns table(
  market_rows bigint,
  total_events bigint,
  cross_referenced_events bigint,
  explained_events bigint,
  requires_review_events bigint,
  high_insider_events bigint,
  pump_cycles bigint,
  disclosure_records bigint,
  public_evidence_records bigint,
  mean_pre_car numeric,
  mean_post_car numeric,
  mean_confidence numeric
)
language sql stable security definer set search_path=public as $$
  select
    (select count(*) from public.research_market_data m where m.project_id=p_project_id),
    count(*)::bigint,
    count(*) filter(where e.cross_referenced_at is not null)::bigint,
    count(*) filter(where e.explanation_status='explained')::bigint,
    count(*) filter(where coalesce(e.explanation_status,'unexplained')<>'explained')::bigint,
    count(*) filter(where e.insider_score>=70)::bigint,
    (select count(*) from public.pump_cycles p where p.project_id=p_project_id),
    (select count(*) from public.nepse_disclosures),
    (select count(*) from public.internet_evidence where is_relevant=true),
    avg(e.pre_car_5),avg(e.post_car_5),avg(e.confidence_score)
  from public.research_events e
  where e.project_id=p_project_id and public.is_project_member(p_project_id);
$$;
revoke all on function public.get_paper_summary(uuid) from public;
grant execute on function public.get_paper_summary(uuid) to authenticated;

drop function if exists public.get_classification_counts(uuid);
create function public.get_classification_counts(p_project_id uuid)
returns table(classification text,event_count bigint,average_confidence numeric)
language sql stable security definer set search_path=public as $$
  select coalesce(e.auto_classification,'Unclassified'),count(*)::bigint,avg(e.confidence_score)
  from public.research_events e
  where e.project_id=p_project_id and public.is_project_member(p_project_id)
  group by coalesce(e.auto_classification,'Unclassified') order by count(*) desc;
$$;
revoke all on function public.get_classification_counts(uuid) from public;
grant execute on function public.get_classification_counts(uuid) to authenticated;

-- Seed symbols and remove known static/navigation records from previous syncs.
insert into public.company_aliases(symbol)
select distinct upper(symbol) from public.research_events where symbol is not null and trim(symbol)<>''
on conflict(symbol) do nothing;

delete from public.internet_evidence
where published_at is null
   or lower(title) in ('board of directors','management team','securities registered','citizen charter')
   or title like '%नागरिक वडापत्र%';

notify pgrst, 'reload schema';
