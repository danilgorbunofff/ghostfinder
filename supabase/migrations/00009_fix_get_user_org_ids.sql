-- ============================================================================
-- MIGRATION 9: Fix recursive org_members RLS helper
-- Prevents authenticated reads from collapsing into policy recursion.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT org_members.org_id
  FROM public.org_members
  WHERE org_members.user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.get_user_org_ids()
IS 'SECURITY DEFINER helper for org-scoped RLS policies. Implemented in plpgsql to avoid SQL inlining recursion.';

REVOKE ALL ON FUNCTION public.get_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO service_role;