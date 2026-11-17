import {
  POLICY_VERSIONS,
  type AccountExport,
  type AdminGroup,
  type CreateMaterialInput,
  type DeletedMaterial,
  type GroupCard,
  type GroupInfo,
  type GroupProfileInput,
  type GroupSettings,
  type JoinRequest,
  type Material,
  type MaterialStatus,
  type MaterialType,
  type Member,
  type ModerationAction,
  type ModerationMode,
  type ModerationNotice,
  type MyGroup,
  type PendingGroupRequest,
  type Round,
  type RoundMode,
  type RoundStatus,
  type TallyEntry,
} from './contract';

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
}

export const FORMER_MEMBER = 'Former member';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  consented: boolean;
}

export interface GroupRecord extends GroupSettings {
  ownerId: string | null;
}

interface GroupRow {
  id: string;
  owner_id: string | null;
  name: string;
  summary: string;
  rules: string;
  meeting_day: string;
  meeting_start: string;
  meeting_end: string;
  timezone: string;
  meeting_url: string | null;
  access_code: string;
  moderation_mode: ModerationMode;
  listed: number;
  created_at: string;
}

interface MaterialRow {
  id: number;
  user_id: string | null;
  suggested_by_name: string;
  type: MaterialType;
  title: string;
  url: string | null;
  notes: string | null;
  status: MaterialStatus;
  created_at: string;
  discussed_at: string | null;
  deleted_at: string | null;
  deleted_by_admin: number;
}

interface RoundRow {
  id: number;
  mode: RoundMode;
  status: RoundStatus;
  created_at: string;
  closed_at: string | null;
  winner_material_id: number | null;
}

interface NoticeRow {
  id: number;
  action: string;
  group_id: string | null;
  label: string;
  reason: string;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface NewModerationAction {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  groupId: string | null;
  label: string;
  reason: string;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

const materialSelect = `SELECT m.*, COALESCE(u.display_name, m.suggested_by) AS suggested_by_name
  FROM materials m LEFT JOIN users u ON u.id = m.user_id`;

/** Keyset cursor over (created_at, id), newest first. */
function encodeCursor(createdAt: string, id: string): string {
  return btoa(JSON.stringify([createdAt, id]));
}

export function decodeCursor(cursor: string | null): [string, string] | null {
  if (!cursor) return null;
  try {
    const value: unknown = JSON.parse(atob(cursor));
    if (Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'string')) return value as [string, string];
  } catch {
    // Falls through to null.
  }
  return null;
}

function page<T>(rows: T[], limit: number, cursorOf: (row: T) => string): Page<T> {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? cursorOf(items[items.length - 1]) : null };
}

export function createRepository(db: D1Like) {
  const one = <T>(query: string, ...values: unknown[]) => db.prepare(query).bind(...values).first<T>();
  const many = async <T>(query: string, ...values: unknown[]) => (await db.prepare(query).bind(...values).all<T>()).results;
  const run = (query: string, ...values: unknown[]) => db.prepare(query).bind(...values).run();
  const statement = (query: string, ...values: unknown[]) => db.prepare(query).bind(...values);
  const consentStatements = (userId: string, now: string) => (Object.keys(POLICY_VERSIONS) as (keyof typeof POLICY_VERSIONS)[]).map((document) =>
    statement('INSERT INTO consents (user_id, document, version, accepted_at) VALUES (?, ?, ?, ?)', userId, document, POLICY_VERSIONS[document], now));

  const getMaterial = async (groupId: string, id: number, viewerId: string): Promise<Material | null> => {
    const row = await one<MaterialRow>(`${materialSelect} WHERE m.group_id = ? AND m.id = ? AND m.deleted_at IS NULL`, groupId, id);
    return row ? toMaterial(row, viewerId) : null;
  };

  return {
    // Accounts and sessions

    async findUserIdBySub(sub: string): Promise<string | null> {
      return (await one<{ id: string }>('SELECT id FROM users WHERE google_sub = ?', sub))?.id ?? null;
    },

    async createUser(user: { id: string; sub: string; email: string; displayName: string }, now: string): Promise<void> {
      await db.batch([
        statement('INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, user.sub, user.email, user.displayName, now, now),
        ...consentStatements(user.id, now),
      ]);
    },

    async updateUserEmail(id: string, email: string, now: string): Promise<void> {
      await run('UPDATE users SET email = ?, updated_at = ? WHERE id = ?', email, now, id);
    },

    async recordConsents(userId: string, now: string): Promise<void> {
      await db.batch(consentStatements(userId, now));
    },

    async updateDisplayName(userId: string, displayName: string, now: string): Promise<void> {
      await run('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?', displayName, now, userId);
    },

    async createSession(tokenHash: string, userId: string, now: string, expiresAt: string): Promise<void> {
      await run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', tokenHash, userId, now, expiresAt);
    },

    /** The single-row lookup run on every authenticated request. */
    async getSessionUser(tokenHash: string, now: string): Promise<SessionUser | null> {
      const row = await one<{ id: string; email: string; display_name: string; consented: number }>(
        `SELECT u.id, u.email, u.display_name,
           (SELECT COUNT(DISTINCT c.document) FROM consents c WHERE c.user_id = u.id
              AND ((c.document = 'terms' AND c.version = ?) OR (c.document = 'privacy' AND c.version = ?))) = 2 AS consented
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
        POLICY_VERSIONS.terms, POLICY_VERSIONS.privacy, tokenHash, now
      );
      return row ? { id: row.id, email: row.email, displayName: row.display_name, consented: row.consented === 1 } : null;
    },

    async deleteSession(tokenHash: string): Promise<void> {
      await run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    },

    /** The migrated DevTalk group has no owner until an allowlisted admin signs in (Q20). */
    async claimUnownedGroups(userId: string, now: string): Promise<void> {
      await run('UPDATE groups SET owner_id = ?, updated_at = ? WHERE owner_id IS NULL AND deleted_at IS NULL', userId, now);
    },

    /**
     * Deletes the account (Q7, Q8): owned groups are deleted, contributions elsewhere are kept as "Former member",
     * and sessions, consents, memberships and join requests go with the user row.
     */
    async deleteAccount(userId: string, now: string): Promise<void> {
      await db.batch([
        statement('UPDATE groups SET deleted_at = ?, updated_at = ? WHERE owner_id = ? AND deleted_at IS NULL', now, now, userId),
        statement('UPDATE materials SET suggested_by = ? WHERE user_id = ?', FORMER_MEMBER, userId),
        statement('UPDATE votes SET voter_name = ? WHERE user_id = ?', FORMER_MEMBER, userId),
        statement('DELETE FROM users WHERE id = ?', userId),
      ]);
    },

    async exportAccount(userId: string, now: string): Promise<AccountExport> {
      const profile = await one<{ id: string; email: string; display_name: string; created_at: string }>(
        'SELECT id, email, display_name, created_at FROM users WHERE id = ?', userId);
      const [consents, ownedGroups, memberships, joinRequests, suggestions, votes] = await Promise.all([
        many<{ document: string; version: string; accepted_at: string }>('SELECT document, version, accepted_at FROM consents WHERE user_id = ? ORDER BY id', userId),
        many<GroupCard>('SELECT id, name, summary FROM groups WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at', userId),
        many<{ group_id: string; name: string; joined_at: string }>(
          'SELECT gm.group_id, g.name, gm.joined_at FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ? ORDER BY gm.joined_at', userId),
        many<{ group_id: string; name: string; status: string; message: string | null; created_at: string; decided_at: string | null }>(
          'SELECT jr.group_id, g.name, jr.status, jr.message, jr.created_at, jr.decided_at FROM join_requests jr JOIN groups g ON g.id = jr.group_id WHERE jr.user_id = ? ORDER BY jr.id', userId),
        many<{ group_id: string; title: string; type: string; url: string | null; notes: string | null; status: string; created_at: string }>(
          'SELECT group_id, title, type, url, notes, status, created_at FROM materials WHERE user_id = ? AND deleted_at IS NULL ORDER BY id', userId),
        many<{ group_id: string; round_id: number; material_id: number; created_at: string }>(
          'SELECT group_id, round_id, material_id, created_at FROM votes WHERE user_id = ? ORDER BY id', userId),
      ]);
      return {
        exportedAt: now,
        profile: { id: profile!.id, email: profile!.email, displayName: profile!.display_name, createdAt: profile!.created_at },
        consents: consents.map((row) => ({ document: row.document, version: row.version, acceptedAt: row.accepted_at })),
        ownedGroups: ownedGroups.map((row) => ({ id: row.id, name: row.name, summary: row.summary })),
        memberships: memberships.map((row) => ({ groupId: row.group_id, groupName: row.name, joinedAt: row.joined_at })),
        joinRequests: joinRequests.map((row) => ({ groupId: row.group_id, groupName: row.name, status: row.status, message: row.message, createdAt: row.created_at, decidedAt: row.decided_at })),
        suggestions: suggestions.map((row) => ({ groupId: row.group_id, title: row.title, type: row.type, url: row.url, notes: row.notes, status: row.status, createdAt: row.created_at })),
        votes: votes.map((row) => ({ groupId: row.group_id, roundId: row.round_id, materialId: row.material_id, createdAt: row.created_at })),
      };
    },

    // Groups

    async listPublicGroups(cursor: [string, string] | null, limit: number): Promise<Page<GroupCard>> {
      const rows = await many<GroupRow>(
        `SELECT * FROM groups WHERE deleted_at IS NULL AND listed = 1
           AND (? IS NULL OR created_at < ? OR (created_at = ? AND id < ?))
         ORDER BY created_at DESC, id DESC LIMIT ?`,
        cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1
      );
      const result = page(rows, limit, (row) => encodeCursor(row.created_at, row.id));
      return { items: result.items.map(toGroupCard), nextCursor: result.nextCursor };
    },

    async listAllGroups(cursor: [string, string] | null, limit: number): Promise<Page<AdminGroup>> {
      const rows = await many<GroupRow & { owner_name: string | null; member_count: number }>(
        `SELECT g.*, u.display_name AS owner_name, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
         FROM groups g LEFT JOIN users u ON u.id = g.owner_id
         WHERE g.deleted_at IS NULL AND (? IS NULL OR g.created_at < ? OR (g.created_at = ? AND g.id < ?))
         ORDER BY g.created_at DESC, g.id DESC LIMIT ?`,
        cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1
      );
      const result = page(rows, limit, (row) => encodeCursor(row.created_at, row.id));
      return {
        items: result.items.map((row) => ({
          ...toGroupCard(row),
          ownerName: row.owner_name,
          listed: row.listed === 1,
          memberCount: row.member_count,
          createdAt: row.created_at,
        })),
        nextCursor: result.nextCursor,
      };
    },

    async getGroup(id: string): Promise<GroupRecord | null> {
      const row = await one<GroupRow>('SELECT * FROM groups WHERE id = ? AND deleted_at IS NULL', id);
      return row ? { ...toGroupSettings(row), ownerId: row.owner_id } : null;
    },

    async countOwnedGroups(userId: string): Promise<number> {
      return (await one<{ count: number }>('SELECT COUNT(*) AS count FROM groups WHERE owner_id = ? AND deleted_at IS NULL', userId))!.count;
    },

    async createGroup(group: { id: string; ownerId: string; accessCode: string } & GroupProfileInput, now: string): Promise<GroupSettings> {
      const row = await one<GroupRow>(
        `INSERT INTO groups (id, owner_id, name, summary, rules, meeting_day, meeting_start, meeting_end, timezone, meeting_url, access_code, moderation_mode, listed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        group.id, group.ownerId, group.name, group.summary, JSON.stringify(group.rules), group.meetingDay, group.meetingStart, group.meetingEnd,
        group.timezone, group.meetingUrl, group.accessCode, group.moderationMode, group.listed ? 1 : 0, now, now
      );
      return toGroupSettings(row!);
    },

    async updateGroup(id: string, input: GroupProfileInput, now: string): Promise<GroupSettings> {
      const row = await one<GroupRow>(
        `UPDATE groups SET name = ?, summary = ?, rules = ?, meeting_day = ?, meeting_start = ?, meeting_end = ?, timezone = ?,
           meeting_url = ?, moderation_mode = ?, listed = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL RETURNING *`,
        input.name, input.summary, JSON.stringify(input.rules), input.meetingDay, input.meetingStart, input.meetingEnd, input.timezone,
        input.meetingUrl, input.moderationMode, input.listed ? 1 : 0, now, id
      );
      return toGroupSettings(row!);
    },

    async rotateAccessCode(id: string, accessCode: string, now: string): Promise<GroupSettings> {
      const row = await one<GroupRow>('UPDATE groups SET access_code = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL RETURNING *', accessCode, now, id);
      return toGroupSettings(row!);
    },

    async deleteGroup(id: string, now: string, log?: NewModerationAction): Promise<void> {
      await db.batch([
        statement('UPDATE groups SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', now, now, id),
        ...(log ? [logStatement(log, now)] : []),
      ]);
    },

    async listMyGroups(userId: string): Promise<MyGroup[]> {
      const rows = await many<GroupRow & { role: 'owner' | 'member' }>(
        `SELECT g.*, CASE WHEN g.owner_id = ? THEN 'owner' ELSE 'member' END AS role FROM groups g
         WHERE g.deleted_at IS NULL AND (g.owner_id = ? OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?))
         ORDER BY g.name COLLATE NOCASE, g.id`,
        userId, userId, userId
      );
      return rows.map((row) => ({ ...toGroupCard(row), role: row.role }));
    },

    async listMyPendingRequests(userId: string): Promise<PendingGroupRequest[]> {
      const rows = await many<GroupRow & { requested_at: string }>(
        `SELECT g.*, jr.created_at AS requested_at FROM join_requests jr JOIN groups g ON g.id = jr.group_id
         WHERE jr.user_id = ? AND jr.status = 'pending' AND g.deleted_at IS NULL ORDER BY jr.created_at DESC`,
        userId
      );
      return rows.map((row) => ({ ...toGroupCard(row), requestedAt: row.requested_at }));
    },

    /** Admin deletions in the groups a user owns, including groups the admin deleted (Q5). */
    async listOwnerNotices(userId: string, since: string): Promise<ModerationNotice[]> {
      const rows = await many<NoticeRow>(
        `SELECT ma.id, ma.action, ma.group_id, ma.label, ma.reason, ma.created_at FROM moderation_actions ma
         JOIN groups g ON g.id = ma.group_id
         WHERE g.owner_id = ? AND ma.created_at >= ? AND ma.action LIKE 'delete_%' ORDER BY ma.id DESC LIMIT 20`,
        userId, since
      );
      return rows.map(toNotice);
    },

    async listGroupNotices(groupId: string, since: string): Promise<ModerationNotice[]> {
      const rows = await many<NoticeRow>(
        `SELECT id, action, group_id, label, reason, created_at FROM moderation_actions
         WHERE group_id = ? AND created_at >= ? AND action LIKE 'delete_%' ORDER BY id DESC LIMIT 20`,
        groupId, since
      );
      return rows.map(toNotice);
    },

    // Membership

    async isMember(groupId: string, userId: string): Promise<boolean> {
      return Boolean(await one('SELECT 1 AS found FROM group_members WHERE group_id = ? AND user_id = ?', groupId, userId));
    },

    async hasPendingRequest(groupId: string, userId: string): Promise<boolean> {
      return Boolean(await one("SELECT 1 AS found FROM join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'", groupId, userId));
    },

    async listMembers(groupId: string): Promise<Member[]> {
      const rows = await many<{ user_id: string; display_name: string; role: 'owner' | 'member'; joined_at: string | null }>(
        `SELECT g.owner_id AS user_id, u.display_name, 'owner' AS role, NULL AS joined_at FROM groups g JOIN users u ON u.id = g.owner_id WHERE g.id = ?
         UNION ALL
         SELECT gm.user_id, u.display_name, 'member' AS role, gm.joined_at FROM group_members gm JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ? AND gm.user_id IS NOT (SELECT owner_id FROM groups WHERE id = ?)
         ORDER BY role DESC, display_name COLLATE NOCASE`,
        groupId, groupId, groupId
      );
      return rows.map((row) => ({ userId: row.user_id, displayName: row.display_name, role: row.role, joinedAt: row.joined_at }));
    },

    async countMembers(groupId: string): Promise<number> {
      return (await one<{ count: number }>('SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?', groupId))!.count;
    },

    async removeMember(groupId: string, userId: string): Promise<boolean> {
      const row = await one('DELETE FROM group_members WHERE group_id = ? AND user_id = ? RETURNING user_id', groupId, userId);
      return Boolean(row);
    },

    async countPendingRequestsByUser(userId: string): Promise<number> {
      return (await one<{ count: number }>("SELECT COUNT(*) AS count FROM join_requests WHERE user_id = ? AND status = 'pending'", userId))!.count;
    },

    async createJoinRequest(groupId: string, userId: string, message: string | null, now: string): Promise<void> {
      await run('INSERT INTO join_requests (group_id, user_id, message, status, created_at) VALUES (?, ?, ?, \'pending\', ?)', groupId, userId, message, now);
    },

    async listPendingRequests(groupId: string): Promise<JoinRequest[]> {
      const rows = await many<{ id: number; display_name: string; message: string | null; created_at: string }>(
        `SELECT jr.id, u.display_name, jr.message, jr.created_at FROM join_requests jr JOIN users u ON u.id = jr.user_id
         WHERE jr.group_id = ? AND jr.status = 'pending' ORDER BY jr.created_at, jr.id`,
        groupId
      );
      return rows.map((row) => ({ id: row.id, displayName: row.display_name, message: row.message, createdAt: row.created_at }));
    },

    async getPendingRequest(groupId: string, id: number): Promise<{ id: number; userId: string } | null> {
      const row = await one<{ id: number; user_id: string }>("SELECT id, user_id FROM join_requests WHERE group_id = ? AND id = ? AND status = 'pending'", groupId, id);
      return row ? { id: row.id, userId: row.user_id } : null;
    },

    async approveRequest(groupId: string, request: { id: number; userId: string }, now: string): Promise<void> {
      await db.batch([
        statement("UPDATE join_requests SET status = 'approved', decided_at = ? WHERE id = ? AND status = 'pending'", now, request.id),
        statement('INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)', groupId, request.userId, now),
      ]);
    },

    async rejectRequest(id: number, now: string): Promise<void> {
      await run("UPDATE join_requests SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'pending'", now, id);
    },

    async getRequestMessage(groupId: string, id: number): Promise<string | null | undefined> {
      const row = await one<{ message: string | null }>('SELECT message FROM join_requests WHERE group_id = ? AND id = ?', groupId, id);
      return row ? row.message : undefined;
    },

    async clearRequestMessage(id: number, log: NewModerationAction, now: string): Promise<void> {
      await db.batch([statement('UPDATE join_requests SET message = NULL WHERE id = ?', id), logStatement(log, now)]);
    },

    // Moderation log

    async listModerationLog(beforeId: number | null, limit: number): Promise<Page<ModerationAction>> {
      const rows = await many<NoticeRow & { actor_name: string | null; target_type: string; target_id: string }>(
        `SELECT ma.*, u.display_name AS actor_name FROM moderation_actions ma LEFT JOIN users u ON u.id = ma.actor_id
         WHERE (? IS NULL OR ma.id < ?) ORDER BY ma.id DESC LIMIT ?`,
        beforeId, beforeId, limit + 1
      );
      const result = page(rows, limit, (row) => String(row.id));
      return {
        items: result.items.map((row) => ({ ...toNotice(row), actorName: row.actor_name, targetType: row.target_type, targetId: row.target_id })),
        nextCursor: result.nextCursor,
      };
    },

    // Materials

    async listMaterials(groupId: string, viewerId: string, seeAllPending: boolean): Promise<Material[]> {
      const rows = await many<MaterialRow>(
        `${materialSelect} WHERE m.group_id = ? AND m.deleted_at IS NULL AND (m.status != 'pending' OR ? = 1 OR m.user_id = ?)
         ORDER BY m.created_at DESC, m.id DESC`,
        groupId, seeAllPending ? 1 : 0, viewerId
      );
      return rows.map((row) => toMaterial(row, viewerId));
    },

    async listDeletedMaterials(groupId: string, viewerId: string): Promise<DeletedMaterial[]> {
      const rows = await many<MaterialRow>(`${materialSelect} WHERE m.group_id = ? AND m.deleted_at IS NOT NULL ORDER BY m.deleted_at DESC, m.id DESC`, groupId);
      return rows.map((row) => ({ ...toMaterial(row, viewerId), deletedAt: row.deleted_at!, deletedByAdmin: row.deleted_by_admin === 1 }));
    },

    getMaterial,

    async getDeletedMaterial(groupId: string, id: number, viewerId: string): Promise<DeletedMaterial | null> {
      const row = await one<MaterialRow>(`${materialSelect} WHERE m.group_id = ? AND m.id = ? AND m.deleted_at IS NOT NULL`, groupId, id);
      return row ? { ...toMaterial(row, viewerId), deletedAt: row.deleted_at!, deletedByAdmin: row.deleted_by_admin === 1 } : null;
    },

    async countRecentSuggestions(groupId: string, userId: string, since: string): Promise<number> {
      return (await one<{ count: number }>('SELECT COUNT(*) AS count FROM materials WHERE group_id = ? AND user_id = ? AND created_at >= ?', groupId, userId, since))!.count;
    },

    async createMaterial(groupId: string, author: { id: string; displayName: string }, input: CreateMaterialInput, status: 'pending' | 'open', now: string): Promise<Material> {
      const row = await one<{ id: number }>(
        `INSERT INTO materials (group_id, user_id, suggested_by, type, title, url, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        groupId, author.id, author.displayName, input.type, input.title, input.url ?? null, input.notes || null, status, now
      );
      return (await getMaterial(groupId, row!.id, author.id))!;
    },

    async setMaterialStatus(groupId: string, id: number, status: MaterialStatus, now: string, viewerId: string): Promise<Material | null> {
      const row = await one<{ id: number }>(
        "UPDATE materials SET status = ?, discussed_at = ? WHERE group_id = ? AND id = ? AND deleted_at IS NULL AND status != 'pending' RETURNING id",
        status, status === 'discussed' ? now : null, groupId, id
      );
      return row ? getMaterial(groupId, row.id, viewerId) : null;
    },

    async approveMaterial(groupId: string, id: number, viewerId: string): Promise<Material | null> {
      const row = await one<{ id: number }>(
        "UPDATE materials SET status = 'open' WHERE group_id = ? AND id = ? AND deleted_at IS NULL AND status = 'pending' RETURNING id", groupId, id);
      return row ? getMaterial(groupId, row.id, viewerId) : null;
    },

    /** Soft-deletes a material and withdraws its votes from open rounds; closed rounds keep their history. */
    async deleteMaterial(groupId: string, id: number, now: string, log?: NewModerationAction): Promise<void> {
      await db.batch([
        statement("DELETE FROM votes WHERE material_id = ? AND round_id IN (SELECT id FROM rounds WHERE group_id = ? AND status = 'open')", id, groupId),
        statement('UPDATE materials SET deleted_at = ?, deleted_by_admin = ? WHERE group_id = ? AND id = ? AND deleted_at IS NULL', now, log ? 1 : 0, groupId, id),
        ...(log ? [logStatement(log, now)] : []),
      ]);
    },

    /** Restores a deleted material; restores by the platform admin are written to the audit log in the same batch. */
    async restoreMaterial(groupId: string, id: number, viewerId: string, log?: NewModerationAction, now?: string): Promise<Material | null> {
      const [restored] = await db.batch([
        statement('UPDATE materials SET deleted_at = NULL, deleted_by_admin = 0 WHERE group_id = ? AND id = ? AND deleted_at IS NOT NULL RETURNING id', groupId, id),
        ...(log ? [logStatement(log, now as string)] : []),
      ]) as { results: unknown[] }[];
      return restored.results.length ? getMaterial(groupId, id, viewerId) : null;
    },

    async listOpenMaterialIds(groupId: string, createdAtOrBefore?: string): Promise<number[]> {
      const rows = createdAtOrBefore === undefined
        ? await many<{ id: number }>("SELECT id FROM materials WHERE group_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY id", groupId)
        : await many<{ id: number }>("SELECT id FROM materials WHERE group_id = ? AND status = 'open' AND deleted_at IS NULL AND created_at <= ? ORDER BY id", groupId, createdAtOrBefore);
      return rows.map((row) => row.id);
    },

    // Rounds and votes

    async getRound(groupId: string, id: number): Promise<Round | null> {
      const row = await one<RoundRow>('SELECT * FROM rounds WHERE group_id = ? AND id = ?', groupId, id);
      return row ? toRound(row) : null;
    },

    async getCurrentRound(groupId: string): Promise<Round | null> {
      const row = await one<RoundRow>(
        "SELECT * FROM rounds WHERE group_id = ? ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC LIMIT 1", groupId);
      return row ? toRound(row) : null;
    },

    async createRound(groupId: string, mode: RoundMode, now: string, winnerMaterialId: number | null): Promise<Round> {
      const closed = mode === 'draw';
      const row = await one<RoundRow>(
        'INSERT INTO rounds (group_id, mode, status, created_at, closed_at, winner_material_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
        groupId, mode, closed ? 'closed' : 'open', now, closed ? now : null, winnerMaterialId
      );
      return toRound(row!);
    },

    async closeRound(groupId: string, id: number, now: string, winnerMaterialId: number | null): Promise<Round | null> {
      const row = await one<RoundRow>(
        "UPDATE rounds SET status = 'closed', closed_at = ?, winner_material_id = ? WHERE group_id = ? AND id = ? AND status = 'open' RETURNING *",
        now, winnerMaterialId, groupId, id
      );
      return row ? toRound(row) : null;
    },

    /** One vote per user per round; voting again moves the vote. */
    async castVote(groupId: string, roundId: number, materialId: number, voter: { id: string; displayName: string }, now: string): Promise<void> {
      await run(
        `INSERT INTO votes (group_id, round_id, material_id, user_id, voter_name, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (round_id, user_id) DO UPDATE SET material_id = excluded.material_id, voter_name = excluded.voter_name, created_at = excluded.created_at`,
        groupId, roundId, materialId, voter.id, voter.displayName, now
      );
    },

    async getTally(roundId: number): Promise<TallyEntry[]> {
      const rows = await many<{ material_id: number; voter_name: string }>(
        `SELECT v.material_id, COALESCE(u.display_name, v.voter_name) AS voter_name FROM votes v
         JOIN materials m ON m.id = v.material_id AND m.deleted_at IS NULL
         LEFT JOIN users u ON u.id = v.user_id
         WHERE v.round_id = ? ORDER BY v.created_at, v.id`,
        roundId
      );
      const tally = new Map<number, TallyEntry>();
      for (const row of rows) {
        const entry = tally.get(row.material_id) ?? { materialId: row.material_id, votes: 0, voters: [] };
        entry.votes += 1;
        entry.voters.push(row.voter_name);
        tally.set(row.material_id, entry);
      }
      return [...tally.values()].sort((a, b) => b.votes - a.votes || a.materialId - b.materialId);
    },

    async getMyVote(roundId: number, userId: string): Promise<number | null> {
      return (await one<{ material_id: number }>(
        'SELECT v.material_id FROM votes v JOIN materials m ON m.id = v.material_id AND m.deleted_at IS NULL WHERE v.round_id = ? AND v.user_id = ?', roundId, userId
      ))?.material_id ?? null;
    },

    // Retention (daily cron)

    /** Purges deleted groups and content after 30 days, the audit log after 12 months, and expired sessions (Q6, Q11). */
    async purgeExpired(now: Date): Promise<void> {
      const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
      await db.batch([
        statement('DELETE FROM groups WHERE deleted_at IS NOT NULL AND deleted_at < ?', daysAgo(30)),
        statement('DELETE FROM materials WHERE deleted_at IS NOT NULL AND deleted_at < ?', daysAgo(30)),
        statement("DELETE FROM join_requests WHERE status != 'pending' AND decided_at < ?", daysAgo(30)),
        statement('DELETE FROM moderation_actions WHERE created_at < ?', daysAgo(365)),
        statement('DELETE FROM sessions WHERE expires_at <= ?', now.toISOString()),
      ]);
    },
  };

  function logStatement(log: NewModerationAction, now: string): D1StatementLike {
    return statement(
      'INSERT INTO moderation_actions (actor_id, action, target_type, target_id, group_id, label, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      log.actorId, log.action, log.targetType, log.targetId, log.groupId, log.label, log.reason, now
    );
  }
}

export type StudyGroupRepository = ReturnType<typeof createRepository>;

function toGroupCard(row: GroupRow): GroupCard {
  return { id: row.id, name: row.name, summary: row.summary };
}

function toGroupInfo(row: GroupRow): GroupInfo {
  return {
    ...toGroupCard(row),
    rules: parseRules(row.rules),
    meetingDay: row.meeting_day,
    meetingStart: row.meeting_start,
    meetingEnd: row.meeting_end,
    timezone: row.timezone,
    meetingUrl: row.meeting_url || null,
    moderationMode: row.moderation_mode,
    listed: row.listed === 1,
  };
}

function toGroupSettings(row: GroupRow): GroupSettings {
  return { ...toGroupInfo(row), accessCode: row.access_code };
}

function parseRules(value: string): string[] {
  try {
    const rules: unknown = JSON.parse(value);
    return Array.isArray(rules) ? rules.filter((rule): rule is string => typeof rule === 'string') : [];
  } catch {
    return [];
  }
}

function toNotice(row: NoticeRow): ModerationNotice {
  return { id: row.id, action: row.action, groupId: row.group_id, label: row.label, reason: row.reason, createdAt: row.created_at };
}

function toMaterial(row: MaterialRow, viewerId: string): Material {
  return {
    id: row.id,
    suggestedBy: row.suggested_by_name,
    mine: row.user_id !== null && row.user_id === viewerId,
    type: row.type,
    title: row.title,
    url: row.url,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    discussedAt: row.discussed_at,
  };
}

function toRound(row: RoundRow): Round {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    winnerMaterialId: row.winner_material_id,
  };
}
