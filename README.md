# NEPSE Research Intelligence System V7 — Full Build

Every sidebar module is now operational:

- Dashboard based on database readiness and investigation status
- Data Sources and private Research Files
- Searchable Market Database
- Queue-based Event Detection with parameter history
- Event Explorer and editable case review
- Insider indicator with editable weights
- Pump-and-dump cycle detection and results
- Corporate disclosure matching
- Stock Profiles
- Figures and Tables
- Data Quality queue
- Research Findings and Decisions
- CSV Exports
- Admin monitoring

## Upgrade

1. Replace repository contents with V7.
2. Run `supabase/upgrade_v7_full_system.sql` in Supabase SQL Editor. This includes the corrected V6 event-date cast and all V7 tables/functions.
3. Upload `nepse_research_dataset NEW.csv` in Research Files.
4. Run `Import Market Dataset` once.
5. Queued Event Detection and Pump jobs are processed hourly by `Process Analysis Jobs`, or run that workflow manually.
6. Run the NEPSE API sync to populate announcements, then use the Match Events button.
