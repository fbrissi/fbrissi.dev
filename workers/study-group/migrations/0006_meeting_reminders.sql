-- Meeting reminders: an hourly cron writes one outbox row per member the day before (24 hours) and on the day
-- (2 hours) before each meeting, unless the owner turned them off for the group.

ALTER TABLE groups ADD COLUMN meeting_reminders INTEGER NOT NULL DEFAULT 1 CHECK (meeting_reminders IN (0, 1));

-- The meeting day becomes a weekday chosen from a list. Free-text days that name one weekday ("monday", "Mondays")
-- are normalized; anything else is kept as is and gets no reminders until the owner picks a day.
UPDATE groups SET meeting_day = CASE lower(trim(meeting_day))
    WHEN 'monday' THEN 'Monday' WHEN 'mondays' THEN 'Monday'
    WHEN 'tuesday' THEN 'Tuesday' WHEN 'tuesdays' THEN 'Tuesday'
    WHEN 'wednesday' THEN 'Wednesday' WHEN 'wednesdays' THEN 'Wednesday'
    WHEN 'thursday' THEN 'Thursday' WHEN 'thursdays' THEN 'Thursday'
    WHEN 'friday' THEN 'Friday' WHEN 'fridays' THEN 'Friday'
    WHEN 'saturday' THEN 'Saturday' WHEN 'saturdays' THEN 'Saturday'
    WHEN 'sunday' THEN 'Sunday' WHEN 'sundays' THEN 'Sunday'
    ELSE meeting_day END;

-- SQLite can't change a CHECK constraint in place, so the outbox is rebuilt with the new 'meeting_reminder' kind.
-- Nothing references this table, and every row and index is carried over.
CREATE TABLE notifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('join_request', 'join_approved', 'join_rejected', 'group_deleted', 'icon_removed', 'account_banned', 'account_restored', 'meeting_reminder')),
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
