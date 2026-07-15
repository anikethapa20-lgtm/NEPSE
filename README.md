# NEPSE Research Workspace V3

This version adds:

- Research progress dashboard
- Main empirical metrics
- Full preliminary-paper content seeded into manuscript sections
- Detailed research prompts for incomplete sections
- Private file library for datasets, code, charts, PDFs, and outputs
- Upload, signed download, category filtering, and deletion
- 100 MB file limit per upload
- Supabase Storage security restricted to approved project members

## Upgrade an existing installation

1. Replace the GitHub repository files with this version.
2. In Supabase SQL Editor, run:

```text
supabase/upgrade_v3.sql
```

3. Confirm Netlify still has:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

4. Commit the repository changes or trigger a Netlify redeploy.
5. Sign out and sign back in.
6. Open the new Dashboard and Research Files tabs.

Do not run the original `schema.sql` again if your existing project is already working. Run only `upgrade_v3.sql`.

## File storage

The upgrade creates a private Supabase Storage bucket called `research-files`.

Supported examples:

- CSV and Excel datasets
- Stata, SPSS, and Parquet files
- Python, R, SQL, notebooks, and ZIP archives
- Research papers and PDFs
- PNG/JPG charts
- Regression tables and analysis outputs

Files are private. The application creates short-lived signed download links for approved authors.
