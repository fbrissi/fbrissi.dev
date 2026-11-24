import {
  MATERIAL_POLICY_VERSIONS,
  NOTIFICATION_LIMITS,
  POLICY_VERSIONS,
  type AccountExport,
  type AdminGroup,
  type AdminUser,
  type CreateMaterialInput,
  type GroupCard,
  type GroupInfo,
  type GroupProfileInput,
  type GroupSchedule,
  type GroupSettings,
  type JoinRequest,
  type Material,
  type MaterialStatus,
  type MaterialType,
  type Member,
  type MeetingReminderLead,
  type ModerationAction,
  type NotificationKind,
  type PolicyDocument,
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
  /** Documents whose current version the user hasn't accepted. */
  pendingConsents: PolicyDocument[];
}

export interface StoredIcon {
  key: string;
  contentType: string;
  updatedAt: string;
}

export interface GroupRecord extends GroupSettings {
  ownerId: string | null;
  /** Server-only: the R2 object behind `iconUrl`, which routes sign. */
  icon: StoredIcon | null;
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
  meeting_reminders: number;
  require_access_code: number;
  created_at: string;
  icon_key: string | null;
  icon_content_type: string | null;
  icon_updated_at: string | null;
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
  /** Owner of the group the action touched, who sees it as a notice even after the group is deleted. */
  ownerId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  groupId: string | null;
  label: string;
  reason: string;
}

/** A service email to write to the outbox in the same batch as the state change that causes it. */
export interface OutboxNotice {
  userId: string;
  kind: Exclude<NotificationKind, 'join_request'>;
  /** Null for a notice about the account rather than a group (ban, restore). */
  groupId: string | null;
  dedupeKey: string;
  payload: Record<string, string>;
  /** A notice about the account itself (ban, restore), sent even to users who turned service emails off. */
  ignoreOptOut?: boolean;
}

/** An outbox row to hand to the mailer, not before `sendAfter`. */
export interface QueuedNotification {
  id: number;
  sendAfter: string;
}

/** A group's weekly schedule, as the hourly reminder scan reads it. */
export interface ReminderGroup {
  id: string;
  meetingDay: string;
  meetingStart: string;
  timezone: string;
}

/** A reminder of one meeting of a group, to send to every recipient at `sendAfter`. */
export interface DueReminder {
  groupId: string;
  lead: MeetingReminderLead;
  meetingAt: string;
  sendAfter: string;
}

/** Digest rows that still count for coalescing: skipped or failed ones don't hold back the next digest. */
/**
 * A ban row still in force: bans lift exactly at expires_at, even before the daily purge deletes the row. The time is
 * the database's own clock, in the same ISO format the rows are written in.
 */
export const BAN_IN_FORCE = "b.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const ACTIVE_DIGEST = "kind = 'join_request' AND status IN ('pending', 'sending', 'sent')";

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

/** The outbox rows a batch inserted; a skipped, coalesced or duplicate notice returns none. */
function queued(results: unknown[]): QueuedNotification[] {
  return results.flatMap((result) => (result as { results: { id: number; send_after: string }[] }).results.map((row) => ({ id: row.id, sendAfter: row.send_after })));
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
  const consentStatements = (userId: string, now: string, documents = Object.keys(POLICY_VERSIONS) as PolicyDocument[]) => documents.map((document) =>
    statement('INSERT INTO consents (user_id, document, version, accepted_at) VALUES (?, ?, ?, ?)', userId, document, POLICY_VERSIONS[document], now));

  // Users who turned email off get no outbox row at all; the mailer checks the preference again at send time.
  const emailOn = 'NOT EXISTS (SELECT 1 FROM notification_preferences p WHERE p.user_id = u.id AND p.email_enabled = 0)';
  /** A banned user's content is hidden while the ban lasts (a visibility rule; nothing is deleted). */
  const notBanned = (column: string) => `NOT EXISTS (SELECT 1 FROM bans b WHERE b.user_id = ${column} AND ${BAN_IN_FORCE})`;
  const outboxStatement = (notice: OutboxNotice, now: string) => statement(
    `INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after)
     SELECT u.id, ?, ?, ?, ?, ?, ? FROM users u WHERE u.id = ? AND (? = 1 OR ${emailOn})
     ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, send_after`,
    notice.kind, notice.groupId, JSON.stringify(notice.payload), notice.dedupeKey, now, now, notice.userId, notice.ignoreOptOut ? 1 : 0
  );
  /**
   * The owner digest (E1): at most one per group every 6 hours. Without an active digest in the last 6 hours, one goes
   * out now; otherwise one trailing digest is scheduled for the end of that window, unless one is already scheduled.
   * The trailing statement runs first so a digest inserted now never schedules its own trailer.
   */
  const digestStatements = (groupId: string, ownerId: string, now: string, windowStart: string) => [
    statement(
      `INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after)
       SELECT u.id, 'join_request', ?, '{}', 'join_request:' || ? || ':' || w.at, ?, w.at
       FROM users u, (SELECT strftime('%Y-%m-%dT%H:%M:%fZ', MAX(send_after), '+${NOTIFICATION_LIMITS.joinDigestWindowHours} hours') AS at
                      FROM notifications WHERE group_id = ? AND ${ACTIVE_DIGEST} AND send_after > ? AND send_after <= ?) w
       WHERE u.id = ? AND w.at IS NOT NULL AND ${emailOn}
         AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.group_id = ? AND n.${ACTIVE_DIGEST} AND n.send_after > ?)
       ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, send_after`,
      groupId, groupId, now, groupId, windowStart, now, ownerId, groupId, now
    ),
    statement(
      `INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after)
       SELECT u.id, 'join_request', ?, '{}', 'join_request:' || ? || ':' || ?, ?, ? FROM users u
       WHERE u.id = ? AND ${emailOn}
         AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.group_id = ? AND n.${ACTIVE_DIGEST} AND n.send_after > ?)
       ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, send_after`,
      groupId, groupId, now, now, now, ownerId, groupId, windowStart
    ),
  ];
  const withNotices = async (statements: D1StatementLike[], notices: D1StatementLike[]): Promise<QueuedNotification[]> =>
    queued((await db.batch([...statements, ...notices])).slice(statements.length));

  const getMaterial = async (groupId: string, id: number, viewerId: string): Promise<Material | null> => {
    const row = await one<MaterialRow>(`${materialSelect} WHERE m.group_id = ? AND m.id = ?`, groupId, id);
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

    async recordConsents(userId: string, now: string, documents: PolicyDocument[]): Promise<void> {
      await db.batch(consentStatements(userId, now, documents));
    },

    async updateDisplayName(userId: string, displayName: string, now: string): Promise<void> {
      await run('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?', displayName, now, userId);
    },

    async createSession(tokenHash: string, userId: string, now: string, expiresAt: string): Promise<void> {
      await run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', tokenHash, userId, now, expiresAt);
    },

    /** The single-row lookup run on every authenticated request. Versions are ISO dates, so they compare as text. */
    async getSessionUser(tokenHash: string, now: string): Promise<SessionUser | null> {
      const row = await one<{ id: string; email: string; display_name: string; terms: number; privacy: number }>(
        `SELECT u.id, u.email, u.display_name,
           EXISTS (SELECT 1 FROM consents c WHERE c.user_id = u.id AND c.document = 'terms' AND c.version >= ?) AS terms,
           EXISTS (SELECT 1 FROM consents c WHERE c.user_id = u.id AND c.document = 'privacy' AND c.version >= ?) AS privacy
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND ${notBanned('u.id')}`,
        MATERIAL_POLICY_VERSIONS.terms, MATERIAL_POLICY_VERSIONS.privacy, tokenHash, now
      );
      if (!row) return null;
      const pendingConsents = (['terms', 'privacy'] as const).filter((document) => row[document] !== 1);
      return { id: row.id, email: row.email, displayName: row.display_name, consented: pendingConsents.length === 0, pendingConsents };
    },

    async deleteSession(tokenHash: string): Promise<void> {
      await run('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    },

    /**
     * The migrated DevTalk group has no owner until an allowlisted admin signs in (Q20). Requests that waited for an
     * owner get one digest to the new owner (E1), written before the claim in the same batch.
     */
    async claimUnownedGroups(userId: string, now: string): Promise<QueuedNotification[]> {
      const [digests] = await db.batch([
        statement(
          `INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after)
           SELECT u.id, 'join_request', g.id, '{}', 'join_request:' || g.id || ':' || ?, ?, ? FROM groups g, users u
           WHERE u.id = ? AND g.owner_id IS NULL AND ${emailOn}
             AND EXISTS (SELECT 1 FROM join_requests jr WHERE jr.group_id = g.id AND jr.status = 'pending')
           ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, send_after`,
          now, now, now, userId
        ),
        statement('UPDATE groups SET owner_id = ?, updated_at = ? WHERE owner_id IS NULL', userId, now),
      ]);
      return queued([digests]);
    },

    /**
     * Deletes the account (Q7, Q8): owned groups are deleted permanently with everything in them, contributions
     * elsewhere are kept as "Former member", and sessions, consents, memberships and join requests go with the user
     * row. Returns the icon keys of the deleted groups, for the R2 cleanup.
     */
    async deleteAccount(userId: string): Promise<string[]> {
      const [groups] = await db.batch([
        statement('DELETE FROM groups WHERE owner_id = ? RETURNING icon_key', userId),
        statement('UPDATE materials SET suggested_by = ? WHERE user_id = ?', FORMER_MEMBER, userId),
        statement('UPDATE votes SET voter_name = ? WHERE user_id = ?', FORMER_MEMBER, userId),
        statement('DELETE FROM users WHERE id = ?', userId),
      ]);
      return iconKeys(groups);
    },

    /** The account data, with each owned group's icon as an R2 key that the export route reads. */
    async exportAccount(userId: string, now: string): Promise<Omit<AccountExport, 'ownedGroups'> & { ownedGroups: (GroupCard & { icon: StoredIcon | null })[] }> {
      const profile = await one<{ id: string; email: string; display_name: string; created_at: string }>(
        'SELECT id, email, display_name, created_at FROM users WHERE id = ?', userId);
      const [consents, ownedGroups, memberships, joinRequests, suggestions, votes, preference, emails] = await Promise.all([
        many<{ document: string; version: string; accepted_at: string }>('SELECT document, version, accepted_at FROM consents WHERE user_id = ? ORDER BY id', userId),
        many<GroupCard & { icon_key: string | null; icon_content_type: string | null; icon_updated_at: string | null }>(
          'SELECT id, name, summary, icon_key, icon_content_type, icon_updated_at FROM groups WHERE owner_id = ? ORDER BY created_at', userId),
        many<{ group_id: string; name: string; joined_at: string }>(
          'SELECT gm.group_id, g.name, gm.joined_at FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ? ORDER BY gm.joined_at', userId),
        many<{ group_id: string; name: string; status: string; message: string | null; created_at: string; decided_at: string | null }>(
          'SELECT jr.group_id, g.name, jr.status, jr.message, jr.created_at, jr.decided_at FROM join_requests jr JOIN groups g ON g.id = jr.group_id WHERE jr.user_id = ? ORDER BY jr.id', userId),
        many<{ group_id: string; title: string; type: string; url: string | null; notes: string | null; status: string; created_at: string }>(
          'SELECT group_id, title, type, url, notes, status, created_at FROM materials WHERE user_id = ? ORDER BY id', userId),
        many<{ group_id: string; round_id: number; material_id: number; created_at: string }>(
          'SELECT group_id, round_id, material_id, created_at FROM votes WHERE user_id = ? ORDER BY id', userId),
        one<{ email_enabled: number }>('SELECT email_enabled FROM notification_preferences WHERE user_id = ?', userId),
        many<{ kind: string; group_id: string | null; group_name: string | null; reason: string | null; status: string; created_at: string; sent_at: string | null }>(
          `SELECT n.kind, n.group_id, COALESCE(json_extract(n.payload, '$.groupName'), g.name) AS group_name, json_extract(n.payload, '$.reason') AS reason,
             n.status, n.created_at, n.sent_at
           FROM notifications n LEFT JOIN groups g ON g.id = n.group_id WHERE n.user_id = ? ORDER BY n.id`, userId),
      ]);
      return {
        exportedAt: now,
        profile: { id: profile!.id, email: profile!.email, displayName: profile!.display_name, createdAt: profile!.created_at },
        consents: consents.map((row) => ({ document: row.document, version: row.version, acceptedAt: row.accepted_at })),
        ownedGroups: ownedGroups.map((row) => ({ id: row.id, name: row.name, summary: row.summary, icon: storedIcon(row) })),
        memberships: memberships.map((row) => ({ groupId: row.group_id, groupName: row.name, joinedAt: row.joined_at })),
        joinRequests: joinRequests.map((row) => ({ groupId: row.group_id, groupName: row.name, status: row.status, message: row.message, createdAt: row.created_at, decidedAt: row.decided_at })),
        suggestions: suggestions.map((row) => ({ groupId: row.group_id, title: row.title, type: row.type, url: row.url, notes: row.notes, status: row.status, createdAt: row.created_at })),
        votes: votes.map((row) => ({ groupId: row.group_id, roundId: row.round_id, materialId: row.material_id, createdAt: row.created_at })),
        emailPreferences: { emailEnabled: preference?.email_enabled !== 0 },
        emails: emails.map((row) => ({
          kind: row.kind, groupId: row.group_id, groupName: row.group_name, reason: row.reason, status: row.status, createdAt: row.created_at, sentAt: row.sent_at,
        })),
      };
    },

    // Groups

    async listPublicGroups(cursor: [string, string] | null, limit: number): Promise<Page<GroupCard & GroupSchedule & { requiresAccessCode: boolean; icon: StoredIcon | null }>> {
      const rows = await many<GroupRow>(
        `SELECT * FROM groups WHERE listed = 1
           AND (? IS NULL OR created_at < ? OR (created_at = ? AND id < ?))
         ORDER BY created_at DESC, id DESC LIMIT ?`,
        cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1
      );
      const result = page(rows, limit, (row) => encodeCursor(row.created_at, row.id));
      return { items: result.items.map((row) => ({ ...toGroupCard(row), ...toGroupSchedule(row), requiresAccessCode: row.require_access_code === 1, icon: storedIcon(row) })), nextCursor: result.nextCursor };
    },

    async listAllGroups(cursor: [string, string] | null, limit: number): Promise<Page<AdminGroup>> {
      const rows = await many<GroupRow & { owner_name: string | null; member_count: number }>(
        `SELECT g.*, u.display_name AS owner_name, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
         FROM groups g LEFT JOIN users u ON u.id = g.owner_id
         WHERE (? IS NULL OR g.created_at < ? OR (g.created_at = ? AND g.id < ?))
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
      const row = await one<GroupRow>('SELECT * FROM groups WHERE id = ?', id);
      return row ? { ...toGroupSettings(row), ownerId: row.owner_id, icon: storedIcon(row) } : null;
    },

    async countOwnedGroups(userId: string): Promise<number> {
      return (await one<{ count: number }>('SELECT COUNT(*) AS count FROM groups WHERE owner_id = ?', userId))!.count;
    },

    async createGroup(group: { id: string; ownerId: string; accessCode: string } & GroupProfileInput, now: string): Promise<GroupSettings> {
      const row = await one<GroupRow>(
        `INSERT INTO groups (id, owner_id, name, summary, rules, meeting_day, meeting_start, meeting_end, timezone, meeting_url, access_code, moderation_mode, listed, meeting_reminders, require_access_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        group.id, group.ownerId, group.name, group.summary, JSON.stringify(group.rules), group.meetingDay, group.meetingStart, group.meetingEnd,
        group.timezone, group.meetingUrl, group.accessCode, group.moderationMode, group.listed ? 1 : 0, group.meetingReminders === false ? 0 : 1,
        group.requiresAccessCode === true ? 1 : 0, now, now
      );
      return toGroupSettings(row!);
    },

    async updateGroup(id: string, input: GroupProfileInput, now: string): Promise<GroupSettings> {
      const row = await one<GroupRow>(
        `UPDATE groups SET name = ?, summary = ?, rules = ?, meeting_day = ?, meeting_start = ?, meeting_end = ?, timezone = ?,
           meeting_url = ?, moderation_mode = ?, listed = ?, meeting_reminders = COALESCE(?, meeting_reminders),
           require_access_code = COALESCE(?, require_access_code), updated_at = ?
         WHERE id = ? RETURNING *`,
        input.name, input.summary, JSON.stringify(input.rules), input.meetingDay, input.meetingStart, input.meetingEnd, input.timezone,
        input.meetingUrl, input.moderationMode, input.listed ? 1 : 0, input.meetingReminders === undefined ? null : input.meetingReminders ? 1 : 0,
        input.requiresAccessCode === undefined ? null : input.requiresAccessCode ? 1 : 0, now, id
      );
      return toGroupSettings(row!);
    },

    async rotateAccessCode(id: string, accessCode: string, now: string): Promise<GroupSettings> {
      const row = await one<GroupRow>('UPDATE groups SET access_code = ?, updated_at = ? WHERE id = ? RETURNING *', accessCode, now, id);
      return toGroupSettings(row!);
    },

    /**
     * Deletes the group permanently: members, join requests, suggestions, rounds and votes go with it (foreign key
     * cascades). The admin log entry and the owner's notice (E4) are written in the same batch. Returns the notice to
     * queue and the icon key for the R2 cleanup.
     */
    async deleteGroup(id: string, now: string, log?: NewModerationAction, notice?: OutboxNotice): Promise<{ queued: QueuedNotification[]; iconKeys: string[] }> {
      const statements = [
        ...(log ? [logStatement(log, now)] : []),
        ...(notice ? [outboxStatement(notice, now)] : []),
        statement('DELETE FROM groups WHERE id = ? RETURNING icon_key', id),
      ];
      const results = await db.batch(statements);
      return { queued: notice ? queued([results[statements.length - 2]]) : [], iconKeys: iconKeys(results[statements.length - 1]) };
    },

    async listMyGroups(userId: string): Promise<(MyGroup & { icon: StoredIcon | null })[]> {
      const rows = await many<GroupRow & { role: 'owner' | 'member' }>(
        `SELECT g.*, CASE WHEN g.owner_id = ? THEN 'owner' ELSE 'member' END AS role FROM groups g
         WHERE (g.owner_id = ? OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?))
         ORDER BY g.name COLLATE NOCASE, g.id`,
        userId, userId, userId
      );
      return rows.map((row) => ({ ...toGroupCard(row), role: row.role, iconUrl: null, icon: storedIcon(row) }));
    },

    /** Groups that rejected the user's request after `since` and that the user hasn't asked to join again or joined. */
    async listMyRecentRejections(userId: string, since: string): Promise<(GroupCard & { decidedAt: string })[]> {
      const rows = await many<GroupRow & { decided_at: string }>(
        `SELECT g.*, MAX(jr.decided_at) AS decided_at FROM join_requests jr JOIN groups g ON g.id = jr.group_id
         WHERE jr.user_id = ? AND jr.status = 'rejected' AND jr.decided_at > ?
           AND NOT EXISTS (SELECT 1 FROM join_requests p WHERE p.group_id = g.id AND p.user_id = jr.user_id AND p.status = 'pending')
           AND NOT EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = jr.user_id)
         GROUP BY g.id ORDER BY decided_at DESC`,
        userId, since
      );
      return rows.map((row) => ({ ...toGroupCard(row), decidedAt: row.decided_at }));
    },

    async listMyPendingRequests(userId: string): Promise<PendingGroupRequest[]> {
      const rows = await many<GroupRow & { requested_at: string }>(
        `SELECT g.*, jr.created_at AS requested_at FROM join_requests jr JOIN groups g ON g.id = jr.group_id
         WHERE jr.user_id = ? AND jr.status = 'pending' ORDER BY jr.created_at DESC`,
        userId
      );
      return rows.map((row) => ({ ...toGroupCard(row), requestedAt: row.requested_at }));
    },

    /** Admin deletions in the groups a user owns, including groups the admin deleted (Q5). */
    async listOwnerNotices(userId: string, since: string): Promise<ModerationNotice[]> {
      const rows = await many<NoticeRow>(
        `SELECT id, action, group_id, label, reason, created_at FROM moderation_actions
         WHERE owner_id = ? AND created_at >= ? AND action LIKE 'delete_%' ORDER BY id DESC LIMIT 20`,
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
         WHERE gm.group_id = ? AND gm.user_id IS NOT (SELECT owner_id FROM groups WHERE id = ?) AND ${notBanned('gm.user_id')}
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

    /** Returns the owner's digest (E1) to queue: now, at the end of the 6-hour window, or none when already covered. */
    async createJoinRequest(groupId: string, userId: string, message: string | null, now: string, digest?: { ownerId: string; windowStart: string }): Promise<QueuedNotification[]> {
      return withNotices([
        statement('INSERT INTO join_requests (group_id, user_id, message, status, created_at) VALUES (?, ?, ?, \'pending\', ?)', groupId, userId, message, now),
      ], digest ? digestStatements(groupId, digest.ownerId, now, digest.windowStart) : []);
    },

    /** Decision time of the user's latest request to the group rejected after `since`, if any (the re-request cooldown). */
    async latestRejection(groupId: string, userId: string, since: string): Promise<string | null> {
      return (await one<{ decided_at: string }>(
        "SELECT decided_at FROM join_requests WHERE group_id = ? AND user_id = ? AND status = 'rejected' AND decided_at > ? ORDER BY decided_at DESC LIMIT 1",
        groupId, userId, since
      ))?.decided_at ?? null;
    },

    async listPendingRequests(groupId: string): Promise<JoinRequest[]> {
      const rows = await many<{ id: number; display_name: string; message: string | null; created_at: string }>(
        `SELECT jr.id, u.display_name, jr.message, jr.created_at FROM join_requests jr JOIN users u ON u.id = jr.user_id
         WHERE jr.group_id = ? AND jr.status = 'pending' AND ${notBanned('jr.user_id')} ORDER BY jr.created_at, jr.id`,
        groupId
      );
      return rows.map((row) => ({ id: row.id, displayName: row.display_name, message: row.message, createdAt: row.created_at }));
    },

    async getPendingRequest(groupId: string, id: number): Promise<{ id: number; userId: string } | null> {
      const row = await one<{ id: number; user_id: string }>("SELECT id, user_id FROM join_requests WHERE group_id = ? AND id = ? AND status = 'pending'", groupId, id);
      return row ? { id: row.id, userId: row.user_id } : null;
    },

    async approveRequest(groupId: string, request: { id: number; userId: string }, now: string, notice: OutboxNotice): Promise<QueuedNotification[]> {
      return withNotices([
        statement("UPDATE join_requests SET status = 'approved', decided_at = ? WHERE id = ? AND status = 'pending'", now, request.id),
        statement('INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)', groupId, request.userId, now),
      ], [outboxStatement(notice, now)]);
    },

    async rejectRequest(id: number, now: string, notice: OutboxNotice): Promise<QueuedNotification[]> {
      return withNotices([statement("UPDATE join_requests SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'pending'", now, id)], [outboxStatement(notice, now)]);
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
        `${materialSelect} WHERE m.group_id = ? AND ${notBanned('m.user_id')} AND (m.status != 'pending' OR ? = 1 OR m.user_id = ?)
         ORDER BY m.created_at DESC, m.id DESC`,
        groupId, seeAllPending ? 1 : 0, viewerId
      );
      return rows.map((row) => toMaterial(row, viewerId));
    },

    getMaterial,

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
        "UPDATE materials SET status = ?, discussed_at = ? WHERE group_id = ? AND id = ? AND status != 'pending' RETURNING id",
        status, status === 'discussed' ? now : null, groupId, id
      );
      return row ? getMaterial(groupId, row.id, viewerId) : null;
    },

    async approveMaterial(groupId: string, id: number, viewerId: string): Promise<Material | null> {
      const row = await one<{ id: number }>(
        "UPDATE materials SET status = 'open' WHERE group_id = ? AND id = ? AND status = 'pending' RETURNING id", groupId, id);
      return row ? getMaterial(groupId, row.id, viewerId) : null;
    },

    /** Deletes a suggestion permanently, with its votes in every round; a round it won keeps no winner. */
    async deleteMaterial(groupId: string, id: number, now: string, log?: NewModerationAction): Promise<void> {
      await db.batch([
        ...(log ? [logStatement(log, now)] : []),
        statement('DELETE FROM materials WHERE group_id = ? AND id = ?', groupId, id),
      ]);
    },

    async listOpenMaterialIds(groupId: string, createdAtOrBefore?: string): Promise<number[]> {
      const rows = createdAtOrBefore === undefined
        ? await many<{ id: number }>(`SELECT id FROM materials m WHERE group_id = ? AND status = 'open' AND ${notBanned('m.user_id')} ORDER BY id`, groupId)
        : await many<{ id: number }>(`SELECT id FROM materials m WHERE group_id = ? AND status = 'open' AND ${notBanned('m.user_id')} AND created_at <= ? ORDER BY id`, groupId, createdAtOrBefore);
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
         JOIN materials m ON m.id = v.material_id
         LEFT JOIN users u ON u.id = v.user_id
         WHERE v.round_id = ? AND ${notBanned('v.user_id')} AND ${notBanned('m.user_id')} ORDER BY v.created_at, v.id`,
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
        'SELECT material_id FROM votes WHERE round_id = ? AND user_id = ?', roundId, userId
      ))?.material_id ?? null;
    },

    // Email notifications

    async getEmailEnabled(userId: string): Promise<boolean> {
      return (await one<{ email_enabled: number }>('SELECT email_enabled FROM notification_preferences WHERE user_id = ?', userId))?.email_enabled !== 0;
    },

    /** No-op for a user that no longer exists (an old unsubscribe link). */
    async setEmailEnabled(userId: string, enabled: boolean, now: string): Promise<void> {
      await run(
        `INSERT INTO notification_preferences (user_id, email_enabled, updated_at) SELECT id, ?, ? FROM users WHERE id = ?
         ON CONFLICT (user_id) DO UPDATE SET email_enabled = excluded.email_enabled, updated_at = excluded.updated_at`,
        enabled ? 1 : 0, now, userId
      );
    },

    /**
     * Daily re-drive. Rows idle since `idleBefore` (a lost queue send, or a mailer that stopped mid-send) are queued
     * again; rows that already used every delivery attempt are marked failed. Returns the rows to queue and the
     * failures of the last day, for the log.
     */
    async recoverNotifications(idleBefore: string, dayAgo: string, limit: number): Promise<{ requeue: QueuedNotification[]; failedLastDay: number }> {
      const idle = "status IN ('pending', 'sending') AND COALESCE(claimed_at, send_after) < ?";
      const [, rows, failed] = await db.batch([
        statement(`UPDATE notifications SET status = 'failed' WHERE ${idle} AND attempts >= ?`, idleBefore, NOTIFICATION_LIMITS.maxDeliveryAttempts),
        statement(`SELECT id, send_after FROM notifications WHERE ${idle} ORDER BY id LIMIT ?`, idleBefore, limit),
        statement("SELECT COUNT(*) AS count FROM notifications WHERE status = 'failed' AND created_at >= ?", dayAgo),
      ]) as [unknown, unknown, { results: { count: number }[] }];
      return { requeue: queued([rows]), failedLastDay: failed.results[0].count };
    },

    /** Reminders still pending whose send time is in (from, to]: written by an earlier scan whose queue send was lost. */
    async listPendingReminders(from: string, to: string): Promise<QueuedNotification[]> {
      return queued([await db.prepare(
        "SELECT id, send_after FROM notifications WHERE kind = 'meeting_reminder' AND status = 'pending' AND send_after > ? AND send_after <= ? ORDER BY id"
      ).bind(from, to).all()]);
    },

    /** One page of the groups with meeting reminders on, after `afterId` in id order (keyset paging). */
    async listReminderGroups(afterId: string, limit: number): Promise<ReminderGroup[]> {
      return many<ReminderGroup>(
        `SELECT id, meeting_day AS meetingDay, meeting_start AS meetingStart, timezone FROM groups
         WHERE id > ? AND meeting_reminders = 1 ORDER BY id LIMIT ?`,
        afterId, limit
      );
    },

    /**
     * Writes one reminder per recipient (the owner and the members) of each due meeting, leaving out users who turned
     * service emails off and banned users. The dedupe key makes a rerun of the cron write nothing new.
     */
    async queueMeetingReminders(reminders: DueReminder[], now: string): Promise<QueuedNotification[]> {
      if (!reminders.length) return [];
      return queued(await db.batch(reminders.map(({ groupId, lead, meetingAt, sendAfter }) => statement(
        `INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after)
         SELECT u.id, 'meeting_reminder', g.id, ?, 'meeting_reminder:' || ? || ':' || g.id || ':' || ? || ':' || u.id, ?, ?
         FROM groups g JOIN users u ON u.id = g.owner_id OR u.id IN (SELECT gm.user_id FROM group_members gm WHERE gm.group_id = g.id)
         WHERE g.id = ? AND g.meeting_reminders = 1 AND ${emailOn} AND ${notBanned('u.id')}
         ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, send_after`,
        JSON.stringify({ lead, meetingAt }), lead, meetingAt, now, sendAfter, groupId
      ))));
    },

    // Group icons

    async countIconUploads(userId: string, groupId: string, since: string): Promise<{ user: number; group: number }> {
      return (await one<{ user: number; group: number }>(
        `SELECT (SELECT COUNT(*) FROM icon_uploads WHERE user_id = ? AND created_at >= ?) AS user,
                (SELECT COUNT(*) FROM icon_uploads WHERE group_id = ? AND created_at >= ?) AS "group"`,
        userId, since, groupId, since
      ))!;
    },

    /** Points the group at a newly stored icon and counts the upload; returns the replaced key, if any. */
    async setGroupIcon(groupId: string, userId: string, icon: StoredIcon): Promise<string | null> {
      const [previous] = await db.batch([
        statement('SELECT icon_key FROM groups WHERE id = ?', groupId),
        statement('UPDATE groups SET icon_key = ?, icon_content_type = ?, icon_updated_at = ?, updated_at = ? WHERE id = ?', icon.key, icon.contentType, icon.updatedAt, icon.updatedAt, groupId),
        statement('INSERT INTO icon_uploads (user_id, group_id, created_at) VALUES (?, ?, ?)', userId, groupId, icon.updatedAt),
      ]) as [{ results: { icon_key: string | null }[] }];
      return previous.results[0]?.icon_key ?? null;
    },

    /** Removes the group icon; a removal by the platform admin is logged and notifies the owner in the same batch. */
    async clearGroupIcon(groupId: string, now: string, log?: NewModerationAction, notice?: OutboxNotice): Promise<QueuedNotification[]> {
      return withNotices([
        statement('UPDATE groups SET icon_key = NULL, icon_content_type = NULL, icon_updated_at = NULL, updated_at = ? WHERE id = ?', now, groupId),
        ...(log ? [logStatement(log, now)] : []),
      ], notice ? [outboxStatement(notice, now)] : []);
    },

    /** Every icon key still in use, for the daily orphan cleanup of the bucket. */
    async listIconKeys(): Promise<Set<string>> {
      return new Set((await many<{ icon_key: string }>('SELECT icon_key FROM groups WHERE icon_key IS NOT NULL')).map((row) => row.icon_key));
    },

    // Users and bans

    async listUsers(query: string, cursor: [string, string] | null, limit: number): Promise<Page<Omit<AdminUser, 'isPlatformAdmin'> & { email: string }>> {
      const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      const rows = await many<{ id: string; email: string; display_name: string; created_at: string; owned_groups: number; ban_reason: string | null; banned_at: string | null; ban_expires_at: string | null }>(
        `SELECT u.id, u.email, u.display_name, u.created_at,
           (SELECT COUNT(*) FROM groups g WHERE g.owner_id = u.id) AS owned_groups, b.reason AS ban_reason, b.created_at AS banned_at, b.expires_at AS ban_expires_at
         FROM users u LEFT JOIN bans b ON b.user_id = u.id AND ${BAN_IN_FORCE}
         WHERE (? = '' OR u.display_name LIKE ? ESCAPE '\\' OR lower(u.email) = lower(?) OR u.id = ?)
           AND (? IS NULL OR u.created_at < ? OR (u.created_at = ? AND u.id < ?))
         ORDER BY u.created_at DESC, u.id DESC LIMIT ?`,
        query, pattern, query, query, cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1
      );
      const result = page(rows, limit, (row) => encodeCursor(row.created_at, row.id));
      return {
        items: result.items.map((row) => ({
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          createdAt: row.created_at,
          ownedGroups: row.owned_groups,
          ban: row.ban_reason === null ? null : { reason: row.ban_reason, createdAt: row.banned_at!, expiresAt: row.ban_expires_at! },
        })),
        nextCursor: result.nextCursor,
      };
    },

    async getUser(id: string): Promise<{ id: string; sub: string; email: string; displayName: string; banned: boolean } | null> {
      const row = await one<{ id: string; google_sub: string; email: string; display_name: string; banned: number }>(
        `SELECT u.id, u.google_sub, u.email, u.display_name, EXISTS (SELECT 1 FROM bans b WHERE b.user_id = u.id AND ${BAN_IN_FORCE}) AS banned FROM users u WHERE u.id = ?`, id);
      return row ? { id: row.id, sub: row.google_sub, email: row.email, displayName: row.display_name, banned: row.banned === 1 } : null;
    },

    /** True when a ban matches the Google account or its email, so neither can sign in or sign up again. */
    async isBanned(sub: string, email: string): Promise<boolean> {
      return Boolean(await one(`SELECT 1 AS found FROM bans b WHERE (b.google_sub = ? OR b.email = ?) AND ${BAN_IN_FORCE}`, sub, email.toLowerCase()));
    },

    async listOwnedGroups(userId: string): Promise<{ id: string; name: string }[]> {
      return many<{ id: string; name: string }>('SELECT id, name FROM groups WHERE owner_id = ? ORDER BY created_at', userId);
    },

    /**
     * Bans the user in one batch: the ban row, the log entries, every owned group deleted permanently (with an E4
     * notice each), and every session ended. Returns the notices to queue and the icon keys to delete.
     */
    async banUser(
      user: { id: string; sub: string; email: string },
      reason: string,
      now: string,
      expiresAt: string,
      logs: NewModerationAction[],
      notices: OutboxNotice[],
    ): Promise<{ queued: QueuedNotification[]; iconKeys: string[] }> {
      const head = [
        // An expired row the daily purge hasn't deleted yet would collide with the new one (same user or Google account).
        statement('DELETE FROM bans WHERE user_id = ? OR google_sub = ?', user.id, user.sub),
        statement(
          'INSERT INTO bans (user_id, google_sub, email, reason, actor_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          user.id, user.sub, user.email.toLowerCase(), reason, logs[0].actorId, now, expiresAt
        ),
        ...logs.map((log) => logStatement(log, now)),
      ];
      const results = await db.batch([
        ...head,
        ...notices.map((notice) => outboxStatement(notice, now)),
        statement('DELETE FROM groups WHERE owner_id = ? RETURNING icon_key', user.id),
        statement('DELETE FROM sessions WHERE user_id = ?', user.id),
      ]);
      return { queued: queued(results.slice(head.length, head.length + notices.length)), iconKeys: iconKeys(results[results.length - 2]) };
    },

    /** Renews a ban: a new reason and expiry (BAN_RETENTION_YEARS from now), logged. */
    async renewBan(userId: string, reason: string, expiresAt: string, log: NewModerationAction, now: string): Promise<void> {
      await db.batch([
        statement('UPDATE bans SET reason = ?, actor_id = ?, expires_at = ? WHERE user_id = ?', reason, log.actorId, expiresAt, userId),
        logStatement(log, now),
      ]);
    },

    /** Lifts a ban, logged, and writes the "account restored" notice in the same batch. */
    async unbanUser(userId: string, log: NewModerationAction, now: string, notice: OutboxNotice): Promise<QueuedNotification[]> {
      return withNotices([statement('DELETE FROM bans WHERE user_id = ?', userId), logStatement(log, now)], [outboxStatement(notice, now)]);
    },

    // Retention (daily cron)

    /**
     * Purges decided join requests after 30 days, the audit log after 12 months, expired sessions (Q6, Q11), the email
     * outbox 30 days after each row was created, the icon upload counters after a day, and bans at their expiry (2 years
     * after the ban or its last renewal, which lifts them). Deletions themselves are permanent at once; nothing is left
     * soft-deleted to purge.
     */
    async purgeExpired(now: Date): Promise<void> {
      const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
      await db.batch([
        statement("DELETE FROM join_requests WHERE status != 'pending' AND decided_at < ?", daysAgo(30)),
        statement('DELETE FROM moderation_actions WHERE created_at < ?', daysAgo(365)),
        statement('DELETE FROM sessions WHERE expires_at <= ?', now.toISOString()),
        statement('DELETE FROM notifications WHERE created_at < ?', daysAgo(30)),
        statement('DELETE FROM icon_uploads WHERE created_at < ?', daysAgo(1)),
        // An expired ban is lifted silently (no email), with an unban entry in the moderation log.
        statement(
          `INSERT INTO moderation_actions (actor_id, owner_id, action, target_type, target_id, group_id, label, reason, created_at)
           SELECT NULL, NULL, 'unban_user', 'user', b.user_id, NULL, substr(u.display_name, 1, 120), 'Ban expired', ?
           FROM bans b JOIN users u ON u.id = b.user_id WHERE b.expires_at <= ?`,
          now.toISOString(), now.toISOString()
        ),
        statement('DELETE FROM bans WHERE expires_at <= ?', now.toISOString()),
      ]);
    },
  };

  function logStatement(log: NewModerationAction, now: string): D1StatementLike {
    return statement(
      'INSERT INTO moderation_actions (actor_id, owner_id, action, target_type, target_id, group_id, label, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      log.actorId, log.ownerId ?? null, log.action, log.targetType, log.targetId, log.groupId, log.label, log.reason, now
    );
  }
}

export type StudyGroupRepository = ReturnType<typeof createRepository>;

function storedIcon(row: { icon_key: string | null; icon_content_type: string | null; icon_updated_at: string | null }): StoredIcon | null {
  return row.icon_key ? { key: row.icon_key, contentType: row.icon_content_type!, updatedAt: row.icon_updated_at! } : null;
}

function iconKeys(result: unknown): string[] {
  return (result as { results: { icon_key: string | null }[] }).results.flatMap((row) => (row.icon_key ? [row.icon_key] : []));
}

function toGroupCard(row: GroupRow): GroupCard {
  return { id: row.id, name: row.name, summary: row.summary };
}

function toGroupSchedule(row: GroupRow): GroupSchedule {
  return { meetingDay: row.meeting_day, meetingStart: row.meeting_start, meetingEnd: row.meeting_end, timezone: row.timezone };
}

function toGroupInfo(row: GroupRow): GroupInfo {
  return {
    ...toGroupCard(row),
    iconUrl: null,
    rules: parseRules(row.rules),
    meetingDay: row.meeting_day,
    meetingStart: row.meeting_start,
    meetingEnd: row.meeting_end,
    timezone: row.timezone,
    meetingUrl: row.meeting_url || null,
    moderationMode: row.moderation_mode,
    listed: row.listed === 1,
    meetingReminders: row.meeting_reminders === 1,
    requiresAccessCode: row.require_access_code === 1,
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
