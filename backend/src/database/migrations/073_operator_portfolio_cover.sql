-- One cover photo per specialty in an operator's portfolio.
-- Idempotent. Requires 072_operator_portfolio_tags.sql.

DO $$
BEGIN
  IF to_regclass('public.operator_portfolio_items') IS NULL THEN
    RAISE NOTICE '073_operator_portfolio_cover: operator_portfolio_items is missing; skipping';
    RETURN;
  END IF;

  ALTER TABLE operator_portfolio_items
    ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false;

  COMMENT ON COLUMN operator_portfolio_items.is_cover IS
    'True when this photo is the cover for its specialty. Only one cover per specialty.';

  CREATE INDEX IF NOT EXISTS idx_operator_portfolio_items_cover
    ON operator_portfolio_items (provider_id)
    WHERE is_cover;
END $$;
