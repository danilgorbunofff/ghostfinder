-- ============================================================================
-- MIGRATION 2: Row Level Security policies
-- Enforces: Users can only access data belonging to their organization.
-- ============================================================================

-- ─── Helper function to get user's org IDs without triggering RLS ───────────
-- SECURITY DEFINER bypasses RLS, preventing infinite recursion on org_members.
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$$;

-- ─── Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members    ENABLE ROW LEVEL SECURITY;

-- ─── Organizations Policies ─────────────────────────────────────────────────

CREATE POLICY "org_select_own"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "org_update_admin"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT public.get_user_org_ids())
  )
  WITH CHECK (
    id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "org_delete_owner"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (SELECT public.get_user_org_ids())
  );

-- ─── Org Members Policies ───────────────────────────────────────────────────

CREATE POLICY "members_select_own_org"
  ON public.org_members
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "members_insert_admin"
  ON public.org_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "members_update_owner"
  ON public.org_members
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT public.get_user_org_ids())
  )
  WITH CHECK (
    org_id IN (SELECT public.get_user_org_ids())
  );

CREATE POLICY "members_delete_admin"
  ON public.org_members
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT public.get_user_org_ids())
    AND role != 'owner'
  );
