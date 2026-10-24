-- Remove unused AI annotations store (never written by live API).
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.ai_annotations') IS NOT NULL THEN
    DROP TABLE public.ai_annotations CASCADE;
  END IF;
END $$;

DROP TYPE IF EXISTS "AIModelType" CASCADE;
