-- Remove unused legacy availability_templates table.
-- Live recurring hours live on barbers."weeklySchedule" JSONB.
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.availability_templates') IS NOT NULL THEN
    DROP TABLE public.availability_templates CASCADE;
  END IF;
END $$;
