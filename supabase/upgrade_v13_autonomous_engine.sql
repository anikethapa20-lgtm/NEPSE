-- NEPSE Research Intelligence System V13
-- Separates processing completion from explanatory outcome and adds fast database RPCs.

alter table if exists public.research_events
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processed_at timestamptz,
  add column if not exists terminal_outcome text;

update public.research_events
set processing_status = case when cross_referenced_at is not null then 'completed' else 'pending' end,
    processed_at = coalesce(processed_at,cross_referenced_at),
    terminal_outcome = coalesce(terminal_outcome,
      case when explanation_status='explained' then 'explained'
           when explanation_status in ('unexplained','requires_review') then explanation_status
           when cross_referenced_at is not null then 'unexplained' end);

create index if not exists research_market_data_project_symbol_date_idx
on public.research_market_data(project_id,symbol,trade_date);
create index if not exists research_events_project_processing_idx
on public.research_events(project_id,processing_status,explanation_status);

create or replace function public.get_market_symbols(p_project_id uuid)
returns table(symbol text, row_count bigint, first_date date, last_date date)
language sql stable security definer set search_path=public as $$
 select upper(symbol),count(*)::bigint,min(trade_date)::date,max(trade_date)::date
 from research_market_data where project_id=p_project_id
 group by upper(symbol) order by upper(symbol);
$$;

create or replace function public.get_v13_research_summary(p_project_id uuid)
returns table(market_rows bigint,total_events bigint,processed_events bigint,explained_events bigint,unexplained_events bigint,companies bigint,mean_pre_car numeric,mean_post_car numeric)
language sql stable security definer set search_path=public as $$
 select
  (select count(*) from research_market_data where project_id=p_project_id),
  count(*)::bigint,
  count(*) filter(where processing_status='completed' or cross_referenced_at is not null)::bigint,
  count(*) filter(where explanation_status='explained')::bigint,
  count(*) filter(where coalesce(explanation_status,'unexplained') in ('unexplained','requires_review'))::bigint,
  count(distinct symbol)::bigint,
  avg(pre_car_5),avg(post_car_5)
 from research_events where project_id=p_project_id;
$$;

grant execute on function public.get_market_symbols(uuid) to authenticated;
grant execute on function public.get_v13_research_summary(uuid) to authenticated;
