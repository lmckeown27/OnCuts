-- Migration: Add instagram_handle column to campuses table
-- This allows each campus to have its own Instagram page for content management

-- Add instagram_handle column
ALTER TABLE campuses 
ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN campuses.instagram_handle IS 'Instagram handle for the campus (without @), used for campus manager content management';

-- Update Cal Poly SLO campus with their Instagram handle
UPDATE campuses 
SET instagram_handle = 'campuscutsslo' 
WHERE LOWER(name) LIKE '%cal poly%' OR LOWER(name) LIKE '%california polytechnic%';

