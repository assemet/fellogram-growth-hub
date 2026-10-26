-- Run in the Supabase SQL Editor. Lists everything the app expects but the database lacks.
-- A single row saying OK means the schema matches the code.
WITH expected_tables(item) AS (
  VALUES ('profiles'), ('stores'), ('store_members'), ('loyalty_programs'), ('rewards'),
         ('customer_memberships'), ('transactions'), ('redemptions'), ('referrals'),
         ('referral_links'), ('staff_invitations')
),
expected_columns(tbl, col) AS (
  VALUES ('stores', 'card_theme'), ('stores', 'brand_primary'), ('stores', 'brand_accent'),
         ('stores', 'background_tint'), ('stores', 'logo_url'),
         ('loyalty_programs', 'stamp_icon'), ('loyalty_programs', 'stamp_cooldown_minutes'),
         ('loyalty_programs', 'referrals_enabled'), ('loyalty_programs', 'referrer_bonus_stamps'),
         ('loyalty_programs', 'welcome_bonus_stamps')
),
expected_functions(item) AS (
  VALUES ('award_stamp'), ('undo_last_stamp'), ('join_store_program'), ('staff_enroll_customer'),
         ('create_staff_invitation'), ('revoke_staff_invitation'), ('accept_staff_invitation'),
         ('create_redemption'), ('redeem_reward'), ('accept_referral'), ('get_referral_code'),
         ('is_store_member'), ('is_store_owner')
),
problems AS (
  SELECT 'missing table' AS problem, item FROM expected_tables
  WHERE to_regclass('public.' || item) IS NULL
  UNION ALL
  SELECT 'missing column', tbl || '.' || col FROM expected_columns e
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col)
  UNION ALL
  SELECT 'missing function', item FROM expected_functions f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = f.item)
  UNION ALL
  SELECT 'award_stamp has no referral rewards', 'run drizzle/migrations/0001_referrals.sql, then 0010'
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'award_stamp'
    AND pg_get_functiondef(p.oid) NOT ILIKE '%referral_reward%'
  UNION ALL
  SELECT 'award_stamp ignores the cooldown setting', 'run 20261024090000_team_and_cooldown.sql'
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'award_stamp'
    AND pg_get_functiondef(p.oid) NOT ILIKE '%stamp_cooldown_minutes%'
)
SELECT problem, item FROM problems
UNION ALL
SELECT 'OK', 'the database matches what the app expects'
WHERE NOT EXISTS (SELECT 1 FROM problems)
ORDER BY 1, 2;
