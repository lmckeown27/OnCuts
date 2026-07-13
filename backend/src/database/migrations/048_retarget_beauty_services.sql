-- Force-retag known Beauty catalog services.
-- Safe to re-run after 047 if rows were left as barber (default).

UPDATE services
SET provider_type = 'beauty',
    updated_at = NOW()
WHERE LOWER(regexp_replace(slug, '[^a-z0-9]+', '', 'g')) IN (
        'braids', 'makeup', 'nails', 'lashes', 'tanning'
      )
   OR LOWER(regexp_replace(name, '[^a-z0-9]+', '', 'g')) IN (
        'braids', 'makeup', 'nails', 'lashes', 'tanning'
      );

-- Confirm resulting tags (optional visibility when run interactively)
-- SELECT slug, name, provider_type FROM services ORDER BY name;
