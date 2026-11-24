-- Study groups program: Google accounts, sessions, consents, many groups with members and join requests,
-- and the moderation audit log. The single DevTalk board becomes the `devtalk` group (D11, Q20).
-- SQLite can't add constraints in place, so materials, rounds and votes are rebuilt with a group_id and copied.
-- The old tables are dropped child-first so that no ON DELETE action touches the copied rows.
PRAGMA defer_foreign_keys = true;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Only the SHA-256 hash of the session token is stored; sessions expire 30 days after sign-in (Q11).
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_user_id ON sessions (user_id);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

CREATE TABLE consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  document TEXT NOT NULL CHECK (document IN ('terms', 'privacy')),
  version TEXT NOT NULL,
  accepted_at TEXT NOT NULL
);

CREATE INDEX consents_user_document ON consents (user_id, document, version);

-- owner_id is NULL only for the migrated DevTalk group until an allowlisted platform admin claims it.
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  rules TEXT NOT NULL DEFAULT '[]',
  meeting_day TEXT NOT NULL,
  meeting_start TEXT NOT NULL,
  meeting_end TEXT NOT NULL,
  timezone TEXT NOT NULL,
  meeting_url TEXT,
  access_code TEXT NOT NULL,
  moderation_mode TEXT NOT NULL DEFAULT 'free' CHECK (moderation_mode IN ('free', 'review')),
  listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX groups_active ON groups (deleted_at, listed, created_at, id);
CREATE INDEX groups_owner_id ON groups (owner_id, deleted_at);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_id ON group_members (user_id);

CREATE TABLE join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);

CREATE UNIQUE INDEX join_requests_single_pending ON join_requests (group_id, user_id) WHERE status = 'pending';
CREATE INDEX join_requests_group_status ON join_requests (group_id, status, created_at);
CREATE INDEX join_requests_user_status ON join_requests (user_id, status);

-- Audit log of platform admin deletions and restores. It keeps a short label and the reason, never the content body,
-- and has no foreign key to groups so entries outlive the purged group (12 months, Q6).
CREATE TABLE moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  group_id TEXT,
  label TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX moderation_actions_group_id ON moderation_actions (group_id, created_at);
CREATE INDEX moderation_actions_created_at ON moderation_actions (created_at);

-- DevTalk keeps its profile and access code; its description becomes the public summary.
INSERT INTO groups (id, owner_id, name, summary, rules, meeting_day, meeting_start, meeting_end, timezone, meeting_url, access_code, moderation_mode, listed, created_at, updated_at)
SELECT
  'devtalk',
  NULL,
  name,
  substr(description, 1, 280),
  rules,
  meeting_day,
  meeting_start,
  meeting_end,
  timezone,
  NULLIF(meeting_url, ''),
  COALESCE(NULLIF(access_code, ''), lower(hex(randomblob(8)))),
  'free',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM group_info
WHERE id = 1;

-- The runbook closes open rounds before deploying; any round still open is cancelled here.
UPDATE rounds SET status = 'closed', closed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE status = 'open';

CREATE TABLE materials_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  suggested_by TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video', 'article', 'book', 'podcast', 'other')),
  title TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('pending', 'open', 'discussed')),
  created_at TEXT NOT NULL,
  discussed_at TEXT,
  deleted_at TEXT,
  deleted_by_admin INTEGER NOT NULL DEFAULT 0 CHECK (deleted_by_admin IN (0, 1))
);

-- Legacy suggestions keep the typed name as text with no linked user (Q20).
INSERT INTO materials_v2 (id, group_id, user_id, suggested_by, type, title, url, notes, status, created_at, discussed_at, deleted_at)
SELECT id, 'devtalk', NULL, suggested_by, type, title, url, notes, status, created_at, discussed_at, deleted_at FROM materials;

CREATE TABLE rounds_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('draw', 'vote')),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL,
  closed_at TEXT,
  winner_material_id INTEGER REFERENCES materials_v2 (id) ON DELETE SET NULL
);

INSERT INTO rounds_v2 (id, group_id, mode, status, created_at, closed_at, winner_material_id)
SELECT id, 'devtalk', mode, status, created_at, closed_at, winner_material_id FROM rounds;

CREATE TABLE votes_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  round_id INTEGER NOT NULL REFERENCES rounds_v2 (id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials_v2 (id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  voter_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (round_id, user_id)
);

INSERT INTO votes_v2 (id, group_id, round_id, material_id, user_id, voter_name, created_at)
SELECT id, 'devtalk', round_id, material_id, NULL, voter_name, created_at FROM votes;

DROP TABLE votes;
DROP TABLE rounds;
DROP TABLE materials;
DROP TABLE group_info;

ALTER TABLE materials_v2 RENAME TO materials;
ALTER TABLE rounds_v2 RENAME TO rounds;
ALTER TABLE votes_v2 RENAME TO votes;

CREATE INDEX materials_group_status ON materials (group_id, deleted_at, status, created_at);
CREATE INDEX materials_user_group ON materials (user_id, group_id, created_at);
CREATE INDEX materials_deleted_at ON materials (deleted_at);
-- A URL may be suggested again in a group only after the previous suggestion was discussed or deleted.
CREATE UNIQUE INDEX materials_open_url ON materials (group_id, url) WHERE status IN ('pending', 'open') AND url IS NOT NULL AND deleted_at IS NULL;

-- At most one open round per group.
CREATE UNIQUE INDEX rounds_single_open ON rounds (group_id) WHERE status = 'open';
CREATE INDEX rounds_group_id ON rounds (group_id, id);

CREATE INDEX votes_material_id ON votes (material_id);
CREATE INDEX votes_user_id ON votes (user_id);
