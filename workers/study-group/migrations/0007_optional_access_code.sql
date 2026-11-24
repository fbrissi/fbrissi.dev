-- The access code becomes optional per group. New groups are open by default (anyone signed in can ask to join, and
-- the owner still approves every request); groups created before this change keep requiring their code.
-- Every group keeps a stored code, so the owner can turn the requirement on at any time.

ALTER TABLE groups ADD COLUMN require_access_code INTEGER NOT NULL DEFAULT 0 CHECK (require_access_code IN (0, 1));

UPDATE groups SET require_access_code = 1;
