-- Group icons and account bans.

-- One icon per group, stored in the private R2 bucket under icon_key; the row is the only reference to the object.
ALTER TABLE groups ADD COLUMN icon_key TEXT;
ALTER TABLE groups ADD COLUMN icon_content_type TEXT;
ALTER TABLE groups ADD COLUMN icon_updated_at TEXT;

-- Upload counters for the per-user and per-group daily caps; the daily cron deletes rows older than a day.
CREATE TABLE icon_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX icon_uploads_user ON icon_uploads (user_id, created_at);
CREATE INDEX icon_uploads_group ON icon_uploads (group_id, created_at);

-- An active ban. The Google account ID and email are kept so the same person can't sign up again while banned;
-- unbanning deletes the row, and the daily cron deletes it at expires_at (2 years after the ban or its last renewal).
-- Bans, renewals and unbans are also written to the moderation log (12 months).
CREATE TABLE bans (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX bans_email ON bans (email);
CREATE INDEX bans_expires_at ON bans (expires_at);
