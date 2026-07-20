# V12 Public NEPSE Monitor

## 1. Apply the database upgrade
Run `upgrade_v12_public_monitor_and_nepal_context.sql` in Supabase SQL Editor.

## 2. Commit and deploy
Commit the V12 files and push to `main`. Wait for Netlify to publish.

## 3. Public routes
- `/` — public daily monitor
- `/methodology` — public methodology and disclaimer
- `/company/NABIL` — public company profile
- `/login` — private research workspace login

## 4. Add Nepal market events
Use the Supabase Table Editor for `nepal_market_events`. Only rows with `review_status = verified` appear publicly.

Recommended event types include government changes, elections, federal budgets, monetary policy, interest-rate decisions, margin-lending rules, capital-gains tax changes, SEBON rules, market closures, natural disasters, pandemics, and sector policy.

## 5. Public safety standard
Public alerts must remain neutral. They describe statistical patterns and evidence status, not fraud, insider trading, manipulation, or illegality.

## 6. Daily operating sequence
1. Import/sync current market data.
2. Detect abnormal events.
3. Sync official evidence and disclosures.
4. Match company announcements.
5. Run full cross-reference.
6. Process analysis jobs.
7. Review high-priority alerts before marking them published.

## 7. Paper
The paper generator now treats political, regulatory, liquidity, merger, acquisition, and corporate events as possible legitimate explanations and clearly separates statistical anomaly from misconduct.
