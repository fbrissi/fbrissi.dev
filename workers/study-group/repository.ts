import type {
  CreateMaterialInput,
  DeletedMaterial,
  GroupInfo,
  GroupSettings,
  Material,
  MaterialStatus,
  MaterialType,
  Round,
  RoundMode,
  RoundStatus,
  TallyEntry,
  UpdateGroupSettingsInput,
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

interface MaterialRow {
  id: number;
  suggested_by: string;
  type: MaterialType;
  title: string;
  url: string | null;
  notes: string | null;
  status: MaterialStatus;
  created_at: string;
  discussed_at: string | null;
  deleted_at: string | null;
}

interface RoundRow {
  id: number;
  mode: RoundMode;
  status: RoundStatus;
  created_at: string;
  closed_at: string | null;
  winner_material_id: number | null;
}

interface GroupInfoRow {
  name: string;
  description: string;
  rules: string;
  meeting_day: string;
  meeting_start: string;
  meeting_end: string;
  timezone: string;
  meeting_url: string | null;
  access_code: string | null;
}

interface VoteRow {
  material_id: number;
  voter_name: string;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export function normalizeVoterName(name: string): string {
  return name.trim().toLowerCase();
}

export function createRepository(db: D1Like) {
  const getGroupRow = () => db.prepare('SELECT * FROM group_info WHERE id = 1').first<GroupInfoRow>();

  return {
    async getGroupInfo(): Promise<GroupInfo | null> {
      const row = await getGroupRow();
      return row ? toGroupInfo(row) : null;
    },

    async getGroupSettings(): Promise<GroupSettings | null> {
      const row = await getGroupRow();
      return row ? { ...toGroupInfo(row), accessCode: row.access_code || null } : null;
    },

    async getAccessCode(): Promise<string | null> {
      return (await getGroupRow())?.access_code || null;
    },

    async updateGroupSettings(input: UpdateGroupSettingsInput): Promise<GroupSettings> {
      const row = await db.prepare(
        `INSERT INTO group_info (id, name, description, rules, meeting_day, meeting_start, meeting_end, timezone, meeting_url, access_code)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, description = excluded.description, rules = excluded.rules,
           meeting_day = excluded.meeting_day, meeting_start = excluded.meeting_start, meeting_end = excluded.meeting_end,
           timezone = excluded.timezone, meeting_url = excluded.meeting_url, access_code = excluded.access_code
         RETURNING *`
      ).bind(
        input.name,
        input.description,
        JSON.stringify(input.rules),
        input.meetingDay,
        input.meetingStart,
        input.meetingEnd,
        input.timezone,
        input.meetingUrl,
        input.accessCode
      ).first<GroupInfoRow>();
      return { ...toGroupInfo(row!), accessCode: row!.access_code };
    },

    async listMaterials(status: MaterialStatus | 'all'): Promise<Material[]> {
      const statement = status === 'all'
        ? db.prepare('SELECT * FROM materials WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC')
        : db.prepare('SELECT * FROM materials WHERE deleted_at IS NULL AND status = ? ORDER BY created_at DESC, id DESC').bind(status);
      const { results } = await statement.all<MaterialRow>();
      return results.map(toMaterial);
    },

    async listDeletedMaterials(): Promise<DeletedMaterial[]> {
      const { results } = await db.prepare(
        'SELECT * FROM materials WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC'
      ).all<MaterialRow>();
      return results.map((row) => ({ ...toMaterial(row), deletedAt: row.deleted_at! }));
    },

    async getMaterial(id: number): Promise<Material | null> {
      const row = await db.prepare('SELECT * FROM materials WHERE id = ? AND deleted_at IS NULL').bind(id).first<MaterialRow>();
      return row ? toMaterial(row) : null;
    },

    async createMaterial(input: CreateMaterialInput, now: string): Promise<Material> {
      const row = await db.prepare(
        `INSERT INTO materials (suggested_by, type, title, url, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?) RETURNING *`
      ).bind(input.suggestedBy, input.type, input.title, input.url ?? null, input.notes || null, now).first<MaterialRow>();
      return toMaterial(row!);
    },

    async updateMaterialStatus(id: number, status: MaterialStatus, now: string): Promise<Material | null> {
      const row = await db.prepare('UPDATE materials SET status = ?, discussed_at = ? WHERE id = ? AND deleted_at IS NULL RETURNING *')
        .bind(status, status === 'discussed' ? now : null, id)
        .first<MaterialRow>();
      return row ? toMaterial(row) : null;
    },

    /** Soft-deletes a material and withdraws its votes from open rounds; closed rounds keep their history. */
    async deleteMaterial(id: number, now: string): Promise<void> {
      await db.batch([
        db.prepare("DELETE FROM votes WHERE material_id = ? AND round_id IN (SELECT id FROM rounds WHERE status = 'open')").bind(id),
        db.prepare('UPDATE materials SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').bind(now, id),
      ]);
    },

    async restoreMaterial(id: number): Promise<Material | null> {
      const row = await db.prepare('UPDATE materials SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL RETURNING *')
        .bind(id)
        .first<MaterialRow>();
      return row ? toMaterial(row) : null;
    },

    async listOpenMaterialIds(createdAtOrBefore?: string): Promise<number[]> {
      const statement = createdAtOrBefore === undefined
        ? db.prepare("SELECT id FROM materials WHERE status = 'open' AND deleted_at IS NULL ORDER BY id")
        : db.prepare("SELECT id FROM materials WHERE status = 'open' AND deleted_at IS NULL AND created_at <= ? ORDER BY id")
          .bind(createdAtOrBefore);
      const { results } = await statement.all<{ id: number }>();
      return results.map((row) => row.id);
    },

    async getRound(id: number): Promise<Round | null> {
      const row = await db.prepare('SELECT * FROM rounds WHERE id = ?').bind(id).first<RoundRow>();
      return row ? toRound(row) : null;
    },

    async getCurrentRound(): Promise<Round | null> {
      const row = await db.prepare(
        "SELECT * FROM rounds ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC LIMIT 1"
      ).first<RoundRow>();
      return row ? toRound(row) : null;
    },

    async createRound(mode: RoundMode, now: string, winnerMaterialId: number | null): Promise<Round> {
      const closed = mode === 'draw';
      const row = await db.prepare(
        'INSERT INTO rounds (mode, status, created_at, closed_at, winner_material_id) VALUES (?, ?, ?, ?, ?) RETURNING *'
      ).bind(mode, closed ? 'closed' : 'open', now, closed ? now : null, winnerMaterialId).first<RoundRow>();
      return toRound(row!);
    },

    async closeRound(id: number, now: string, winnerMaterialId: number | null): Promise<Round | null> {
      const row = await db.prepare(
        "UPDATE rounds SET status = 'closed', closed_at = ?, winner_material_id = ? WHERE id = ? AND status = 'open' RETURNING *"
      ).bind(now, winnerMaterialId, id).first<RoundRow>();
      return row ? toRound(row) : null;
    },

    async castVote(roundId: number, materialId: number, voterName: string, now: string): Promise<void> {
      await db.prepare(
        `INSERT INTO votes (round_id, material_id, voter_name, voter_name_norm, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (round_id, voter_name_norm)
         DO UPDATE SET material_id = excluded.material_id, voter_name = excluded.voter_name, created_at = excluded.created_at`
      ).bind(roundId, materialId, voterName, normalizeVoterName(voterName), now).run();
    },

    async getTally(roundId: number): Promise<TallyEntry[]> {
      const { results } = await db.prepare(
        `SELECT votes.material_id, votes.voter_name FROM votes
         JOIN materials ON materials.id = votes.material_id AND materials.deleted_at IS NULL
         WHERE votes.round_id = ? ORDER BY votes.created_at, votes.id`
      ).bind(roundId).all<VoteRow>();
      const tally = new Map<number, TallyEntry>();
      for (const row of results) {
        const entry = tally.get(row.material_id) ?? { materialId: row.material_id, votes: 0, voters: [] };
        entry.votes += 1;
        entry.voters.push(row.voter_name);
        tally.set(row.material_id, entry);
      }
      return [...tally.values()].sort((a, b) => b.votes - a.votes || a.materialId - b.materialId);
    },
  };
}

export type StudyGroupRepository = ReturnType<typeof createRepository>;

function toGroupInfo(row: GroupInfoRow): GroupInfo {
  return {
    name: row.name,
    description: row.description,
    rules: parseRules(row.rules),
    meetingDay: row.meeting_day,
    meetingStart: row.meeting_start,
    meetingEnd: row.meeting_end,
    timezone: row.timezone,
    meetingUrl: row.meeting_url || null,
  };
}

function parseRules(value: string): string[] {
  try {
    const rules: unknown = JSON.parse(value);
    return Array.isArray(rules) ? rules.filter((rule): rule is string => typeof rule === 'string') : [];
  } catch {
    return [];
  }
}

function toMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    suggestedBy: row.suggested_by,
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
