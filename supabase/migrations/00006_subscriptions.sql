-- ============================================================================
-- MIGRATION 6: Billing subscriptions and notification preferences
-- ============================================================================

-- ─── Subscription Tier Enum ─────────────────────────────────────────
CREATE TYPE public.subscription_tier AS ENUM ('free', 'monitor', 'recovery');

-- ─── Subscriptions Table ────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Stripe references
  stripe_customer_id    TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id       TEXT,

  -- Tier & status
  tier                  public.subscription_tier DEFAULT 'free',
  status                TEXT DEFAULT 'active'
                        CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing')),

  -- Billing period
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT false,

  -- Recovery tier tracking
  verified_annual_savings NUMERIC(12, 2) DEFAULT 0,
  commission_charged      NUMERIC(12, 2) DEFAULT 0,

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_subscriptions_org_id ON public.subscriptions(org_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);

-- Trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Notification Settings Table ────────────────────────────────────
CREATE TABLE public.notification_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Slack
  slack_webhook_url TEXT,
  slack_enabled     BOOLEAN DEFAULT false,

  -- Email
  email_enabled     BOOLEAN DEFAULT false,
  email_recipients  TEXT[] DEFAULT '{}',

  -- Preferences
  notify_on_ghost_seats   BOOLEAN DEFAULT true,
  notify_on_duplicates    BOOLEAN DEFAULT true,
  notify_threshold_amount NUMERIC(10, 2) DEFAULT 0,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_notification_settings_org_id ON public.notification_settings(org_id);

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Notification Log ───────────────────────────────────────────────
CREATE TABLE public.notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id     UUID REFERENCES public.waste_reports(id) ON DELETE SET NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('slack', 'email')),
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notification_log_org_id ON public.notification_log(org_id, sent_at DESC);

-- ─── RLS Policies ───────────────────────────────────────────────────

-- Subscriptions: Org members can read, only service_role can modify
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- Notification settings: Org members can read and update
CREATE POLICY "notification_settings_select_own" ON public.notification_settings
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "notification_settings_update_own" ON public.notification_settings
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "notification_settings_insert_own" ON public.notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- Notification log: Org members can read
CREATE POLICY "notification_log_select_own" ON public.notification_log
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));
