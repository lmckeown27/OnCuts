-- Remove unused marketplace cron_history audit table (empty; ops crons do not use it).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.cron_history') IS NOT NULL THEN
    DROP TABLE public.cron_history CASCADE;
  END IF;
END $$;
