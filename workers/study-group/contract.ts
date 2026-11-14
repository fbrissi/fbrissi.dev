import { z } from 'zod';

export const materialTypes = ['video', 'article', 'book', 'podcast', 'other'] as const;
export const materialStatuses = ['open', 'discussed'] as const;
export const roundModes = ['draw', 'vote'] as const;
export const roundStatuses = ['open', 'closed'] as const;

export type MaterialType = (typeof materialTypes)[number];
export type MaterialStatus = (typeof materialStatuses)[number];
export type RoundMode = (typeof roundModes)[number];
export type RoundStatus = (typeof roundStatuses)[number];

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const createMaterialSchema = z.object({
  suggestedBy: trimmed(60),
  type: z.enum(materialTypes),
  title: trimmed(200),
  url: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => /^https?:\/\//i.test(value), 'URL must use http or https')
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMaterialSchema = z.object({
  status: z.enum(materialStatuses),
});

export const createRoundSchema = z.object({
  mode: z.enum(roundModes),
});

export const castVoteSchema = z.object({
  materialId: z.number().int().positive(),
  voterName: trimmed(60),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;

export interface Material {
  id: number;
  suggestedBy: string;
  type: MaterialType;
  title: string;
  url: string | null;
  notes: string | null;
  status: MaterialStatus;
  createdAt: string;
  discussedAt: string | null;
}

export interface Vote {
  materialId: number;
  voterName: string;
  createdAt: string;
}

export interface Round {
  id: number;
  mode: RoundMode;
  status: RoundStatus;
  createdAt: string;
  closedAt: string | null;
  winnerMaterialId: number | null;
}

export interface TallyEntry {
  materialId: number;
  votes: number;
  voters: string[];
}

export interface GroupInfo {
  name: string;
  description: string;
  rules: string[];
  meetingDay: string;
  meetingStart: string;
  meetingEnd: string;
  timezone: string;
  meetingUrl: string | null;
}

export interface GroupInfoResponse {
  group: GroupInfo | null;
}

export const STUDY_GROUP_ACCESS_CODE_HEADER = 'X-Study-Group-Code';

export const adminLoginSchema = z.object({
  email: z.string().trim().max(320).email(),
  password: z.string().min(1).max(200),
});

export const updateGroupSettingsSchema = z.object({
  name: trimmed(80),
  description: z.string().trim().max(2000),
  rules: z.array(trimmed(300)).max(30),
  meetingDay: trimmed(20),
  meetingStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  meetingEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: trimmed(64),
  meetingUrl: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => /^https?:\/\//i.test(value), 'URL must use http or https')
    .nullable(),
  accessCode: z.string().trim().min(6).max(100),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type UpdateGroupSettingsInput = z.infer<typeof updateGroupSettingsSchema>;

/** Admin-only view of group_info, including the shared member access code. */
export interface GroupSettings extends GroupInfo {
  accessCode: string | null;
}

export interface AdminLoginResponse {
  token: string;
  expiresAt: string;
}

export interface GroupSettingsResponse {
  settings: GroupSettings;
}

export interface DeletedMaterial extends Material {
  deletedAt: string;
}

export interface ListDeletedMaterialsResponse {
  materials: DeletedMaterial[];
}

export interface ListMaterialsResponse {
  materials: Material[];
}

export interface MaterialResponse {
  material: Material;
}

/** Latest round (open, or the most recently closed one) with its vote tally. */
export interface CurrentRoundResponse {
  round: Round | null;
  tally: TallyEntry[];
}

export interface RoundResponse {
  round: Round;
  winner: Material | null;
  tally: TallyEntry[];
}

export interface ErrorResponse {
  error: string;
  issues?: unknown[];
}

export const STUDY_GROUP_API_PREFIX = '/api/study-group';
