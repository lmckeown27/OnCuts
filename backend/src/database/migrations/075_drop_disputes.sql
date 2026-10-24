-- Remove unused disputes table (no product flow creates rows).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.disputes') IS NOT NULL THEN
    DROP TABLE public.disputes CASCADE;
  END IF;
END $$;

DROP TYPE IF EXISTS "DisputeStatus";
