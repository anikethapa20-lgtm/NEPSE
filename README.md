# NEPSE Research Workspace V4

V4 adds all current visual research outputs directly to the website and improves bulk importing.

## New in V4

- Figures tab with ten current charts
- Full-size chart preview
- Interpretation under every chart
- Preliminary research note bundled into the website
- Visible warning about the 843-versus-845 event-count discrepancy
- Multi-file upload with automatic file categorization
- Exact upload manifest for the current datasets

## Upgrade

1. Replace the existing GitHub repository contents with this version.
2. Commit the changes.
3. Netlify will deploy automatically.
4. No new SQL is required if `upgrade_v3.sql` was already run successfully.
5. Sign out and sign back in after deployment.

## Add the large datasets

The large CSV and Excel files are intentionally not committed to GitHub. Open the website's **Research Files** tab and select all of them at once. Auto-categorization will classify the CSV and Excel files as datasets.

See `UPLOAD-MANIFEST.md` for the exact list.
