-- ============================================================================
-- MIGRATION 7: GoCardless (Nordigen) EU Open Banking
-- Creates: gocardless_connections table, extends transactions table
-- ============================================================================

-- ─── GoCardless Connections ─────────────────────────────────────────────────
CREATE TABLE public.gocardless_connections (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requisition_id         TEXT,             -- GoCardless requisition ID
  account_id             TEXT,             -- GoCardless account ID (one per bank account)
  institution_id         TEXT,             -- e.g. "REVOLUT_REVOGB21"
  institution_name       TEXT NOT NULL,
  country                TEXT NOT NULL     -- ISO 3166-1 alpha-2 (e.g. "GB", "DE")
                         CHECK (char_length(country) = 2),
  status                 TEXT DEFAULT 'pending'
                         CHECK (status IN ('pending', 'active', 'syncing', 'error', 'expired', 'disabled')),
  cursor                 TEXT,             -- Last synced date (YYYY-MM-DD) for pagination
  last_synced_at         TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ,      -- PSD2 90-day access expiry
  error_code             TEXT,
  error_message          TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, account_id)
);

ALTER TABLE public.gocardless_connections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_gc_connections_org_id ON public.gocardless_connections(org_id);
CREATE INDEX idx_gc_connections_status ON public.gocardless_connections(org_id, status);

CREATE TRIGGER set_updated_at_gc_connections
  BEFORE UPDATE ON public.gocardless_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Extend transactions table ─────────────────────────────────────────────

-- Source discriminator (plaid vs gocardless)
ALTER TABLE public.transactions
  ADD COLUMN source TEXT NOT NULL DEFAULT 'plaid'
  CHECK (source IN ('plaid', 'gocardless'));

-- GoCardless foreign key
ALTER TABLE public.transactions
  ADD COLUMN gocardless_connection_id UUID REFERENCES public.gocardless_connections(id) ON DELETE CASCADE;

-- GoCardless transaction ID (separate from plaid_transaction_id to avoid migration risk)
ALTER TABLE public.transactions
  ADD COLUMN gocardless_transaction_id TEXT;

-- Make plaid_transaction_id nullable (GoCardless rows won't have it)
ALTER TABLE public.transactions
  ALTER COLUMN plaid_transaction_id DROP NOT NULL;

-- Partial unique index for GoCardless transactions
CREATE UNIQUE INDEX idx_transactions_gc_unique
  ON public.transactions (org_id, gocardless_transaction_id)
  WHERE gocardless_transaction_id IS NOT NULL;

-- Index for filtering by source
CREATE INDEX idx_transactions_source ON public.transactions(org_id, source);

-- ─── RLS Policies on gocardless_connections ─────────────────────────────────

CREATE POLICY "gc_select_own" ON public.gocardless_connections
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "gc_insert_admin" ON public.gocardless_connections
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "gc_update_admin" ON public.gocardless_connections
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

CREATE POLICY "gc_delete_admin" ON public.gocardless_connections
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));
