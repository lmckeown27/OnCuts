-- Migration: Campus manager setup
--
-- Campus managers are assigned per-user via the Admin Dashboard or manual SQL.
-- Do not hardcode personal emails in migrations.
--
-- Example (replace placeholders before running manually):
--   UPDATE users SET role = 'CAMPUS_MANAGER' WHERE email = 'user@example.com';
--   UPDATE barbers
--   SET "isCampusManager" = true, "campusId" = '<campus-uuid>'
--   WHERE "userId" = (SELECT id FROM users WHERE email = 'user@example.com');

COMMENT ON TABLE barbers IS 'Barber profiles - isCampusManager flag indicates campus management privileges';
