-- Deactivate Haircut & Fade and Women's Cut as bookable platform services.
-- Existing barber pricing/bookings referencing these names are unchanged.

UPDATE services
SET is_active = false, updated_at = NOW()
WHERE slug IN ('haircut-fade', 'haircut_fade', 'womens-cut', 'womens_cut')
   OR LOWER(name) IN ('haircut & fade', 'women''s cut');
