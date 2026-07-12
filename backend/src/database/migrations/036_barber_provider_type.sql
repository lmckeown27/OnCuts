-- Discriminator for marketplace provider kind (barber | beauty).
-- Table name stays `barbers` for backward compatibility with existing FKs and clients.

ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'barber';

COMMENT ON COLUMN barbers.provider_type IS
  'Marketplace provider kind: barber or beauty (browse buckets). Service offerings live in specialties.';

CREATE INDEX IF NOT EXISTS idx_barbers_provider_type ON barbers (provider_type);
