# V8 Cross-Reference Setup

1. Run `supabase/upgrade_v8_cross_reference.sql` in Supabase SQL Editor.
2. Replace repository files with this build and push to GitHub.
3. In the site, open **Cross Reference** and queue a full cross-reference job.
4. Run **Process Analysis Jobs** in GitHub Actions.
5. Refresh the dashboard and Event Explorer.

The engine compares every event with the full market dataset, nearby disclosures, pump cycles, five-day pre/post CAR, insider scores, and severity. Automatic labels are screening results, not legal conclusions.
