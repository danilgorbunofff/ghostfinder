-- ============================================================================
-- MIGRATION 4: Usage discovery tables (Okta + Google Workspace)
-- Creates: integration_connections, user_activity
-- ============================================================================

-- ─── Integration Provider Enum ──────────────────────────────────────────────
CREATE TYPE integration_provider AS ENUM (
  'okta',
  'google_workspace',
  'azure_ad',
  'slack'
);

-- ─── Activity Status Enum ───────────────────────────────────────────────────
CREATE TYPE activity_status AS ENUM (
  'active',
  'inactive',
  'suspended',
  'deprovisioned'
);

-- ─── Integration Connections ────────────────────────────────────────────────
-- Tracks OAuth connections to identity providers.
-- Each org can have multiple providers connected.
CREATE TABLE public.integration_connections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider                integration_provider NOT NULL,
  access_token_secret_id  UUID,             -- Vault reference (encrypted)
  refresh_token_secret_id UUID,             -- Vault reference (encrypted, for token refresh)
  token_expires_at        TIMESTAMPTZ,      -- When the access token expires
  metadata                JSONB DEFAULT '{}', -- Provider-specific config
  -- metadata examples:
  --   Okta:    { "orgUrl": "https://dev-xxx.okta.com", "domain": "company.com" }
  --   Google:  { "domain": "company.com", "customerId": "Cxxxx" }
  is_active               BOOLEAN DEFAULT true,
  total_users             INTEGER DEFAULT 0,
  active_users            INTEGER DEFAULT 0,
  inactive_users          INTEGER DEFAULT 0,
  last_synced_at          TIMESTAMPTZ,
  error_message           TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider)  -- One connection per provider per org
);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_integrations_org_id ON public.integration_connections(org_id);
CREATE INDEX idx_integrations_provider ON public.integration_connections(org_id, provider);

CREATE TRIGGER set_updated_at_integrations
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── User Activity ──────────────────────────────────────────────────────────
-- Stores per-user login activity from connected identity providers.
-- This is the "activity" side of the ghost seat equation.
CREATE TABLE public.user_activity (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_connection_id UUID REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  email                     TEXT NOT NULL,
  display_name              TEXT,
  provider                  TEXT NOT NULL,       -- 'okta' | 'google_workspace'
  last_login                TIMESTAMPTZ,         -- Most recent login timestamp
  status                    activity_status DEFAULT 'active',
  department                TEXT,                 -- Org unit / department
  title                     TEXT,                 -- Job title
  is_admin                  BOOLEAN DEFAULT false,
  raw_data                  JSONB,               -- Full provider response (for debugging)
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email, provider)
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_activity_org_id ON public.user_activity(org_id);
CREATE INDEX idx_user_activity_email ON public.user_activity(org_id, email);
CREATE INDEX idx_user_activity_status ON public.user_activity(org_id, status);
CREATE INDEX idx_user_activity_last_login ON public.user_activity(org_id, last_login);
CREATE INDEX idx_user_activity_inactive ON public.user_activity(org_id, status)
  WHERE status = 'inactive';  -- Partial index for ghost seat queries

CREATE TRIGGER set_updated_at_user_activity
  BEFORE UPDATE ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Integration Connections
CREATE POLICY "integrations_select_own" ON public.integration_connections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "integrations_insert_admin" ON public.integration_connections
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "integrations_update_admin" ON public.integration_connections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "integrations_delete_admin" ON public.integration_connections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

-- User Activity
CREATE POLICY "user_activity_select_own" ON public.user_activity
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- User activity is managed by service_role (cron jobs).
-- No direct insert/update/delete by authenticated users.
