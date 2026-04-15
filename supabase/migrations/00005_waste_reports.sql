-- ============================================================================
-- MIGRATION 5: Waste reports table
-- Stores the output of the reconciliation engine.
-- ============================================================================

CREATE TABLE public.waste_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  generated_at        TIMESTAMPTZ DEFAULT now(),

  -- ─── Summary Metrics ──────────────────────────────────────────────
  total_monthly_waste NUMERIC(12, 2) DEFAULT 0,
  total_annual_waste  NUMERIC(12, 2) DEFAULT 0,
  ghost_seat_count    INTEGER DEFAULT 0,
  duplicate_count     INTEGER DEFAULT 0,
  opportunity_count   INTEGER DEFAULT 0,

  -- ─── Detailed Findings ────────────────────────────────────────────
  ghost_seats         JSONB DEFAULT '[]',
  duplicates          JSONB DEFAULT '[]',
  report_metadata     JSONB DEFAULT '{}',

  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.waste_reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waste_reports_org_id ON public.waste_reports(org_id);
CREATE INDEX idx_waste_reports_latest ON public.waste_reports(org_id, generated_at DESC);

-- ─── RLS Policies ───────────────────────────────────────────────────

-- Org members can view their reports
CREATE POLICY "reports_select_own" ON public.waste_reports
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = (SELECT auth.uid())
  ));

-- Reports are created by service_role (cron job) only.
-- No INSERT policy for authenticated — this is by design.
-- The cron handler uses the admin client (service_role) which bypasses RLS.
