-- Remove unused fraud_flags table (never written by live API).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.fraud_flags') IS NOT NULL THEN
    DROP TABLE public.fraud_flags CASCADE;
  END IF;
END $$;
