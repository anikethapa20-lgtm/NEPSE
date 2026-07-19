# V10 upgrade

1. Run `upgrade_v10_reliable_evidence_and_paper.sql` in a new Supabase SQL Editor tab.
2. Replace the repository files with this package and push to `main`.
3. Confirm GitHub Actions secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run **Sync Public Evidence**.
5. Open **Company disclosures** and click **Match events**.
6. Queue **Run full cross-reference**, then run **Process Analysis Jobs**.
7. Open **Research outputs → Paper draft**, refresh metrics, and download the current draft.

The evidence sync rejects undated generic pages, requires event relevance, and writes symbol-linked records into both `internet_evidence` and `nepse_disclosures`.
