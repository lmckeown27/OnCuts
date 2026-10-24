-- Remove unused escrows payment-hold table.
-- Live booking payments use Stripe PaymentIntents + payment_transactions.
-- Idempotent.

DO $$
BEGIN
  IF to_regclass('public.escrows') IS NOT NULL THEN
    DROP TABLE public.escrows CASCADE;
  END IF;
END $$;

DROP FUNCTION IF EXISTS update_escrows_updated_at() CASCADE;
