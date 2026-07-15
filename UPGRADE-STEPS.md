# Exact Upgrade Steps

1. Download and extract `nepse-research-workspace-v3.zip`.
2. Upload all extracted contents to the root of the existing GitHub repository.
3. Replace the old files and commit.
4. Open Supabase SQL Editor.
5. Open `supabase/upgrade_v3.sql` from the downloaded folder.
6. Copy the complete SQL file into Supabase.
7. Click Run once.
8. Wait for `Success. No rows returned`.
9. Netlify should redeploy from GitHub automatically.
10. When deploy finishes, sign out of the site and sign back in.
11. The sidebar will contain:
    - Dashboard
    - Full Paper
    - Analysis Notes
    - Decision Log
    - Research Files
12. Open Research Files to upload existing datasets and analysis material.
