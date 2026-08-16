-- Admin Controls: show or hide reviews on consumer-home provider cards.
-- Idempotent.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS consumer_home_reviews_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN platform_settings.consumer_home_reviews_enabled IS
  'When true, consumer home provider cards and profile modal show reviews.';
