# V7 Full Setup Steps

1. Replace the existing GitHub repository files with everything in this folder.
2. Commit and push. Netlify will redeploy automatically.
3. In Supabase SQL Editor, run `supabase/upgrade_v7_full_system.sql` once. This includes the fixed date cast, all 845 events, all complete-system tables, scoring functions, and matching functions.
4. In the website, upload `nepse_research_dataset NEW.csv` under Research Files. Keep the filename unchanged.
5. In GitHub Actions, run `Import Market Dataset` once.
6. Run `Sync NEPSE Data` to populate current disclosures and market API tables.
7. Use Announcements → Match events to connect disclosures to event dates.
8. Event Detection and Pump-and-Dump jobs can be queued from the website. They are processed hourly by `Process Analysis Jobs`, or you can run that workflow manually.
9. Insider Analysis scores can be recalculated immediately from the website.
10. Use Admin to confirm row counts and job status.
