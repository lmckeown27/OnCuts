-- Operator Portfolio: photos and videos an operator uploads of their services.
-- Clients will read this later when choosing who to book.
-- Idempotent. The provider row lives on service_providers when that is the base
-- table (barbers is then a view and cannot be the foreign-key target).

CREATE TABLE IF NOT EXISTS operator_portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE operator_portfolio_items IS
  'Photos and videos an operator uploads of their services, shown to clients before booking.';

CREATE INDEX IF NOT EXISTS idx_operator_portfolio_items_provider
  ON operator_portfolio_items (provider_id, sort_order, created_at);

DO $$
DECLARE
  provider_table TEXT;
  constraint_name TEXT := 'operator_portfolio_items_provider_id_fkey';
BEGIN
  IF to_regclass('public.service_providers') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'service_providers'
         AND table_type = 'BASE TABLE'
     ) THEN
    provider_table := 'service_providers';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'barbers'
      AND table_type = 'BASE TABLE'
  ) THEN
    provider_table := 'barbers';
  ELSE
    RAISE NOTICE '071_operator_portfolio: no base provider table found; skipping foreign key';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = constraint_name
  ) THEN
    EXECUTE format(
      'ALTER TABLE operator_portfolio_items
         ADD CONSTRAINT %I
         FOREIGN KEY (provider_id) REFERENCES %I(id) ON DELETE CASCADE',
      constraint_name,
      provider_table
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oncuts_user') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE operator_portfolio_items TO oncuts_user';
  END IF;
END $$;
