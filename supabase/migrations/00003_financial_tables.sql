-- ============================================================================
-- MIGRATION 3: Financial data tables (Plaid integration)
-- Creates: plaid_connections, transactions, saas_vendors
-- ============================================================================

-- ─── Plaid Connections ──────────────────────────────────────────────────────
CREATE TABLE public.plaid_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token_secret_id UUID,           -- Reference to vault.secrets (encrypted)
  item_id               TEXT NOT NULL,    -- Plaid Item ID (safe to store plaintext)
  institution_name      TEXT NOT NULL,
  institution_id        TEXT,             -- Plaid Institution ID
  status                TEXT DEFAULT 'active'
                        CHECK (status IN ('active', 'syncing', 'error', 'disabled')),
  cursor                TEXT,             -- Plaid sync cursor for incremental sync
  last_synced_at        TIMESTAMPTZ,
  error_code            TEXT,             -- Plaid error code if status = 'error'
  error_message         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, item_id)
);

ALTER TABLE public.plaid_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_plaid_connections_org_id ON public.plaid_connections(org_id);
CREATE INDEX idx_plaid_connections_status ON public.plaid_connections(org_id, status);

CREATE TRIGGER set_updated_at_plaid_connections
  BEFORE UPDATE ON public.plaid_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Transactions ───────────────────────────────────────────────────────────
CREATE TABLE public.transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plaid_connection_id   UUID REFERENCES public.plaid_connections(id) ON DELETE CASCADE,
  plaid_transaction_id  TEXT NOT NULL,
  vendor                TEXT,              -- Raw merchant name from Plaid
  vendor_normalized     TEXT,              -- Cleaned + matched name (lowercase)
  amount                NUMERIC(12, 2) NOT NULL,  -- Always positive (Plaid sends positive for debits)
  currency              TEXT DEFAULT 'USD',
  date                  DATE NOT NULL,
  mcc_code              TEXT,              -- Merchant Category Code
  category              TEXT,              -- Plaid primary category
  description           TEXT,              -- Full transaction description
  is_software           BOOLEAN DEFAULT false,  -- Flagged as software/SaaS
  pending               BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, plaid_transaction_id)
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_transactions_org_id ON public.transactions(org_id);
CREATE INDEX idx_transactions_date ON public.transactions(org_id, date DESC);
CREATE INDEX idx_transactions_vendor ON public.transactions(org_id, vendor_normalized);
CREATE INDEX idx_transactions_software ON public.transactions(org_id, is_software)
  WHERE is_software = true;  -- Partial index: only software transactions

-- ─── SaaS Vendors ───────────────────────────────────────────────────────────
-- Aggregated view of per-vendor spend derived from transactions.
-- Updated by the sync cron job after each transaction sync.
CREATE TABLE public.saas_vendors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,          -- Display name (e.g., "Slack")
  normalized_name   TEXT NOT NULL,          -- Matching key (e.g., "slack")
  monthly_cost      NUMERIC(12, 2),         -- Avg monthly spend (calculated)
  annual_cost       NUMERIC(12, 2),         -- Projected annual
  seats_paid        INTEGER,                -- Estimated seats (if derivable)
  category          TEXT,                    -- e.g., "Communication", "Project Management"
  first_seen        DATE,                   -- First transaction date
  last_seen         DATE,                   -- Most recent transaction date
  transaction_count INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,   -- false if no charge in 60+ days
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, normalized_name)
);

ALTER TABLE public.saas_vendors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_saas_vendors_org_id ON public.saas_vendors(org_id);
CREATE INDEX idx_saas_vendors_active ON public.saas_vendors(org_id, is_active)
  WHERE is_active = true;

CREATE TRIGGER set_updated_at_saas_vendors
  BEFORE UPDATE ON public.saas_vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Plaid Connections: org members can view, admins can manage
CREATE POLICY "plaid_select_own" ON public.plaid_connections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "plaid_insert_admin" ON public.plaid_connections
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "plaid_update_admin" ON public.plaid_connections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "plaid_delete_admin" ON public.plaid_connections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

-- Transactions: org members can view (insert/update handled by service role)
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- SaaS Vendors: org members can view, admins can manage
CREATE POLICY "vendors_select_own" ON public.saas_vendors
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "vendors_manage_admin" ON public.saas_vendors
  FOR ALL TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));
