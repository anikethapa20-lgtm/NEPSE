# NEPSE Research Intelligence System V6

The application is now a research database and investigation system rather than a paper editor.

Implemented:
- Data Sources
- Market Database
- Event Explorer seeded with all 845 current abnormal events
- Editable event classification and scoring
- Corporate Announcements
- Data Quality issue tracking
- Research Findings
- Existing figures, decisions, and research files

Setup:
1. Replace the repository with V6.
2. Run `supabase/upgrade_v6_research_system.sql`.
3. Upload `nepse_research_dataset NEW.csv` in Research Files.
4. Run the GitHub Action `Import Market Dataset`.
5. The Market Database will contain 530,674 searchable rows.
