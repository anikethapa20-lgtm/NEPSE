-- NEPSE Research Workspace V3 Upgrade
-- Run this once in Supabase SQL Editor after the original schema.sql.

create table if not exists public.project_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  metric_key text not null,
  metric_label text not null,
  metric_value numeric not null,
  metric_unit text,
  metric_group text not null default 'general',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(project_id, metric_key)
);

create table if not exists public.research_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  category text not null default 'other'
    check (category in ('dataset','figure','paper','code','output','other')),
  description text,
  uploaded_by uuid references auth.users(id) default auth.uid(),
  uploaded_at timestamptz not null default now()
);

alter table public.project_metrics enable row level security;
alter table public.research_files enable row level security;

drop policy if exists "members view metrics" on public.project_metrics;
create policy "members view metrics"
on public.project_metrics for select
using (public.is_project_member(project_id));

drop policy if exists "members manage metrics" on public.project_metrics;
create policy "members manage metrics"
on public.project_metrics for all
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

drop policy if exists "members manage files metadata" on public.research_files;
create policy "members manage files metadata"
on public.research_files for all
using (public.is_project_member(project_id))
with check (public.is_project_member(project_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('research-files', 'research-files', false, 104857600)
on conflict (id) do update
set public = false, file_size_limit = 104857600;

drop policy if exists "project members upload research files" on storage.objects;
create policy "project members upload research files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'research-files'
  and public.is_project_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "project members read research files" on storage.objects;
create policy "project members read research files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'research-files'
  and public.is_project_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "project members delete research files" on storage.objects;
create policy "project members delete research files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'research-files'
  and public.is_project_member(((storage.foldername(name))[1])::uuid)
);

do $$
declare
  pid uuid;
begin
  select id into pid from public.projects order by created_at desc limit 1;

  insert into public.project_metrics
    (project_id, metric_key, metric_label, metric_value, metric_unit, metric_group, sort_order)
  values
    (pid, 'total_observations', 'Total observations', 532274, 'rows', 'dataset', 1),
    (pid, 'unique_stocks', 'Unique stocks', 353, 'stocks', 'dataset', 2),
    (pid, 'suspicious_events', 'Abnormal events', 843, 'events', 'results', 3),
    (pid, 'study_years', 'Study period', 11, 'years', 'dataset', 4),
    (pid, 'pre_event_car', 'Pre-event CAR', 3.04, 'percent', 'results', 5),
    (pid, 'pre_event_t', 'Pre-event t-statistic', 9.15, null, 'results', 6),
    (pid, 'post_event_car', 'Post-event CAR', -0.50, 'percent', 'results', 7),
    (pid, 'post_event_t', 'Post-event t-statistic', -1.64, null, 'results', 8)
  on conflict (project_id, metric_key) do update
  set metric_value = excluded.metric_value,
      metric_label = excluded.metric_label,
      metric_unit = excluded.metric_unit,
      metric_group = excluded.metric_group,
      sort_order = excluded.sort_order,
      updated_at = now();

  update public.paper_sections set
    content = 'This study examines abnormal trading behavior in the Nepal Stock Exchange using approximately eleven years of daily price, volume, and market-index data. Abnormal events are defined as trading days on which a stock experiences both an absolute market-adjusted return greater than three times its trailing 30-day return volatility and volume greater than five times its trailing 30-day average. The final panel contains 532,274 stock-day observations across 353 securities and identifies 843 abnormal events. Event-study results show a mean cumulative abnormal return of 3.04 percent during days -5 to -1, with a t-statistic of 9.15 and p-value below 0.001, indicating significant price buildup before detected events. The mean CAR during days +1 to +5 is -0.50 percent and statistically weak, suggesting limited post-event reversal. The evidence is consistent with information leakage, informed trading, speculative trading, or coordinated manipulation, but the event screen alone does not establish misconduct. The next stage separates events associated with public announcements from unexplained activity and develops specific insider-trading and pump-and-dump indicators.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = 'Abstract' and content = '';

  update public.paper_sections set
    content = 'Financial markets are expected to incorporate publicly available information into asset prices. In emerging and less liquid markets, however, the speed and quality of information incorporation may be affected by concentrated ownership, uneven disclosure, low analyst coverage, speculative participation, and limited regulatory monitoring. These conditions make abnormal price and volume patterns especially important for understanding market efficiency and market integrity.\n\nThis paper investigates whether unusual trading events in the Nepal Stock Exchange are preceded by systematic stock-price movements. It uses a market-adjusted event-study framework to identify daily observations with simultaneous return and volume spikes and then measures abnormal returns before and after those events. The central question is whether prices begin moving before the abnormal trading day in a manner consistent with information leakage, informed trading, or coordinated speculative activity.\n\nThe preliminary analysis identifies 843 abnormal events across 353 listed stocks. The five-day pre-event window produces an average cumulative abnormal return of 3.04 percent, which is highly statistically significant. The post-event window shows a smaller and statistically weaker reversal. These results motivate a broader classification framework that combines event-study evidence, corporate-announcement matching, pump-and-dump detection, and stock-level risk indicators.\n\nThe study contributes by constructing a large stock-day panel for NEPSE, documenting market-wide patterns around extreme trading events, and developing a reproducible screening process that can support future academic and regulatory work. The analysis does not label any event as illegal solely from trading data. Instead, it identifies events that warrant further examination.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '1. Introduction' and content = '';

  update public.paper_sections set
    content = 'This section should explain the institutional structure of the Nepal Stock Exchange, including the exchange, regulator, trading system, settlement cycle, disclosure environment, price limits, market concentration, liquidity conditions, investor composition, and major corporate actions. It should also explain why NEPSE provides a useful setting for studying abnormal trading.\n\nResearch tasks:\n1. Verify the current roles of NEPSE, SEBON, CDS and Clearing, brokers, merchant bankers, and listed firms.\n2. Document trading hours, settlement rules, circuit breakers, daily price limits, and disclosure requirements over the sample period.\n3. Describe major structural changes during the approximately eleven-year sample.\n4. Explain how low liquidity, concentrated ownership, and uneven information dissemination may affect price discovery.\n5. Add official citations for every institutional rule and date.',
    status = 'not_started',
    updated_at = now()
  where project_id = pid and title = '2. Institutional Background: NEPSE' and content = '';

  update public.paper_sections set
    content = 'The literature review should connect four areas: market efficiency in emerging markets, event-study methods, informed or insider trading, and stock-price manipulation. The theoretical foundation begins with the efficient-market hypothesis, which predicts that public information is rapidly incorporated into prices. Research on information asymmetry and informed trading explains why price and volume may move before formal disclosures. Manipulation studies show that coordinated buying can create temporary price pressure followed by reversal.\n\nCore references already identified include Fama (1970), Allen and Gale (1992), Campbell, Lo, and MacKinlay (1997), and MacKinlay (1997). Nepal-specific studies include Adhikari and Paudel (2012) and K.C. and Shrestha (2018). The final review should compare the present event definition with prior return-volume screens, discuss the difficulty of distinguishing informed trading from speculation, and identify the gap created by limited large-sample evidence from NEPSE.\n\nResearch tasks:\n1. Add recent peer-reviewed papers on insider-trading detection and pump-and-dump identification.\n2. Add South Asian and frontier-market evidence.\n3. Separate theoretical predictions from empirical findings.\n4. End with clear hypotheses for pre-event CAR, post-event reversal, announcement matching, and manipulation indicators.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '3. Literature Review' and content = '';

  update public.paper_sections set
    content = 'The dataset combines historical daily trading information collected from ShareSansar with the NEPSE market index. The stock-level file contains closing prices, trading volume, and transaction value for listed companies. The market-index series is used to benchmark broad market movements and calculate market-adjusted abnormal returns.\n\nAfter cleaning, the panel contains 532,274 daily stock observations covering 353 unique securities over approximately eleven years. The preliminary screen identifies 843 abnormal trading events. The final paper must state the exact start and end dates, explain ticker changes and delistings, document duplicate and missing-value treatment, and describe how non-trading days were aligned between stock and index series.\n\nThe sample-construction section should also explain treatment of stock splits, bonus shares, rights issues, cash dividends, and other corporate actions that may mechanically affect prices or volume. Rolling statistics must use only prior information to avoid look-ahead bias. Each generated variable should be defined in a reproducible data dictionary.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '4. Data and Sample Construction' and content = '';

  update public.paper_sections set
    content = 'Daily stock returns are calculated as logarithmic returns: R(i,t) = ln[P(i,t) / P(i,t-1)]. Market returns are calculated from the NEPSE index using the same transformation. The preliminary analysis defines abnormal return as AR(i,t) = R(i,t) - R(m,t), where R(m,t) is the market return on day t.\n\nFor each event, the study examines an event window from ten trading days before to ten trading days after the detected day. Average abnormal return is calculated across events for each relative day. Cumulative abnormal return is the sum of abnormal returns over a specified event window. The principal windows are CAR(-5,-1) for pre-event buildup and CAR(+1,+5) for post-event performance.\n\nThe final methodology must explain the cross-sectional t-test, clustering or dependence adjustments, treatment of repeated events for the same stock, and exclusion or consolidation of overlapping event windows. Robustness analysis should compare the market-adjusted model with a market model or index-beta model, alternative rolling windows, alternative thresholds, winsorized returns, and placebo dates.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '5. Methodology' and content = '';

  update public.paper_sections set
    content = 'An abnormal trading event must satisfy both a return-spike condition and a volume-spike condition. The return condition is |AR(i,t)| > 3 × sigma(i,30), where sigma(i,30) is the trailing 30-trading-day standard deviation. The volume condition is Volume(i,t) > 5 × AvgVolume(i,30), where the average is computed from the previous 30 trading days. A day is classified as an abnormal event only when both criteria are met.\n\nThe screen identifies 843 events. Because the event-day return is part of the selection rule, the event-day spike is mechanically expected and should not be interpreted as independent evidence. The more informative result is the return pattern before the event. The final analysis must confirm that rolling calculations exclude day t, document the minimum history requirement, and state how zero-volume days and thinly traded stocks are treated.\n\nSensitivity tests should use alternative combinations such as 2.5 or 4 standard deviations and volume multiples of 3, 5, or 7. Results should also be reported after removing overlapping windows and after requiring minimum liquidity.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '6. Abnormal Event Identification' and content = '';

  update public.paper_sections set
    content = 'The event study finds statistically significant price buildup before abnormal trading events. Mean CAR(-5,-1) equals 3.04 percent, with a t-statistic of 9.15 and p-value below 0.001. This indicates that, on average, detected stocks appreciate materially during the five trading days before the event day.\n\nMean CAR(+1,+5) equals -0.50 percent, with a t-statistic near -1.64 and p-value near 0.10. The negative sign is consistent with partial reversal, but the statistical evidence is weak at conventional significance levels. The average abnormal return plot and event heatmap show heterogeneity across events, with many but not all observations displaying pre-event gains.\n\nThe final results section should report the number of usable events for each window, means, medians, standard deviations, confidence intervals, p-values, and the share of events with positive CAR. Results should be separated by year, liquidity, market capitalization, event direction, and announcement status. Standard errors should account for repeated firms and overlapping calendar dates.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '7. Event Study Results' and content = '';

  update public.paper_sections set
    content = 'This section will develop an Insider Trading Indicator that ranks events by the strength and timing of pre-event evidence. Candidate inputs include CAR(-5,-1), abnormal volume before day 0, the concentration of gains near day -1, absence of public announcements, reversal after disclosure, repeated suspicious patterns for the same stock, and low baseline liquidity.\n\nThe indicator must be framed as a screening measure rather than proof of insider trading. Each component should be normalized, weighted transparently, and subjected to sensitivity tests. Events should be classified into categories such as explained by public news, possible informed trading, speculative activity, and unclear.\n\nRequired outputs:\n1. Formal indicator equation and rationale for every weight.\n2. Distribution of scores across all events and stocks.\n3. Top-ranked examples with event charts and announcement timelines.\n4. False-positive discussion and manual validation protocol.\n5. Comparison with alternative unsupervised or rule-based classifications.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '8. Insider Trading Indicators' and content = '';

  update public.paper_sections set
    content = 'Pump-and-dump detection should identify episodes in which a rapid price and volume increase is followed by a substantial decline. A candidate cycle begins with abnormal accumulation, reaches a local peak, and ends when price reverses within a defined forward window. The preliminary project has identified 113 potential cycles and a negative mean forward five-day return in the broader analysis files, but these results must be independently reproduced and documented before inclusion.\n\nThe final algorithm should specify the run-up threshold, minimum volume surge, peak rule, reversal threshold, maximum cycle duration, and treatment of overlapping cycles. Results should distinguish genuine corporate-news reactions from unexplained promotions or coordinated trading.\n\nRequired outputs include the number of cycles, average run-up, average reversal, duration, stock concentration, yearly distribution, and detailed charts for representative cases.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '9. Pump-and-Dump Detection' and content = '';

  update public.paper_sections set
    content = 'Detected events should be matched to corporate announcements, including dividends, bonus shares, rights offerings, book closures, earnings releases, board decisions, mergers, and regulatory disclosures. Matching should use announcement dates and event windows broad enough to account for after-hours or delayed publication.\n\nEach event should receive an explanation status: public news available before the price move, news announced on the event day, news announced after the buildup, no matched announcement, or ambiguous match. This classification is essential for distinguishing legitimate information responses from unexplained trading.\n\nThe paper should report match rates, CAR by explanation status, and the timing between price movement and public disclosure. Data sources, scraping procedures, manual checks, and unresolved cases must be documented.',
    status = 'not_started',
    updated_at = now()
  where project_id = pid and title = '10. Corporate Announcement Matching' and content = '';

  update public.paper_sections set
    content = 'Robustness tests should evaluate whether the central pre-event result survives reasonable methodological changes. Planned tests include alternative event thresholds, 20-day and 60-day rolling windows, arithmetic instead of logarithmic returns, a market-model benchmark, median CAR, winsorization, minimum-liquidity filters, removal of overlapping events, firm-clustered standard errors, calendar-date clustering, and placebo events.\n\nAdditional tests should examine positive and negative event days separately, exclude major market-crisis periods, and compare results before and after important regulatory or trading-system changes. Every robustness specification should report the sample size and use the same transparent event-timing rules.',
    status = 'not_started',
    updated_at = now()
  where project_id = pid and title = '11. Robustness Tests' and content = '';

  update public.paper_sections set
    content = 'The combined evidence shows a consistent average pattern: prices rise before selected abnormal events, event days contain extreme return and volume observations by construction, and prices show a small subsequent reversal. Several mechanisms could generate this pattern. Information may leak before corporate announcements, informed investors may trade ahead of public disclosure, speculative investors may chase momentum, or coordinated traders may create temporary price pressure.\n\nThe results should not be interpreted as proof that all detected events involve wrongdoing. The event screen deliberately prioritizes sensitivity and may flag legitimate news reactions, thin-market effects, data problems, or ordinary speculation. Interpretation therefore depends on announcement matching, event-level validation, robustness tests, and comparison across event categories.\n\nThe final discussion should explain economic magnitude, statistical significance, market microstructure, alternative explanations, and how the findings compare with prior emerging-market research.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '12. Discussion and Interpretation' and content = '';

  update public.paper_sections set
    content = 'The study may provide practical value for market surveillance. A regulator or exchange could use a similar screening system to prioritize events for review, combine price-volume evidence with beneficial ownership and order-level data, and monitor repeated patterns around corporate disclosures. The framework could also support issuer compliance and investor education.\n\nRecommendations must remain proportional to the evidence. The paper should not claim that public daily data can determine intent or legal liability. Stronger enforcement conclusions require account-level trading records, identities, communication evidence, and a clear legal standard. The final section should discuss how transparent automated screens can complement rather than replace human investigation.',
    status = 'not_started',
    updated_at = now()
  where project_id = pid and title = '13. Regulatory and Market Implications' and content = '';

  update public.paper_sections set
    content = 'The analysis has several limitations. Daily data cannot identify intraday sequencing, beneficial owners, order placement, or trader intent. Market-adjusted abnormal returns may not fully control for firm-specific risk. Thin trading, corporate actions, stale prices, ticker changes, and data-quality issues may create false positives. The event-day return is mechanically large because it is part of the selection rule. Repeated events and overlapping windows may violate independence assumptions.\n\nAnnouncement data may be incomplete or timestamped imprecisely, and the absence of a matched announcement does not prove private information. The insider-trading and pump-and-dump indicators are screening tools rather than legal determinations. These limitations should be stated clearly and addressed where possible through robustness analysis and manual validation.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '14. Limitations' and content = '';

  update public.paper_sections set
    content = 'This study provides preliminary evidence of systematic abnormal trading patterns in NEPSE. A large panel of daily stock observations identifies 843 events characterized by simultaneous price and volume spikes. Stocks earn an average cumulative abnormal return of approximately 3.04 percent during the five trading days before these events, and this result is highly statistically significant. The post-event CAR is negative but statistically weak.\n\nThe findings are consistent with information leakage, informed trading, speculative momentum, or coordinated market activity, but the current evidence cannot distinguish conclusively among these mechanisms. The next phase matches events to corporate announcements, constructs event-level insider-trading and pump-and-dump indicators, and conducts robustness and validation tests. The final contribution will be a reproducible framework for studying market efficiency and prioritizing unusual trading activity in an emerging-market setting.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = '15. Conclusion' and content = '';

  update public.paper_sections set
    content = 'Allen, F., & Gale, D. (1992). Stock price manipulation. Review of Economic Studies, 59(3), 503-529.\n\nCampbell, J. Y., Lo, A. W., & MacKinlay, A. C. (1997). The Econometrics of Financial Markets. Princeton University Press.\n\nFama, E. F. (1970). Efficient capital markets: A review of theory and empirical work. Journal of Finance, 25(2), 383-417.\n\nHull, J. C. (2018). Options, Futures, and Other Derivatives (10th ed.). Pearson.\n\nMacKinlay, A. C. (1997). Event studies in economics and finance. Journal of Economic Literature, 35(1), 13-39.\n\nAdhikari, P., & Paudel, R. (2012). Testing weak-form efficiency of the Nepalese stock market. NRB Economic Review, 24(2), 1-18.\n\nK.C., S., & Shrestha, P. (2018). Market efficiency and stock price behavior in Nepal Stock Exchange. Journal of Business and Social Sciences Research, 3(1), 75-90.\n\nNepal Stock Exchange. Historical index and market data.\n\nShareSansar. Historical stock-market data.\n\nThe final bibliography should verify every citation, add access dates for online data, use one consistent citation style, and include recent literature used in the expanded review.',
    status = 'drafting',
    updated_at = now()
  where project_id = pid and title = 'References' and content = '';

  update public.paper_sections set
    content = 'Planned appendices:\nA. Variable definitions and data dictionary\nB. Data-cleaning and sample-construction flowchart\nC. Complete event-identification algorithm\nD. Additional AAR and CAR tables\nE. Alternative-threshold robustness tables\nF. Stock-level event counts\nG. Top insider-trading indicator cases\nH. Pump-and-dump cycle charts\nI. Corporate-announcement matching protocol\nJ. Reproducibility instructions and code inventory',
    status = 'not_started',
    updated_at = now()
  where project_id = pid and title = 'Appendices' and content = '';

  insert into public.research_notes (project_id, title, body, note_type)
  select pid, 'Main methodological concern',
    'Because the event-day return is part of the event definition, the day-0 spike is expected by construction. The strongest independent result is the price buildup during days -5 to -1. The paper must emphasize this distinction.',
    'methodology'
  where not exists (
    select 1 from public.research_notes where project_id = pid and title = 'Main methodological concern'
  );

  insert into public.research_notes (project_id, title, body, note_type)
  select pid, 'Overlapping events and dependence',
    'Check whether multiple events for the same stock have overlapping event windows. Re-estimate results after consolidating nearby events and use firm-clustered or two-way clustered standard errors.',
    'question'
  where not exists (
    select 1 from public.research_notes where project_id = pid and title = 'Overlapping events and dependence'
  );

  insert into public.research_decisions (project_id, title, decision, rationale, status)
  select pid, 'Language for detected events',
    'Use abnormal trading event or potentially suspicious event rather than claiming insider trading.',
    'Daily price and volume data can identify unusual patterns but cannot establish trader identity, intent, or legal misconduct.',
    'decided'
  where not exists (
    select 1 from public.research_decisions where project_id = pid and title = 'Language for detected events'
  );
end $$;
