-- Check 1 passes when the platform approves the operator application (not at apply time).
-- Attribution may still be locked at apply with check1_at NULL.

ALTER TABLE referral_attributions
  ALTER COLUMN check1_at DROP NOT NULL;

ALTER TABLE referral_attributions
  ALTER COLUMN check1_at DROP DEFAULT;

-- Pending / not-yet-approved applicants should not show Check 1 as passed.
UPDATE referral_attributions a
SET check1_at = NULL,
    updated_at = NOW()
WHERE a.check1_at IS NOT NULL
  AND a.check2_status = 'pending'
  AND a.m1_awarded_at IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM barber_applications ba
      WHERE ba.user_id = a.referred_user_id
        AND ba.status IN ('pending', 'under_review', 'interview_scheduled', 'rejected')
        AND NOT EXISTS (
          SELECT 1
          FROM barber_applications ba2
          WHERE ba2.user_id = a.referred_user_id
            AND ba2.status = 'approved'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM guest_barber_applications gba
      WHERE (gba.linked_user_id = a.referred_user_id OR lower(gba.email) = (
              SELECT lower(u.email) FROM users u WHERE u.id = a.referred_user_id
            ))
        AND gba.status IN ('pending', 'under_review', 'interview_scheduled', 'rejected')
        AND NOT EXISTS (
          SELECT 1
          FROM guest_barber_applications gba2
          WHERE (gba2.linked_user_id = a.referred_user_id OR lower(gba2.email) = (
                  SELECT lower(u.email) FROM users u WHERE u.id = a.referred_user_id
                ))
            AND gba2.status = 'approved'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM barber_applications ba3
          WHERE ba3.user_id = a.referred_user_id
            AND ba3.status = 'approved'
        )
    )
  );

COMMENT ON COLUMN referral_attributions.check1_at IS
  'When Check 1 passed (operator application approved by platform). NULL = locked/pending approval.';
