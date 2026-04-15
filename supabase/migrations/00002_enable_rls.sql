-- ============================================================================
-- MIGRATION 2: Row Level Security policies
-- Enforces: Users can only access data belonging to their organization.
-- ============================================================================

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members    ENABLE ROW LEVEL SECURITY;

-- ─── Organizations Policies ─────────────────────────────────────────────────

CREATE POLICY "org_select_own"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "org_update_admin"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_delete_owner"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = organizations.id
        AND user_id = (SELECT auth.uid())
        AND role = 'owner'
    )
  );

-- ─── Org Members Policies ───────────────────────────────────────────────────

CREATE POLICY "members_select_own_org"
  ON public.org_members
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "members_insert_admin"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "members_update_owner"
  ON public.org_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role = 'owner'
    )
  );

CREATE POLICY "members_delete_admin"
  ON public.org_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = (SELECT auth.uid())
        AND om.role IN ('owner', 'admin')
    )
    AND role != 'owner'
  );
