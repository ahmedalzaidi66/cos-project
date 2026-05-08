/*
  # Create is_admin_request() function and admin token infrastructure

  1. Schema changes
    - Add `session_token_hash` column to `employees` table
  2. New functions
    - `is_admin_request()` - SECURITY DEFINER function that reads the
      `x-admin-token` HTTP header and validates it against bcrypt hashes
      stored in `employees.session_token_hash`
  3. Seed data
    - Hash for the current fixed admin token ('fixed-admin-token')
      is stored on the admin employee so existing sessions work immediately
  4. Security
    - Function is SECURITY DEFINER so it can read employees table
      regardless of the caller's RLS context
    - Function is VOLATILE to prevent caching within a query
    - search_path is locked to prevent search_path hijacking
*/

-- Add session_token_hash column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'session_token_hash'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN session_token_hash text;
  END IF;
END $$;

-- Create the is_admin_request() function
CREATE OR REPLACE FUNCTION public.is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  v_raw   text;
  v_token text;
  v_hash  text;
BEGIN
  -- Try reading the x-admin-token header from PostgREST request context
  BEGIN
    v_raw := current_setting('request.headers', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN false;
  END IF;

  -- Parse x-admin-token from the headers JSON
  BEGIN
    v_token := v_raw::json->>'x-admin-token';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;

  -- Check token against bcrypt hashes in employees table
  SELECT e.session_token_hash INTO v_hash
  FROM public.employees e
  WHERE e.session_token_hash IS NOT NULL
    AND e.is_active = true
    AND extensions.crypt(v_token, e.session_token_hash) = e.session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;

-- Seed the bcrypt hash for the current fixed admin token on the admin employee
UPDATE public.employees
SET session_token_hash = extensions.crypt('fixed-admin-token', extensions.gen_salt('bf'))
WHERE email = 'admin@lazurdemakeup.com'
  AND is_active = true;
