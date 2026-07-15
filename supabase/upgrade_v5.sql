-- NEPSE Research Workspace V5
-- Run this after V3. Safe to run more than once.

create table if not exists public.dataset_catalog (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  dataset_name text not null,
  role text not null,
  row_count bigint not null default 0,
  unique_symbols integer,
  start_date date,
  end_date date,
  status text not null default 'working',
  notes text,
  updated_at timestamptz not null default now(),
  unique(project_id, dataset_name)
);

alter table public.dataset_catalog enable row level security;

drop policy if exists "members manage dataset catalog" on public.dataset_catalog;
create policy "members manage dataset catalog"
on public.dataset_catalog for all
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

do $$
declare
  pid uuid;
begin
  select id into pid from public.projects order by created_at desc limit 1;

  insert into public.project_metrics
    (project_id, metric_key, metric_label, metric_value, metric_unit, metric_group, sort_order)
  values
    (pid, 'total_observations', 'Research dataset observations', 530674, 'rows', 'dataset', 1),
    (pid, 'unique_event_stocks', 'Unique stocks in event file', 354, 'stocks', 'dataset', 2),
    (pid, 'suspicious_events', 'Detected abnormal events', 845, 'events', 'results', 3),
    (pid, 'pre_event_car', 'Pre-event CAR', 3.04, 'percent', 'results', 4),
    (pid, 'pre_event_t', 'Pre-event t-statistic', 9.15, null, 'results', 5),
    (pid, 'post_event_car', 'Post-event CAR', -0.50, 'percent', 'results', 6),
    (pid, 'post_event_t', 'Post-event t-statistic', -1.64, null, 'results', 7),
    (pid, 'raw_rows', 'Raw ShareSansar rows', 532274, 'rows', 'dataset', 8),
    (pid, 'clean_rows', 'Clean panel rows', 530692, 'rows', 'dataset', 9),
    (pid, 'research_rows', 'Research dataset rows', 530674, 'rows', 'dataset', 10),
    (pid, 'index_rows', 'NEPSE index workbook rows', 2549, 'rows', 'dataset', 11),
    (pid, 'index_export_rows', 'NEPSE Alpha export rows', 1157, 'rows', 'dataset', 12)
  on conflict (project_id, metric_key) do update
  set metric_label = excluded.metric_label,
      metric_value = excluded.metric_value,
      metric_unit = excluded.metric_unit,
      metric_group = excluded.metric_group,
      sort_order = excluded.sort_order,
      updated_at = now();

  insert into public.dataset_catalog
    (project_id, dataset_name, role, row_count, unique_symbols, start_date, end_date, status, notes)
  values
    (pid, 'sharesansar_all_stocks_raw.csv', 'Raw stock-market source file', 532274, 778, '2015-01-01', '2026-03-06', 'raw', 'Contains 25 original ShareSansar columns. Raw symbol count includes historical and possibly non-common-equity tickers.'),
    (pid, 'nepse_all_stocks_clean.csv', 'Clean stock-level panel', 530692, 777, '2015-01-01', '2026-03-03', 'cleaned', 'Ten cleaned price, volume, turnover, and transaction columns.'),
    (pid, 'nepse_research_dataset NEW.csv', 'Primary event-study dataset', 530674, 777, '2015-01-01', '2026-03-03', 'working', 'Contains Return, Market_Return, and Abnormal_Return.'),
    (pid, 'nepse_abnormal_events (1).csv', 'Detected event-level output', 845, 354, '2015-03-04', '2026-02-12', 'working', 'Current event file has 845 rows; preliminary note reports 843. Reconcile before final paper.'),
    (pid, 'Nepse .xlsx', 'Primary NEPSE market-index workbook', 2549, null, null, '2026-03-03', 'working', 'Contains date, OHLC, change, percentage change, and turnover. Verify earliest valid date before finalizing coverage.'),
    (pid, 'nepsealpha_export_price_NEPSE_2021-03-07_2026-03-07_unadjusted.csv', 'Secondary NEPSE index cross-check', 1157, 1, '2021-03-07', '2026-03-03', 'raw', 'Unadjusted NEPSE Alpha export used to validate the market-index series.')
  on conflict (project_id, dataset_name) do update
  set role = excluded.role,
      row_count = excluded.row_count,
      unique_symbols = excluded.unique_symbols,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = now();

  update public.paper_sections
  set status = case
    when title in ('Abstract','1. Introduction','3. Literature Review','4. Data and Sample Construction','5. Methodology','6. Abnormal Event Identification','7. Event Study Results','8. Insider Trading Indicators','9. Pump-and-Dump Detection','12. Discussion and Interpretation','14. Limitations','15. Conclusion','References') then 'drafting'
    else status
  end,
  updated_at = now()
  where project_id = pid;

  insert into public.research_notes (project_id, title, body, note_type)
  select pid, 'Dataset reconciliation required',
    'The current abnormal-event file contains 845 events across 354 stocks, while the preliminary note reports 843 events across 353 stocks. Reproduce the event-generation code and document any exclusions before treating either count as final.',
    'analysis'
  where not exists (
    select 1 from public.research_notes where project_id = pid and title = 'Dataset reconciliation required'
  );
end $$;
