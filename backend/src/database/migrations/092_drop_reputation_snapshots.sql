-- Remove unused reputation_snapshots table (never written by live API).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.reputation_snapshots') IS NOT NULL THEN
    DROP TABLE public.reputation_snapshots CASCADE;
  END IF;
END $$;
