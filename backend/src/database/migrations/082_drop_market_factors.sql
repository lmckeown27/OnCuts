-- Remove unused market_factors calibration table.
-- Marketplace code falls back to 1.0 defaults without it.
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.market_factors') IS NOT NULL THEN
    DROP TABLE public.market_factors CASCADE;
  END IF;
END $$;
