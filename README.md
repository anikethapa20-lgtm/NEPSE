# NEPSE Research Workspace V5

V5 fixes the blank dashboard and uses the actual uploaded datasets to seed the research metrics.

## Actual dataset values now used

- Raw ShareSansar file: 532,274 rows, 778 symbols
- Clean panel: 530,692 rows, 777 symbols
- Research dataset: 530,674 rows, 777 symbols
- Abnormal-event file: 845 events, 354 stocks
- NEPSE index workbook: 2,549 rows
- NEPSE Alpha cross-check: 1,157 rows

## New features

- Editable dashboard metrics
- Editable dataset catalog
- Research progress based on manuscript section statuses
- Data-coverage cards
- 845-versus-843 event reconciliation note
- Existing figures and private file uploads remain included

## Required upgrade steps

1. Replace the repository files with V5.
2. Commit and let Netlify redeploy.
3. Run `supabase/upgrade_v5.sql` once in Supabase SQL Editor.
4. Sign out and sign back in.
5. Open Dashboard and Data Catalog.

The dashboard will remain editable, so future results can be changed without replacing the website code.
