-- No soft delete: deleting a group or a suggestion now removes its rows in the same request. This migration removes
-- the rows that earlier versions only marked as deleted, with everything that depends on them, child-first so the
-- result doesn't depend on the foreign key pragma.
-- The deleted_at and deleted_by_admin columns stay (always NULL and 0 from now on): dropping them in SQLite means
-- dropping and recreating the indexes that use them, or rebuilding the tables, which is riskier on D1 than leaving
-- two unused columns.

-- Owner notices about admin deletions can no longer join the (deleted) group row, so each log entry keeps the owner.
ALTER TABLE moderation_actions ADD COLUMN owner_id TEXT REFERENCES users (id) ON DELETE SET NULL;
UPDATE moderation_actions SET owner_id = (SELECT g.owner_id FROM groups g WHERE g.id = moderation_actions.group_id)
WHERE group_id IS NOT NULL;
CREATE INDEX moderation_actions_owner_id ON moderation_actions (owner_id, created_at);

DELETE FROM votes
WHERE material_id IN (SELECT id FROM materials WHERE deleted_at IS NOT NULL)
   OR group_id IN (SELECT id FROM groups WHERE deleted_at IS NOT NULL);
UPDATE rounds SET winner_material_id = NULL
WHERE winner_material_id IN (SELECT id FROM materials WHERE deleted_at IS NOT NULL);
DELETE FROM rounds WHERE group_id IN (SELECT id FROM groups WHERE deleted_at IS NOT NULL);
DELETE FROM materials
WHERE deleted_at IS NOT NULL OR group_id IN (SELECT id FROM groups WHERE deleted_at IS NOT NULL);
DELETE FROM join_requests WHERE group_id IN (SELECT id FROM groups WHERE deleted_at IS NOT NULL);
DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE deleted_at IS NOT NULL);
DELETE FROM groups WHERE deleted_at IS NOT NULL;
