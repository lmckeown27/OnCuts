-- Saved left-to-right order of an operator's portfolio specialty sections.
-- Idempotent.

CREATE TABLE IF NOT EXISTS operator_portfolio_section_orders (
  provider_id UUID PRIMARY KEY,
  specialty_ids TEXT[] NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE operator_portfolio_section_orders IS
  'The order an operator arranged their portfolio specialty sections.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oncuts_user') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE operator_portfolio_section_orders TO oncuts_user';
  END IF;
END $$;
