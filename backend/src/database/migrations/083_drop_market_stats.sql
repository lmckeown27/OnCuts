-- Remove unused market_stats time-series table.
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.market_stats') IS NOT NULL THEN
    DROP TABLE public.market_stats CASCADE;
  END IF;
END $$;
