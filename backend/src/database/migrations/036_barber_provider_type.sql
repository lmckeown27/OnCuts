-- Discriminator for marketplace provider kind (barber, makeup, nails, etc.)
-- Table name stays `barbers` for backward compatibility with existing FKs and clients.

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'barber';

COMMENT ON COLUMN barbers.provider_type IS
  'Marketplace provider kind slug (barber, braids, makeup, nails, lashes, tanning).';

CREATE INDEX IF NOT EXISTS idx_barbers_provider_type ON barbers (provider_type);
