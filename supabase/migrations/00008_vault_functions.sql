-- ============================================================================
-- Vault helper functions for secure token storage/retrieval
-- These run as SECURITY DEFINER — only service_role can execute them.
-- ============================================================================

-- Ensure private schema exists
CREATE SCHEMA IF NOT EXISTS private;

-- Store a secret in Vault and return the secret_id
CREATE OR REPLACE FUNCTION private.store_secret(
  p_secret TEXT,
  p_name   TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT id INTO v_secret_id FROM vault.create_secret(p_secret, p_name, p_description);
  RETURN v_secret_id;
END;
$$;

-- Retrieve a decrypted secret by its ID
CREATE OR REPLACE FUNCTION private.get_secret(p_secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;

  RETURN v_secret;
END;
$$;

-- Retrieve Plaid access token for a specific connection
CREATE OR REPLACE FUNCTION private.get_plaid_token(p_connection_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id UUID;
  v_token TEXT;
BEGIN
  SELECT access_token_secret_id INTO v_secret_id
  FROM public.plaid_connections
  WHERE id = p_connection_id;

  IF v_secret_id IS NULL THEN
    RAISE EXCEPTION 'No access token found for connection %', p_connection_id;
  END IF;

  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_token;
END;
$$;

-- Restrict access: only service_role can call these functions
REVOKE EXECUTE ON FUNCTION private.store_secret FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION private.get_secret FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION private.get_plaid_token FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION private.store_secret TO service_role;
GRANT EXECUTE ON FUNCTION private.get_secret TO service_role;
GRANT EXECUTE ON FUNCTION private.get_plaid_token TO service_role;
