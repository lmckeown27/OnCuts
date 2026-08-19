-- Per-app APNs topic (bundle ID). Required when multiple iOS apps share one backend
-- (e.g. OnCuts consumer vs OnCuts Operator). Clients send bundleId on register-device.

ALTER TABLE mobile_devices
  ADD COLUMN IF NOT EXISTS bundle_id VARCHAR(255);

COMMENT ON COLUMN mobile_devices.bundle_id IS 'APNs topic (iOS bundle identifier) for this device row; overrides APN_BUNDLE_ID env when set';

CREATE INDEX IF NOT EXISTS idx_mobile_devices_bundle_id ON mobile_devices(bundle_id)
  WHERE bundle_id IS NOT NULL;
