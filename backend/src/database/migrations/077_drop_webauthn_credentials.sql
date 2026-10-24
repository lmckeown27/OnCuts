-- Remove unused WebAuthn / passkey storage (no product flow writes to these).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.webauthn_credentials') IS NOT NULL THEN
    DROP TABLE public.webauthn_credentials CASCADE;
  END IF;
END $$;

ALTER TABLE users DROP COLUMN IF EXISTS webauthn_challenge;
ALTER TABLE users DROP COLUMN IF EXISTS webauthn_challenge_expires_at;
