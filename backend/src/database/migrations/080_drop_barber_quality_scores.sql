-- Remove unused BQS component history table.
-- Live value remains on barbers."bqsScore".
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.barber_quality_scores') IS NOT NULL THEN
    DROP TABLE public.barber_quality_scores CASCADE;
  END IF;
END $$;
