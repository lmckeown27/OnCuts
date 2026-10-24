-- Remove unused pricing-multiplier history table.
-- Live value remains on barbers."pricingMultiplier".
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.barber_pricing_multipliers') IS NOT NULL THEN
    DROP TABLE public.barber_pricing_multipliers CASCADE;
  END IF;
END $$;
