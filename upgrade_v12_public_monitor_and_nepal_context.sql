-- V12: public daily monitor, Nepal-specific context, cautious classifications
create table if not exists public.nepal_market_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  event_date date not null,
  event_type text not null check (event_type in (
    'government_change','election','federal_budget','monetary_policy','interest_rate',
    'banking_regulation','margin_lending','capital_gains_tax','sebon_rule','market_closure',
    'natural_disaster','pandemic','political_instability','sector_policy','merger_policy','other'
  )),
  title text not null,
  description text,
  source_name text not null,
  source_url text not null,
  authority_score integer not null default 80 check (authority_score between 0 and 100),
  affected_scope text not null default 'market' check (affected_scope in ('market','sector','company')),
  affected_sectors text[] not null default '{}',
  affected_symbols text[] not null default '{}',
  expected_market_direction text check (expected_market_direction in ('positive','negative','mixed','uncertain')),
  verified boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_date,title,source_url)
);

create index if not exists nepal_market_events_date_idx on public.nepal_market_events(event_date desc);
create index if not exists nepal_market_events_type_idx on public.nepal_market_events(event_type);

create table if not exists public.event_explanations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  event_id bigint not null,
  statistical_classification text not null default 'abnormal_price_volume_event',
  evidence_based_explanation text not null default 'insufficient_evidence',
  public_label text not null default 'Unusual market activity',
  explanation_confidence numeric(5,2),
  liquidity_adjustment numeric,
  political_event_id uuid references public.nepal_market_events(id) on delete set null,
  evidence_available_before_event boolean,
  reviewer_status text not null default 'automatic' check (reviewer_status in ('automatic','pending','reviewed','published','withheld')),
  reviewer_notes text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(project_id,event_id)
);

create index if not exists event_explanations_event_idx on public.event_explanations(project_id,event_id);
create index if not exists event_explanations_public_idx on public.event_explanations(reviewer_status,published_at desc);

alter table public.nepal_market_events enable row level security;
alter table public.event_explanations enable row level security;

-- Researchers retain normal authenticated access.
drop policy if exists "researchers manage nepal market events" on public.nepal_market_events;
create policy "researchers manage nepal market events" on public.nepal_market_events for all to authenticated using (true) with check (true);
drop policy if exists "researchers manage event explanations" on public.event_explanations;
create policy "researchers manage event explanations" on public.event_explanations for all to authenticated using (true) with check (true);

create or replace function public.public_event_label(
  p_auto_classification text,
  p_explanation_status text,
  p_disclosures integer,
  p_evidence integer,
  p_pump integer
) returns text language sql immutable as $$
select case
  when coalesce(p_disclosures,0)>0 or lower(coalesce(p_explanation_status,'')) like '%explained%' then 'Corporate or public event identified'
  when lower(coalesce(p_auto_classification,'')) like '%liquidity%' then 'Liquidity-related unusual activity'
  when lower(coalesce(p_auto_classification,'')) like '%pump%' or coalesce(p_pump,0)>0 then 'Unusual run-up and reversal pattern'
  when coalesce(p_evidence,0)>0 then 'Public information located near event'
  else 'Unusual market activity'
end;
$$;

create or replace function public.get_public_market_overview()
returns table(
 latest_market_date date, market_rows bigint, total_events bigint, latest_day_events bigint,
 verified_evidence bigint, company_disclosures bigint, companies_tracked bigint, last_updated timestamptz
) language sql security definer set search_path=public as $$
with latest as (select max(trade_date)::date d from research_market_data),
 m as (select count(*)::bigint n from research_market_data),
 e as (select count(*)::bigint n from research_events),
 le as (select count(*)::bigint n from research_events where event_date::date=(select d from latest)),
 ev as (select count(*)::bigint n from internet_evidence where is_relevant=true),
 d as (select count(*)::bigint n from nepse_disclosures),
 c as (select count(distinct symbol)::bigint n from research_market_data),
 u as (select greatest(coalesce(max(trade_date)::timestamptz,'epoch'),coalesce((select max(fetched_at) from internet_evidence),'epoch')) t from research_market_data)
select latest.d,m.n,e.n,le.n,ev.n,d.n,c.n,u.t from latest,m,e,le,ev,d,c,u;
$$;

create or replace function public.get_public_daily_alerts(p_limit integer default 30)
returns table(
 event_id bigint,symbol text,event_date date,close_price numeric,volume numeric,abnormal_return numeric,
 volume_multiple numeric,severity_score numeric,public_label text,explanation_status text,confidence_score numeric,
 matched_disclosure_count integer,matched_evidence_count integer,updated_at timestamptz
) language sql security definer set search_path=public as $$
select e.id,e.symbol,e.event_date::date,e.close_price,e.volume,e.abnormal_return,e.volume_multiple,e.severity_score,
 coalesce(x.public_label,public_event_label(e.auto_classification,e.explanation_status,e.matched_disclosure_count,
   0,e.matched_pump_cycle_count)),
 coalesce(x.evidence_based_explanation,e.explanation_status,'Research review required'),
 coalesce(x.explanation_confidence,e.confidence_score),coalesce(e.matched_disclosure_count,0),
 0,coalesce(x.updated_at,now())
from research_events e left join event_explanations x on x.project_id=e.project_id and x.event_id=e.id
order by e.event_date desc,e.severity_score desc nulls last limit greatest(1,least(p_limit,200));
$$;

create or replace function public.get_public_company_directory(p_limit integer default 20,p_search text default null)
returns table(symbol text,company_name text,sector text,latest_trade_date date,latest_close numeric,latest_volume numeric,event_count bigint,last_event_date date)
language sql security definer set search_path=public as $$
with symbols as (
 select distinct on (m.symbol) m.symbol,m.trade_date::date latest_trade_date,m.close_price latest_close,m.volume latest_volume
 from research_market_data m order by m.symbol,m.trade_date desc
), names as (
 select distinct on (upper(a.symbol)) upper(a.symbol) symbol,a.company_name from company_aliases a order by upper(a.symbol),a.updated_at desc nulls last
), counts as (
 select upper(symbol) symbol,count(*)::bigint event_count,max(event_date)::date last_event_date from research_events group by upper(symbol)
)
select s.symbol,n.company_name,null::text sector,s.latest_trade_date,s.latest_close,s.latest_volume,coalesce(c.event_count,0),c.last_event_date
from symbols s left join names n on n.symbol=upper(s.symbol) left join counts c on c.symbol=upper(s.symbol)
where p_search is null or s.symbol ilike '%'||p_search||'%' or coalesce(n.company_name,'') ilike '%'||p_search||'%'
order by coalesce(c.event_count,0) desc,s.symbol limit greatest(1,least(p_limit,200));
$$;

create or replace function public.get_public_company_profile(p_symbol text)
returns table(symbol text,company_name text,sector text,latest_trade_date date,latest_close numeric,latest_volume numeric,event_count bigint,last_event_date date)
language sql security definer set search_path=public as $$
select d.* from get_public_company_directory(2000,p_symbol) d where upper(d.symbol)=upper(p_symbol) limit 1;
$$;

create or replace function public.get_public_company_alerts(p_symbol text,p_limit integer default 100)
returns table(
 event_id bigint,symbol text,event_date date,close_price numeric,volume numeric,abnormal_return numeric,
 volume_multiple numeric,severity_score numeric,public_label text,explanation_status text,confidence_score numeric,
 matched_disclosure_count integer,matched_evidence_count integer,updated_at timestamptz
) language sql security definer set search_path=public as $$
select a.* from get_public_daily_alerts(5000) a where upper(a.symbol)=upper(p_symbol) order by a.event_date desc limit greatest(1,least(p_limit,500));
$$;

create or replace function public.get_public_company_evidence(p_symbol text,p_limit integer default 100)
returns table(title text,published_at timestamptz,source_name text,source_url text,source_type text,symbol text,evidence_type text)
language sql security definer set search_path=public as $$
select e.title,e.published_at,e.source_name,e.source_url,e.source_type,e.symbol,e.evidence_type
from internet_evidence e where e.is_relevant=true and upper(e.symbol)=upper(p_symbol)
order by e.published_at desc limit greatest(1,least(p_limit,500));
$$;

create or replace function public.get_public_nepal_market_events(p_limit integer default 20)
returns table(event_date date,event_type text,title text,description text,source_name text,source_url text,affected_scope text,verified boolean)
language sql security definer set search_path=public as $$
select e.event_date,e.event_type,e.title,e.description,e.source_name,e.source_url,e.affected_scope,e.verified
from nepal_market_events e where e.review_status='verified' order by e.event_date desc limit greatest(1,least(p_limit,100));
$$;

grant execute on function public.get_public_market_overview() to anon,authenticated;
grant execute on function public.get_public_daily_alerts(integer) to anon,authenticated;
grant execute on function public.get_public_company_directory(integer,text) to anon,authenticated;
grant execute on function public.get_public_company_profile(text) to anon,authenticated;
grant execute on function public.get_public_company_alerts(text,integer) to anon,authenticated;
grant execute on function public.get_public_company_evidence(text,integer) to anon,authenticated;
grant execute on function public.get_public_nepal_market_events(integer) to anon,authenticated;
