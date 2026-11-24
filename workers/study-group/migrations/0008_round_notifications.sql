-- Round emails: members are told when the owner opens a vote, when a topic is picked (a closed vote or a draw) and
-- when a vote closes without a topic. The outbox row holds only the group name and the round ID; the mailer reads the
-- round and the picked material's title at send time.

-- SQLite can't change a CHECK constraint in place, so the outbox is rebuilt with the new round kinds.
-- Nothing references this table, and every row and index is carried over.
CREATE TABLE notifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('join_request', 'join_approved', 'join_rejected', 'group_deleted', 'icon_removed', 'account_banned', 'account_restored', 'meeting_reminder', 'round_started', 'round_picked', 'round_cancelled')),
  group_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  send_after TEXT NOT NULL,
  claimed_at TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

INSERT INTO notifications_new (id, user_id, kind, group_id, payload, dedupe_key, status, attempts, send_after, claimed_at, provider_message_id, created_at, sent_at)
SELECT id, user_id, kind, group_id, payload, dedupe_key, status, attempts, send_after, claimed_at, provider_message_id, created_at, sent_at
FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX notifications_status_created ON notifications (status, created_at);
CREATE INDEX notifications_user_sent ON notifications (user_id, sent_at);
CREATE INDEX notifications_group_kind ON notifications (group_id, kind, send_after);
CREATE INDEX notifications_created_at ON notifications (created_at);
