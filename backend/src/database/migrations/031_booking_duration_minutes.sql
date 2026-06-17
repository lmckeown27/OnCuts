-- Store per-booking service duration (minutes) set by the barber on their service menu.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 60;

COMMENT ON COLUMN bookings."durationMinutes" IS 'Length of the booked service in minutes; copied from barber pricing at booking time.';
