-- Per-device APNs gateway: sandbox (Xcode/debug tokens) vs production (TestFlight/App Store).
-- Fixes BadEnvironmentKeyInToken when one API serves both build types.

ALTER TABLE mobile_devices
  ADD COLUMN IF NOT EXISTS apns_environment VARCHAR(20) NOT NULL DEFAULT 'production';

ALTER TABLE mobile_devices DROP CONSTRAINT IF EXISTS mobile_devices_apns_environment_check;
ALTER TABLE mobile_devices ADD CONSTRAINT mobile_devices_apns_environment_check
  CHECK (apns_environment IN ('sandbox', 'production'));

COMMENT ON COLUMN mobile_devices.apns_environment IS 'APNs gateway for this token: sandbox = debug/dev build, production = TestFlight/App Store';
