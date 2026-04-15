-- ============================================================================
-- GhostFinder Database Verification Script
-- Run against local Supabase (port 54322) after `npx supabase db reset`
-- Usage: psql -h localhost -p 54322 -U postgres -d postgres -f scripts/verify-db.sql
-- ============================================================================

\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK B2: Schema Completeness — All expected tables exist'
\echo '═══════════════════════════════════════════════════════════════'

SELECT table_name,
  CASE WHEN table_name IN (
    'integration_connections', 'notification_log', 'notification_settings',
    'org_members', 'organizations', 'plaid_connections', 'saas_vendors',
    'subscriptions', 'transactions', 'user_activity', 'waste_reports'
  ) THEN '✅ EXPECTED' ELSE '⚠️  UNEXPECTED' END AS status
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Count check
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  IF cnt = 11 THEN
    RAISE NOTICE 'B2 RESULT: ✅ PASS — 11/11 tables found';
  ELSE
    RAISE WARNING 'B2 RESULT: ❌ FAIL — Expected 11 tables, found %', cnt;
  END IF;
END $$;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK B3: RLS Enabled on ALL public tables'
\echo '═══════════════════════════════════════════════════════════════'

SELECT tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_tables
  WHERE schemaname = 'public' AND NOT rowsecurity;
  IF cnt = 0 THEN
    RAISE NOTICE 'B3 RESULT: ✅ PASS — RLS enabled on all tables';
  ELSE
    RAISE WARNING 'B3 RESULT: ❌ FAIL — % tables have RLS disabled', cnt;
  END IF;
END $$;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK B5: Vault Functions Exist in private schema'
\echo '═══════════════════════════════════════════════════════════════'

SELECT routine_name,
  CASE WHEN routine_name IN ('store_secret', 'get_secret', 'get_plaid_token')
    THEN '✅ EXPECTED' ELSE '⚠️  UNEXPECTED' END AS status
FROM information_schema.routines
WHERE routine_schema = 'private'
ORDER BY routine_name;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK B6: Critical Indexes'
\echo '═══════════════════════════════════════════════════════════════'

WITH expected_indexes(idx_name) AS (VALUES
  ('idx_org_members_user_id'), ('idx_org_members_org_id'),
  ('idx_plaid_connections_org_id'), ('idx_plaid_connections_status'),
  ('idx_transactions_org_id'), ('idx_transactions_date'),
  ('idx_transactions_vendor'), ('idx_transactions_software'),
  ('idx_saas_vendors_org_id'), ('idx_saas_vendors_active'),
  ('idx_integrations_org_id'), ('idx_integrations_provider'),
  ('idx_user_activity_org_id'), ('idx_user_activity_email'),
  ('idx_user_activity_status'), ('idx_user_activity_last_login'),
  ('idx_user_activity_inactive'),
  ('idx_waste_reports_org_id'), ('idx_waste_reports_latest'),
  ('idx_subscriptions_org_id'), ('idx_subscriptions_stripe_customer'),
  ('idx_subscriptions_stripe_sub'),
  ('idx_notification_settings_org_id'), ('idx_notification_log_org_id')
)
SELECT e.idx_name,
  CASE WHEN i.indexname IS NOT NULL THEN '✅ FOUND' ELSE '❌ MISSING' END AS status
FROM expected_indexes e
LEFT JOIN pg_indexes i ON i.indexname = e.idx_name AND i.schemaname = 'public'
ORDER BY e.idx_name;

DO $$
DECLARE
  missing INT;
BEGIN
  WITH expected_indexes(idx_name) AS (VALUES
    ('idx_org_members_user_id'), ('idx_org_members_org_id'),
    ('idx_plaid_connections_org_id'), ('idx_plaid_connections_status'),
    ('idx_transactions_org_id'), ('idx_transactions_date'),
    ('idx_transactions_vendor'), ('idx_transactions_software'),
    ('idx_saas_vendors_org_id'), ('idx_saas_vendors_active'),
    ('idx_integrations_org_id'), ('idx_integrations_provider'),
    ('idx_user_activity_org_id'), ('idx_user_activity_email'),
    ('idx_user_activity_status'), ('idx_user_activity_last_login'),
    ('idx_user_activity_inactive'),
    ('idx_waste_reports_org_id'), ('idx_waste_reports_latest'),
    ('idx_subscriptions_org_id'), ('idx_subscriptions_stripe_customer'),
    ('idx_subscriptions_stripe_sub'),
    ('idx_notification_settings_org_id'), ('idx_notification_log_org_id')
  )
  SELECT count(*) INTO missing
  FROM expected_indexes e
  LEFT JOIN pg_indexes i ON i.indexname = e.idx_name AND i.schemaname = 'public'
  WHERE i.indexname IS NULL;

  IF missing = 0 THEN
    RAISE NOTICE 'B6 RESULT: ✅ PASS — All 24 expected indexes found';
  ELSE
    RAISE WARNING 'B6 RESULT: ❌ FAIL — % indexes missing', missing;
  END IF;
END $$;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK B7: Enum Types'
\echo '═══════════════════════════════════════════════════════════════'

SELECT t.typname AS enum_name, e.enumlabel AS value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname IN ('integration_provider', 'activity_status', 'subscription_tier')
ORDER BY t.typname, e.enumsortorder;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK: RLS Policies Count per Table'
\echo '═══════════════════════════════════════════════════════════════'

SELECT schemaname, tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'CHECK: Triggers'
\echo '═══════════════════════════════════════════════════════════════'

SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'DATABASE VERIFICATION COMPLETE'
\echo '═══════════════════════════════════════════════════════════════'
