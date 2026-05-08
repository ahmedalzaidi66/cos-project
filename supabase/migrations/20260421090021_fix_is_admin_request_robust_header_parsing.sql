/*
  # Fix is_admin_request — robust header parsing + correct volatility

  ## Problems fixed
  1. `current_setting('request.headers', true)::json` throws a cast error if the
     setting value is NULL or not valid JSON (happens during direct SQL execution,
     migrations, and some Supabase internal calls). Wrapped in a safer CASE check.
  2. The function was marked STABLE but it reads from `employees` (which changes on
     every login). Changed to VOLATILE so Postgres doesn't cache the result within
     a single query and always re-evaluates it for each row check.
  3. Added explicit NULL guard before the JSON cast to prevent any runtime errors.
*/

CREATE OR REPLACE FUNCTION is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  v_raw    text;
  v_headers json;
  v_token   text;
  v_hash    text;
BEGIN
  -- Read PostgREST request headers; returns NULL when called outside HTTP context
  v_raw := current_setting('request.headers', true);

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN false;
  END IF;

  -- Safe JSON cast — skip if not valid JSON
  BEGIN
    v_headers := v_raw::json;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  v_token := v_headers->>'x-admin-token';
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;

  -- Match token against stored bcrypt hash on an active employee row
  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE session_token_hash IS NOT NULL
    AND is_active = true
    AND crypt(v_token, session_token_hash) = session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;
