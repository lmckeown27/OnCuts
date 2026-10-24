-- Remove unused standalone reviews table.
-- Live ratings live on bookings ("reviewRating", "reviewComment", "reviewedAt").
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NOT NULL THEN
    DROP TABLE public.reviews CASCADE;
  END IF;
END $$;
