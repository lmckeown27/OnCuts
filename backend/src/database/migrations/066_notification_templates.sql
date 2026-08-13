-- Admin-editable notification copy and audience (consumer / operator / both).
-- System rows are seeded and must not be deleted. Custom rows are admin-created.
-- Idempotent.

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('system', 'custom')),
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('consumer', 'operator', 'both')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_kind
  ON notification_templates (kind, label);

COMMENT ON TABLE notification_templates IS
  'Admin Controls catalog: automatic event copy plus custom announcements.';

INSERT INTO notification_templates (key, kind, label, title, body, audience, enabled)
VALUES
  (
    'new_booking_request',
    'system',
    'New booking request',
    'New Booking Request!',
    '{{consumerName}} wants to book a {{service}} with you',
    'operator',
    TRUE
  ),
  (
    'booking_accepted',
    'system',
    'Booking accepted',
    'Booking Accepted!',
    '{{barberName}} accepted your booking request. Pay now to confirm.',
    'consumer',
    TRUE
  ),
  (
    'booking_declined',
    'system',
    'Booking declined',
    'Booking Declined',
    '{{barberName}} was unable to accept your booking request{{reasonSuffix}}',
    'consumer',
    TRUE
  ),
  (
    'booking_cancelled',
    'system',
    'Booking cancelled',
    'Booking Cancelled',
    '{{message}}',
    'both',
    TRUE
  ),
  (
    'booking_reminder',
    'system',
    'Appointment reminder',
    'Appointment in {{hoursUntilLabel}}',
    '{{service}} with {{counterpartyName}} is coming up soon.',
    'both',
    TRUE
  ),
  (
    'booking_reminder_start',
    'system',
    'Appointment starting now',
    'Appointment starting now',
    '{{service}} with {{counterpartyName}} is starting now.',
    'both',
    TRUE
  ),
  (
    'application_approved',
    'system',
    'Application accepted',
    'Your {{operatorType}} application was accepted. Welcome to OnCuts',
    'Your {{operatorType}} application was accepted. Welcome to OnCuts',
    'operator',
    TRUE
  ),
  (
    'payment_received',
    'system',
    'Payment received',
    'Payment Received!',
    '{{message}}',
    'operator',
    TRUE
  ),
  (
    'payment_request',
    'system',
    'Add a tip',
    'Add a tip',
    '{{barberName}} completed your {{service}}. Consider leaving a tip.',
    'consumer',
    TRUE
  ),
  (
    'schedule_change_requested',
    'system',
    'Schedule change requested',
    'Schedule change requested',
    '{{consumerName}} requested to move the appointment to {{formattedDate}} at {{formattedTime}}',
    'operator',
    TRUE
  ),
  (
    'schedule_change_approved',
    'system',
    'Schedule change approved',
    'Schedule change approved',
    'Your appointment was moved to {{formattedDate}} at {{formattedTime}}',
    'consumer',
    TRUE
  ),
  (
    'schedule_change_declined',
    'system',
    'Schedule change declined',
    'Schedule change declined',
    'Your provider declined the requested schedule change. Your original appointment time still stands.',
    'consumer',
    TRUE
  ),
  (
    'booking_rescheduled',
    'system',
    'Booking rescheduled',
    'Booking Updated',
    '{{counterpartyName}} has rescheduled {{reschedulePhrase}} to {{formattedDate}} at {{formattedTime}}',
    'both',
    TRUE
  ),
  (
    'booking_details_updated',
    'system',
    'Booking details updated',
    'Booking details updated',
    '{{counterpartyName}} updated details for {{detailsPhrase}}.',
    'both',
    TRUE
  ),
  (
    'new_review',
    'system',
    'New review',
    'New {{satisfactionLabel}} Review',
    '{{consumerName}} left you a {{satisfactionLabel}} review{{commentSuffix}}',
    'operator',
    TRUE
  )
ON CONFLICT (key) DO NOTHING;
