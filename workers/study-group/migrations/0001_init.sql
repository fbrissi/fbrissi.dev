-- Study group board: suggested materials, selection rounds, and votes.
CREATE TABLE materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggested_by TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video', 'article', 'book', 'podcast', 'other')),
  title TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'discussed')),
  created_at TEXT NOT NULL,
  discussed_at TEXT,
  deleted_at TEXT
);

CREATE INDEX materials_status_created_at ON materials (status, created_at);
-- A URL may be suggested again only after the previous suggestion was discussed or deleted.
CREATE UNIQUE INDEX materials_open_url ON materials (url) WHERE status = 'open' AND url IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL CHECK (mode IN ('draw', 'vote')),
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL,
  closed_at TEXT,
  winner_material_id INTEGER REFERENCES materials (id) ON DELETE SET NULL
);

-- At most one open round at a time.
CREATE UNIQUE INDEX rounds_single_open ON rounds (status) WHERE status = 'open';

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  voter_name_norm TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (round_id, voter_name_norm)
);

CREATE INDEX votes_material_id ON votes (material_id);

-- Single-row group profile. meeting_url and access_code are set through the admin settings page so they are
-- never committed; while access_code is NULL the board rejects every member request.
CREATE TABLE group_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rules TEXT NOT NULL DEFAULT '[]',
  meeting_day TEXT NOT NULL,
  meeting_start TEXT NOT NULL,
  meeting_end TEXT NOT NULL,
  timezone TEXT NOT NULL,
  meeting_url TEXT,
  access_code TEXT
);

INSERT INTO group_info (id, name, description, rules, meeting_day, meeting_start, meeting_end, timezone, meeting_url, access_code)
VALUES (
  1,
  'DevTalk',
  'This group gives us a chance to improve our English skills, share thoughts and ideas, and ask for help.',
  '["Don''t speak in Portuguese","Share your ideas, content, anything that you want","Feel free to ask for help just to practice 1:1 when you want","Do your best to practice in our meeting","Don''t be afraid to make mistakes; you won''t be judged."]',
  'Monday',
  '20:00',
  '21:00',
  'America/Sao_Paulo',
  NULL,
  NULL
);
