-- Track admin-removed points as revoked (not spent). Backfill from admin_clawback ledger.

ALTER TABLE operator_points
  ADD COLUMN IF NOT EXISTS lifetime_revoked_pts INTEGER NOT NULL DEFAULT 0
    CHECK (lifetime_revoked_pts >= 0);

ALTER TABLE client_points
  ADD COLUMN IF NOT EXISTS lifetime_revoked_pts INTEGER NOT NULL DEFAULT 0
    CHECK (lifetime_revoked_pts >= 0);

COMMENT ON COLUMN operator_points.lifetime_revoked_pts IS
  'Points removed by admin (revoked); not counted as spent.';
COMMENT ON COLUMN client_points.lifetime_revoked_pts IS
  'Points removed by admin (revoked); not counted as spent.';

-- Move prior admin clawbacks out of spent into revoked.
UPDATE operator_points p
SET
  lifetime_revoked_pts = COALESCE(agg.revoked, 0),
  lifetime_spent_pts = GREATEST(0, p.lifetime_spent_pts - COALESCE(agg.revoked, 0)),
  updated_at = NOW()
FROM (
  SELECT user_id, SUM(ABS(delta_pts))::int AS revoked
  FROM points_ledger
  WHERE kind = 'operator' AND reason = 'admin_clawback' AND delta_pts < 0
  GROUP BY user_id
) agg
WHERE p.user_id = agg.user_id;

UPDATE client_points p
SET
  lifetime_revoked_pts = COALESCE(agg.revoked, 0),
  lifetime_spent_pts = GREATEST(0, p.lifetime_spent_pts - COALESCE(agg.revoked, 0)),
  updated_at = NOW()
FROM (
  SELECT user_id, SUM(ABS(delta_pts))::int AS revoked
  FROM points_ledger
  WHERE kind = 'client' AND reason = 'admin_clawback' AND delta_pts < 0
  GROUP BY user_id
) agg
WHERE p.user_id = agg.user_id;
