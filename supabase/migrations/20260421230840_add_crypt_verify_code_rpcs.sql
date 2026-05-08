/*
  # Add crypt_code and verify_code RPCs for email verification

  These security-definer functions wrap pgcrypto's crypt() so the edge function
  can hash and verify 6-digit codes without exposing raw hashes to the client.

  ## Functions
  - `crypt_code(p_code text)` → text  — returns bcrypt hash of the code
  - `verify_code(p_code text, p_hash text)` → boolean — returns true if code matches hash
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.crypt_code(p_code text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT extensions.crypt(p_code, extensions.gen_salt('bf'));
$$;

CREATE OR REPLACE FUNCTION public.verify_code(p_code text, p_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
  SELECT extensions.crypt(p_code, p_hash) = p_hash;
$$;
