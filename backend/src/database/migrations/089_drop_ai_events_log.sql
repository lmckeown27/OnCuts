-- Remove unused AI events log (never written by live API).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.ai_events_log') IS NOT NULL THEN
    DROP TABLE public.ai_events_log CASCADE;
  END IF;
END $$;
