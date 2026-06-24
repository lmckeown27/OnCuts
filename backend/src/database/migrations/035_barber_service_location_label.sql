-- Human-readable public service area label (no raw coordinates shown to barbers)
ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS service_location_label TEXT;

COMMENT ON COLUMN barbers.service_location_label IS 'Display label for barber public service area (e.g. campus name, neighborhood, address)';
