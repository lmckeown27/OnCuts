-- UGC safety: user blocks + content reports (App Store Guideline 1.2)
-- Apply from backend/: npm run migrate:sql -- 028_ugc_safety_blocks_reports.sql

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_user_id);

CREATE TABLE IF NOT EXISTS ugc_content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  reason VARCHAR(120) NOT NULL,
  detail TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolver_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ugc_reports_status ON ugc_content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugc_reports_reporter ON ugc_content_reports (reporter_user_id);

COMMENT ON TABLE user_blocks IS 'Viewer-side block list; used to filter UGC and prevent messaging.';
COMMENT ON TABLE ugc_content_reports IS 'User reports of objectionable chat content for moderator review.';
