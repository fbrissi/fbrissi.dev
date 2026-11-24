-- Study group email notifications: a single email on/off preference per user and an outbox of service emails.
-- The outbox row is written in the same batch as the state change that triggers it; the mailer Worker reads it from
-- the queue (the queue carries only the row ID), claims it ('sending'), reads the recipient's email at send time and
-- records the result. Rows are purged 30 days after they were created (daily cron).

-- No row means the default: service emails on.
CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  email_enabled INTEGER NOT NULL DEFAULT 1 CHECK (email_enabled IN (0, 1)),
  updated_at TEXT NOT NULL
);

-- user_id is the recipient; the cascade means no email after the account is deleted. group_id has no foreign key, so
-- the row outlives a purged group. payload holds only render data (group name, admin reason), never an email address.
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('join_request', 'join_approved', 'join_rejected', 'group_deleted', 'icon_removed', 'account_banned', 'account_restored')),
  group_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  -- Not sent before this time: the trailing owner digest waits for the end of its 6-hour window.
  send_after TEXT NOT NULL,
  -- Last claim by the mailer; a 'sending' row with an old claim is taken over (the mailer stopped mid-send).
  claimed_at TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX notifications_status_created ON notifications (status, created_at);
CREATE INDEX notifications_user_sent ON notifications (user_id, sent_at);
-- Coalesces the owner's join request digest (at most one per group every 6 hours).
CREATE INDEX notifications_group_kind ON notifications (group_id, kind, send_after);
CREATE INDEX notifications_created_at ON notifications (created_at);
-- The 7-day cooldown after a rejected join request.
CREATE INDEX join_requests_user_group_decided ON join_requests (user_id, group_id, status, decided_at);
