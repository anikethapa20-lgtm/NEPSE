# V11 Historical Evidence Backfill

This patch adds a database-wide historical evidence backfill for 2015 onward.

## What it adds

- Parallel GitHub Action for SEBON notices, news, prospectuses, public issues, NRB notices, and GDELT news discovery.
- Official records receive higher authority than news-discovery records.
- News records remain `discovery_only` and cannot independently receive official-source status.
- Automatic pagination continues until the requested start date is reached.
- Evidence and symbol-linked disclosures are upserted without duplicates.
- Supabase backfill-run tracking and year-by-year coverage functions.
- Historical coverage chart and backfill status on the Public Evidence page.
- Evidence coverage years and source totals in the database-generated paper draft.

## Install

1. Copy the contents of this patch into the root of the existing repository. Keep the directory structure.
2. Run `upgrade_v11_historical_evidence.sql` in a new Supabase SQL Editor query.
3. Commit and push the changed files.
4. Wait for Netlify to publish successfully.
5. Open GitHub Actions and run **Backfill Historical Evidence**.
6. Keep the default range `2015-01-01` through `2026-12-31`.
7. Wait for all six matrix jobs to finish. A partial failure does not cancel the other sources.
8. Refresh **Public evidence** and confirm the year chart covers historical years.
9. Open **Company disclosures** and click **Match events**.
10. Queue **Run full cross-reference**, then run **Process Analysis Jobs**.
11. Refresh the dashboard and **Research outputs → Paper draft**.

## Reliability rules

- SEBON and NRB records are treated as official regulator evidence.
- Generic procurement, staffing, holiday, construction, and institutional pages are excluded.
- Records require a valid publication date and either a company match or securities-market event keywords.
- GDELT is used only for news discovery and receives lower authority.
- Automatic classifications remain screening labels, not legal conclusions.
