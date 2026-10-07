-- Link portfolio posts to a completed booking and the specialties they show.
-- Idempotent. Requires 071_operator_portfolio.sql.

DO $$
BEGIN
  IF to_regclass('public.operator_portfolio_items') IS NULL THEN
    RAISE NOTICE '072_operator_portfolio_tags: operator_portfolio_items is missing; skipping';
    RETURN;
  END IF;

  ALTER TABLE operator_portfolio_items
    ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT '{}';

  ALTER TABLE operator_portfolio_items
    ADD COLUMN IF NOT EXISTS booking_id UUID;

  COMMENT ON COLUMN operator_portfolio_items.specialties IS
    'Service ids this photo or video shows. A post-service upload requires at least one.';
  COMMENT ON COLUMN operator_portfolio_items.booking_id IS
    'Completed booking this post came from. Not shown in the upload flow.';

  IF to_regclass('public.bookings') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'operator_portfolio_items_booking_id_fkey'
     ) THEN
    ALTER TABLE operator_portfolio_items
      ADD CONSTRAINT operator_portfolio_items_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_operator_portfolio_items_booking
    ON operator_portfolio_items (booking_id);
END $$;
