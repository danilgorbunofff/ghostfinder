-- Seed data for local development
-- Login: dev@ghostfinder.local / Dev1234!
-- Org is pre-seeded with recovery tier + realistic demo data for every dashboard view.

DO $$
DECLARE
  v_user_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_org_id  uuid;
BEGIN

  -- ── 1. Dev user (trigger auto-creates org + membership) ──────────────────
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    aud, role, created_at, updated_at,
    confirmation_token, email_change_token_new, recovery_token
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'dev@ghostfinder.local',
    crypt('Dev1234!', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Dev User"}',
    'authenticated', 'authenticated',
    now(), now(), '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- ── 2. Resolve the org the trigger created ────────────────────────────────
  SELECT org_id INTO v_org_id
  FROM public.org_members
  WHERE user_id = v_user_id;

  -- ── 3. Subscription — recovery tier (unlocks all UI features) ────────────
  INSERT INTO public.subscriptions (
    org_id, stripe_customer_id, tier, status,
    verified_annual_savings
  ) VALUES (
    v_org_id, 'cus_mock_dev_local', 'recovery', 'active', 46140.00
  ) ON CONFLICT (org_id) DO UPDATE
    SET tier = 'recovery', status = 'active';

  -- ── 4. Plaid connection (financial panel shows "connected") ───────────────
  INSERT INTO public.plaid_connections (
    org_id, access_token_secret_id, item_id,
    institution_name, institution_id, status, last_synced_at
  ) VALUES (
    v_org_id, gen_random_uuid(), 'mock_item_chase',
    'Chase Bank', 'ins_3', 'active', now() - interval '1 hour'
  ) ON CONFLICT (org_id, item_id) DO NOTHING;

  -- ── 4b. GoCardless connection (EU bank, financial panel shows "connected") ─
  INSERT INTO public.gocardless_connections (
    org_id, requisition_id, account_id,
    institution_id, institution_name, country,
    status, last_synced_at, expires_at
  ) VALUES (
    v_org_id, 'mock_req_seed', 'mock_gc_acct_seed',
    'REVOLUT_REVOGB21', 'Revolut', 'GB',
    'active', now() - interval '2 hours',
    now() + interval '80 days'
  ) ON CONFLICT (org_id, account_id) DO NOTHING;

  -- ── 5. SaaS vendors ───────────────────────────────────────────────────────
  INSERT INTO public.saas_vendors (
    org_id, name, normalized_name, monthly_cost, annual_cost,
    seats_paid, category, is_active, first_seen, last_seen, transaction_count
  ) VALUES
    (v_org_id, 'Slack',      'slack',      875.00,  10500.00, 35, 'Communication',      true, (now()-'90 days'::interval)::date, (now()-'2 days'::interval)::date,  12),
    (v_org_id, 'Notion',     'notion',     320.00,   3840.00, 40, 'Productivity',        true, (now()-'90 days'::interval)::date, (now()-'4 days'::interval)::date,  12),
    (v_org_id, 'Figma',      'figma',      540.00,   6480.00, 18, 'Design',              true, (now()-'90 days'::interval)::date, (now()-'5 days'::interval)::date,  12),
    (v_org_id, 'GitHub',     'github',     210.00,   2520.00, 30, 'Engineering',         true, (now()-'90 days'::interval)::date, (now()-'7 days'::interval)::date,  12),
    (v_org_id, 'Zoom',       'zoom',       450.00,   5400.00, 45, 'Communication',       true, (now()-'90 days'::interval)::date, (now()-'9 days'::interval)::date,  12),
    (v_org_id, 'Jira',       'jira',       380.00,   4560.00, 38, 'Project Management',  true, (now()-'90 days'::interval)::date, (now()-'11 days'::interval)::date, 12),
    (v_org_id, 'Salesforce', 'salesforce', 2400.00, 28800.00, 20, 'CRM',                 true, (now()-'90 days'::interval)::date, (now()-'13 days'::interval)::date, 12),
    (v_org_id, 'HubSpot',    'hubspot',    890.00,  10680.00, 15, 'CRM',                 true, (now()-'90 days'::interval)::date, (now()-'15 days'::interval)::date, 12),
    (v_org_id, 'Asana',      'asana',      290.00,   3480.00, 29, 'Project Management',  true, (now()-'90 days'::interval)::date, (now()-'17 days'::interval)::date, 12),
    (v_org_id, 'Dropbox',    'dropbox',    180.00,   2160.00, 12, 'Storage',             true, (now()-'90 days'::interval)::date, (now()-'19 days'::interval)::date, 12);

  -- ── 6. Transactions ───────────────────────────────────────────────────────
  INSERT INTO public.transactions (
    org_id, plaid_transaction_id, vendor, vendor_normalized, amount, date, is_software
  ) VALUES
    (v_org_id, 'txn_001', 'SLACK TECHNOLOGIES',  'slack',           875.00, now()::date-2,  true),
    (v_org_id, 'txn_002', 'NOTION LABS INC',     'notion',          320.00, now()::date-4,  true),
    (v_org_id, 'txn_003', 'FIGMA INC',           'figma',           540.00, now()::date-5,  true),
    (v_org_id, 'txn_004', 'GITHUB INC',          'github',          210.00, now()::date-7,  true),
    (v_org_id, 'txn_005', 'ZOOM VIDEO COMM',     'zoom',            450.00, now()::date-9,  true),
    (v_org_id, 'txn_006', 'ATLASSIAN JIRA',      'jira',            380.00, now()::date-11, true),
    (v_org_id, 'txn_007', 'SALESFORCE INC',      'salesforce',     2400.00, now()::date-13, true),
    (v_org_id, 'txn_008', 'HUBSPOT INC',         'hubspot',         890.00, now()::date-15, true),
    (v_org_id, 'txn_009', 'ASANA INC',           'asana',           290.00, now()::date-17, true),
    (v_org_id, 'txn_010', 'DROPBOX INC',         'dropbox',         180.00, now()::date-19, true),
    (v_org_id, 'txn_011', 'SLACK TECHNOLOGIES',  'slack',           875.00, now()::date-32, true),
    (v_org_id, 'txn_012', 'NOTION LABS INC',     'notion',          320.00, now()::date-34, true),
    (v_org_id, 'txn_013', 'FIGMA INC',           'figma',           540.00, now()::date-35, true),
    (v_org_id, 'txn_014', 'GITHUB INC',          'github',          210.00, now()::date-37, true),
    (v_org_id, 'txn_015', 'ZOOM VIDEO COMM',     'zoom',            450.00, now()::date-39, true),
    (v_org_id, 'txn_016', 'OFFICE SUPPLY CO',    'office supplies', 145.00, now()::date-8,  false),
    (v_org_id, 'txn_017', 'AMAZON WEB SERVICES', 'aws',            1200.00, now()::date-3,  true);

  -- GoCardless (EU) transactions
  INSERT INTO public.transactions (
    org_id, source, gocardless_transaction_id, vendor, vendor_normalized, amount, currency, date, is_software
  ) VALUES
    (v_org_id, 'gocardless', 'gc_txn_001', 'NOTION LABS IRELAND LTD', 'notion',    320.00, 'EUR', now()::date-6,  true),
    (v_org_id, 'gocardless', 'gc_txn_002', 'ATLASSIAN PTY LTD',      'atlassian', 380.00, 'EUR', now()::date-10, true),
    (v_org_id, 'gocardless', 'gc_txn_003', 'ADYEN*FIGMA INC',        'figma',     540.00, 'EUR', now()::date-14, true),
    (v_org_id, 'gocardless', 'gc_txn_004', 'SLACK TECHNOLOGIES LTD', 'slack',     780.00, 'GBP', now()::date-18, true),
    (v_org_id, 'gocardless', 'gc_txn_005', 'STRIPE PAYMENTS UK',     'stripe',    150.00, 'GBP', now()::date-22, false);

  -- ── 7. Integration connections (usage panel shows "connected") ────────────
  INSERT INTO public.integration_connections (
    org_id, provider, access_token_secret_id,
    is_active, total_users, active_users, inactive_users,
    last_synced_at, metadata
  ) VALUES
    (v_org_id, 'okta', gen_random_uuid(),
     true, 47, 36, 11, now() - interval '30 minutes',
     '{"orgUrl": "https://ghostfinder.okta.com", "domain": "ghostfinder.co"}'::jsonb),
    (v_org_id, 'google_workspace', gen_random_uuid(),
     true, 38, 29, 9, now() - interval '45 minutes',
     '{"domain": "ghostfinder.co", "customerId": "C0mock123"}'::jsonb);

  -- ── 8. User activity (mix of active/inactive to populate ghost seat report) ─
  INSERT INTO public.user_activity (
    org_id, email, display_name, provider, last_login, status, is_admin
  ) VALUES
    (v_org_id, 'alice@ghostfinder.co',  'Alice Johnson',   'okta',             now()-'1 day'::interval,   'active',   true),
    (v_org_id, 'bob@ghostfinder.co',    'Bob Smith',        'okta',             now()-'3 days'::interval,  'active',   false),
    (v_org_id, 'carol@ghostfinder.co',  'Carol White',      'okta',             now()-'45 days'::interval, 'inactive', false),
    (v_org_id, 'dave@ghostfinder.co',   'Dave Brown',       'okta',             now()-'60 days'::interval, 'inactive', false),
    (v_org_id, 'eve@ghostfinder.co',    'Eve Davis',        'okta',             now()-'5 days'::interval,  'active',   false),
    (v_org_id, 'frank@ghostfinder.co',  'Frank Wilson',     'okta',             now()-'90 days'::interval, 'inactive', false),
    (v_org_id, 'grace@ghostfinder.co',  'Grace Lee',        'okta',             now()-'2 days'::interval,  'active',   false),
    (v_org_id, 'henry@ghostfinder.co',  'Henry Martinez',   'google_workspace', now()-'55 days'::interval, 'inactive', false),
    (v_org_id, 'iris@ghostfinder.co',   'Iris Taylor',      'google_workspace', now()-'6 days'::interval,  'active',   false),
    (v_org_id, 'jake@ghostfinder.co',   'Jake Anderson',    'google_workspace', now()-'75 days'::interval, 'inactive', false),
    (v_org_id, 'kate@ghostfinder.co',   'Kate Thomas',      'google_workspace', now()-'4 days'::interval,  'active',   true),
    (v_org_id, 'liam@ghostfinder.co',   'Liam Jackson',     'google_workspace', now()-'40 days'::interval, 'inactive', false),
    (v_org_id, 'maya@ghostfinder.co',   'Maya Harris',      'okta',             now()-'7 days'::interval,  'active',   false),
    (v_org_id, 'noah@ghostfinder.co',   'Noah Clark',       'okta',             now()-'85 days'::interval, 'inactive', false),
    (v_org_id, 'olivia@ghostfinder.co', 'Olivia Lewis',     'google_workspace', now()-'1 day'::interval,   'active',   false);

  -- ── 9. Waste report ───────────────────────────────────────────────────────
  INSERT INTO public.waste_reports (
    org_id, total_monthly_waste, total_annual_waste,
    ghost_seat_count, duplicate_count, ghost_seats, duplicates, generated_at
  ) VALUES (
    v_org_id, 3845.00, 46140.00, 5, 2,
    '[
      {"user": "carol@ghostfinder.co",  "name": "Carol White",    "tools": ["Slack","Figma","Notion"],     "monthly_cost": 1735.00, "last_login_days": 45},
      {"user": "dave@ghostfinder.co",   "name": "Dave Brown",     "tools": ["Slack","Jira"],               "monthly_cost": 1255.00, "last_login_days": 60},
      {"user": "frank@ghostfinder.co",  "name": "Frank Wilson",   "tools": ["Salesforce","HubSpot"],       "monthly_cost": 3290.00, "last_login_days": 90},
      {"user": "henry@ghostfinder.co",  "name": "Henry Martinez", "tools": ["Zoom","Asana"],               "monthly_cost":  740.00, "last_login_days": 55},
      {"user": "jake@ghostfinder.co",   "name": "Jake Anderson",  "tools": ["GitHub","Notion"],            "monthly_cost":  530.00, "last_login_days": 75}
    ]'::jsonb,
    '[
      {"vendors": ["Asana","Jira"],         "monthly_cost":  670.00, "note": "Project management overlap — 29 shared users"},
      {"vendors": ["Salesforce","HubSpot"],  "monthly_cost": 3290.00, "note": "CRM overlap — 12 shared users"}
    ]'::jsonb,
    now()
  );

  -- ── 10. Notification settings ─────────────────────────────────────────────
  INSERT INTO public.notification_settings (
    org_id, slack_webhook_url, slack_enabled,
    email_enabled, email_recipients,
    notify_on_ghost_seats, notify_on_duplicates, notify_threshold_amount
  ) VALUES (
    v_org_id, '', false, false, '{}', true, true, 500.00
  ) ON CONFLICT (org_id) DO NOTHING;

END $$;
