-- Remove unused admin_notes table (API never wrote to Postgres).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.admin_notes') IS NOT NULL THEN
    DROP TABLE public.admin_notes CASCADE;
  END IF;
END $$;
