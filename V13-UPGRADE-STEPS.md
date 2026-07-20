# V13 Upgrade Steps

1. In Supabase SQL Editor, run `supabase/upgrade_v13_autonomous_engine.sql`.
2. Confirm the two market CSV parts are in the `research-files` Storage bucket. The import workflow reads both and populates `research_market_data`.
3. Run **Import Market Dataset** once and confirm Market Database shows 530,674 rows.
4. Run **Autonomous Research Engine**. It queues missing cross-reference work, processes events, and assigns terminal outcomes.
5. Add GitHub secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if not already present.
6. Deploy normally through Netlify. The V13 workflow also runs every six hours.

Pipeline completion is `processed events / total events`. Explained, requires-review, and unexplained are all valid terminal outcomes, so completion reaches 100% once every event has been evaluated.
