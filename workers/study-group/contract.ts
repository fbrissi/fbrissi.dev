import { z } from 'zod';

// Skip Zod's `new Function` capability probe: the site CSP has no 'unsafe-eval', and the probe logs a violation.
z.config({ jitless: true });

export const STUDY_GROUP_API_PREFIX = '/api/study-group';

/** Current versions of the program documents; bumping one asks every user to accept it again (Q18). */
export const POLICY_VERSIONS = { terms: '2026-11-16', privacy: '2026-11-21' } as const;
export type PolicyDocument = keyof typeof POLICY_VERSIONS;

export const materialTypes = ['video', 'article', 'book', 'podcast', 'other'] as const;
export const materialStatuses = ['pending', 'open', 'discussed'] as const;
export const roundModes = ['draw', 'vote'] as const;
export const roundStatuses = ['open', 'closed'] as const;
export const moderationModes = ['free', 'review'] as const;
export const groupRoles = ['member', 'owner', 'platform_admin'] as const;

export type MaterialType = (typeof materialTypes)[number];
export type MaterialStatus = (typeof materialStatuses)[number];
export type RoundMode = (typeof roundModes)[number];
export type RoundStatus = (typeof roundStatuses)[number];
export type ModerationMode = (typeof moderationModes)[number];
export type GroupRole = (typeof groupRoles)[number];

export const LIMITS = {
  displayName: { min: 1, max: 40 },
  groupName: { min: 3, max: 60 },
  groupSummary: { min: 20, max: 280 },
  joinMessage: 200,
  reason: { min: 10, max: 500 },
  ownedGroupsPerUser: 3,
  membersPerGroup: 50,
  pendingRequestsPerUser: 10,
  suggestionsPerUserPerGroupPerDay: 20,
} as const;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'URL must use http or https');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const reasonSchema = trimmed(LIMITS.reason.min, LIMITS.reason.max);

export const createMaterialSchema = z.object({
  type: z.enum(materialTypes),
  title: trimmed(1, 200),
  url: httpUrl.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMaterialSchema = z.object({
  status: z.enum(['open', 'discussed']),
});

export const deleteSchema = z.object({
  reason: reasonSchema.optional(),
});

export const createRoundSchema = z.object({
  mode: z.enum(roundModes),
});

export const castVoteSchema = z.object({
  materialId: z.number().int().positive(),
});

export const groupProfileSchema = z.object({
  name: trimmed(LIMITS.groupName.min, LIMITS.groupName.max),
  summary: trimmed(LIMITS.groupSummary.min, LIMITS.groupSummary.max),
  rules: z.array(trimmed(1, 300)).max(30),
  meetingDay: trimmed(1, 20),
  meetingStart: time,
  meetingEnd: time,
  timezone: trimmed(1, 64),
  meetingUrl: httpUrl.nullable(),
  moderationMode: z.enum(moderationModes),
  listed: z.boolean(),
});

export const createGroupSchema = groupProfileSchema.extend({
  acceptContentPolicy: z.literal(true),
});

export const joinGroupSchema = z.object({
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().max(LIMITS.joinMessage).optional(),
});

export const acceptPoliciesSchema = z.object({
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
});

export const signupSchema = acceptPoliciesSchema.extend({
  confirmAge: z.literal(true),
});

export const updateProfileSchema = z.object({
  displayName: trimmed(LIMITS.displayName.min, LIMITS.displayName.max),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal(true),
});

export const deleteGroupSchema = z.object({
  confirmName: z.string().trim().min(1).max(LIMITS.groupName.max),
  reason: reasonSchema.optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
export type GroupProfileInput = z.infer<typeof groupProfileSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AcceptPoliciesInput = z.infer<typeof acceptPoliciesSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type DeleteGroupInput = z.infer<typeof deleteGroupSchema>;

export interface CurrentUser {
  id: string;
  displayName: string;
  isPlatformAdmin: boolean;
  needsConsent: boolean;
}

export interface MeResponse {
  user: CurrentUser | null;
}

export interface PendingSignupResponse {
  displayName: string;
}

export interface Material {
  id: number;
  suggestedBy: string;
  mine: boolean;
  type: MaterialType;
  title: string;
  url: string | null;
  notes: string | null;
  status: MaterialStatus;
  createdAt: string;
  discussedAt: string | null;
}

export interface DeletedMaterial extends Material {
  deletedAt: string;
  deletedByAdmin: boolean;
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

export interface GroupCard {
  id: string;
  name: string;
  summary: string;
}

export interface GroupInfo extends GroupCard {
  rules: string[];
  meetingDay: string;
  meetingStart: string;
  meetingEnd: string;
  timezone: string;
  meetingUrl: string | null;
  moderationMode: ModerationMode;
  listed: boolean;
}

export interface GroupSettings extends GroupInfo {
  accessCode: string;
}

export interface Member {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  joinedAt: string | null;
}

export interface JoinRequest {
  id: number;
  displayName: string;
  message: string | null;
  createdAt: string;
}

export interface ModerationNotice {
  id: number;
  action: string;
  groupId: string | null;
  label: string;
  reason: string;
  createdAt: string;
}

export interface ModerationAction extends ModerationNotice {
  actorName: string | null;
  targetType: string;
  targetId: string;
}

export type Membership = 'none' | 'pending' | 'member' | 'owner';

export interface MyGroup extends GroupCard {
  role: 'owner' | 'member';
}

export interface PendingGroupRequest extends GroupCard {
  requestedAt: string;
}

export interface MyGroupsResponse {
  groups: MyGroup[];
  pending: PendingGroupRequest[];
  notices: ModerationNotice[];
}

export interface GroupListResponse {
  groups: GroupCard[];
  nextCursor: string | null;
}

export interface AdminGroup extends GroupCard {
  ownerName: string | null;
  listed: boolean;
  memberCount: number;
  createdAt: string;
}

export interface AdminGroupListResponse {
  groups: AdminGroup[];
  nextCursor: string | null;
}

export interface ModerationLogResponse {
  actions: ModerationAction[];
  nextCursor: string | null;
}

export interface GroupPreviewResponse {
  group: GroupCard;
  membership: Membership;
}

export interface GroupResponse {
  group: GroupInfo;
  role: GroupRole;
  /** Members and the owner suggest and vote; a platform admin outside the group only manages it. */
  canParticipate: boolean;
}

export interface GroupSettingsResponse {
  settings: GroupSettings;
  notices: ModerationNotice[];
  role: GroupRole;
}

export interface CreateGroupResponse {
  group: GroupSettings;
}

export interface MembersResponse {
  members: Member[];
}

export interface JoinRequestsResponse {
  requests: JoinRequest[];
}

export interface JoinResponse {
  status: 'pending';
}

export interface ListMaterialsResponse {
  materials: Material[];
}

export interface ListDeletedMaterialsResponse {
  materials: DeletedMaterial[];
}

export interface MaterialResponse {
  material: Material;
}

/** Latest round (open, or the most recently closed one) with its vote tally. */
export interface CurrentRoundResponse {
  round: Round | null;
  tally: TallyEntry[];
  myVote: number | null;
}

export interface RoundResponse extends CurrentRoundResponse {
  round: Round;
  winner: Material | null;
}

export interface ErrorResponse {
  error: string;
  issues?: unknown[];
}

export interface AccountExport {
  exportedAt: string;
  profile: { id: string; email: string; displayName: string; createdAt: string };
  consents: { document: string; version: string; acceptedAt: string }[];
  ownedGroups: GroupCard[];
  memberships: { groupId: string; groupName: string; joinedAt: string }[];
  joinRequests: { groupId: string; groupName: string; status: string; message: string | null; createdAt: string; decidedAt: string | null }[];
  suggestions: { groupId: string; title: string; type: string; url: string | null; notes: string | null; status: string; createdAt: string }[];
  votes: { groupId: string; roundId: number; materialId: number; createdAt: string }[];
}
