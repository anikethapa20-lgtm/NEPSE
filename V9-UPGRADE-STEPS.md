# V9 Upgrade

1. Run `upgrade_v9_ui_internet_evidence.sql` in Supabase SQL Editor.
2. Replace repository files with this V9 package and push to GitHub.
3. Confirm GitHub repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
4. Run **Sync Public Evidence** once.
5. Run **Process Analysis Jobs** after queuing a full cross-reference.
6. Add company aliases in `company_aliases` when an article uses a company name rather than its ticker.

The evidence engine prioritizes official/regulatory sources and treats broader news as supporting context, not conclusive proof.
