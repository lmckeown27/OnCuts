-- Remove unused Prisma campus ranking snapshots table.
-- Live ranking history (if any) uses barber_rank_history.
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.barber_rankings') IS NOT NULL THEN
    DROP TABLE public.barber_rankings CASCADE;
  END IF;
END $$;
