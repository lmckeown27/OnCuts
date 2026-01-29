-- Migration: Add Stripe Connect status columns to users table
-- Purpose: Track whether barber's Stripe account is fully verified and can receive payouts
-- This allows filtering out "Restricted" barbers from consumer view

-- Add stripe_payouts_enabled column (tracks if barber can receive payouts)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE;

-- Add stripe_charges_enabled column (tracks if barber can accept charges)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering of verified barbers
CREATE INDEX IF NOT EXISTS idx_users_stripe_payouts_enabled 
  ON users(stripe_payouts_enabled) 
  WHERE stripe_payouts_enabled = true;

-- Update existing barbers: Set payouts_enabled to true for those with stripe_account_id
-- (This is a one-time backfill - assumes existing connected accounts were verified)
-- Note: You may want to verify this manually or run a script to check with Stripe API
UPDATE users 
SET stripe_payouts_enabled = true, stripe_charges_enabled = true
WHERE stripe_account_id IS NOT NULL 
  AND stripe_payouts_enabled IS NULL;

COMMENT ON COLUMN users.stripe_payouts_enabled IS 'Whether barber Stripe Connect account can receive payouts (false = restricted)';
COMMENT ON COLUMN users.stripe_charges_enabled IS 'Whether barber Stripe Connect account can accept charges';

