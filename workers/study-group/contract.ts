import { z } from 'zod';

// Skip Zod's `new Function` capability probe: the site CSP has no 'unsafe-eval', and the probe logs a violation.
z.config({ jitless: true });

export const STUDY_GROUP_API_PREFIX = '/api/study-group';

/** Current versions (dates) of the program documents, shown on the pages and recorded when a user accepts them. */
export const POLICY_VERSIONS = { terms: '2026-11-27', privacy: '2026-11-27' } as const;
export type PolicyDocument = keyof typeof POLICY_VERSIONS;

/**
 * The latest version of each document with a material change (new processors, purposes, legal bases, transfers or
 * user obligations). Users must have accepted this version or a later one; a minor edit only moves POLICY_VERSIONS and
 * takes effect on publication without asking anyone again (Q18). The 2026-11-22 versions are material: they add
 * Amazon SES and Cloudflare R2, service emails, icons, bans and the transfer grounds. The 2026-11-23 versions only add
 * the groups@fbrissi.dev channel, the 2026-11-24 versions show listed groups' icons on the public page, and the 2026-11-25
 * versions add meeting reminders to the service emails (all minor). The 2026-11-26 privacy policy is material: it adds
 * Sentry (error monitoring, a new processor with a transfer to the United States). The 2026-11-27 versions (minor) show the
 * meeting time and whether a code is required on the public page, and make the access code optional.
 */
export const MATERIAL_POLICY_VERSIONS: Record<PolicyDocument, string> = { terms: '2026-11-22', privacy: '2026-11-26' };

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

/** Service emails (E1–E4). The owner digest is coalesced per group, and a rejected user waits before asking again. */
export const NOTIFICATION_LIMITS = {
  joinDigestWindowHours: 6,
  rejoinCooldownDays: 7,
  emailsPerRecipientPerDay: 20,
  defaultEmailsPerDay: 500,
  /** Queue deliveries per email: the first plus the mailer's `max_retries` (5); then the row is marked failed. */
  maxDeliveryAttempts: 6,
  /** A 'sending' claim older than this belongs to a mailer that stopped; another delivery may take it over. */
  claimTimeoutMinutes: 10,
} as const;

/** Days a group can meet on; the reminders find the next meeting from the day, start time and time zone. */
export const meetingWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type MeetingWeekday = (typeof meetingWeekdays)[number];

/** Meeting reminders, in hours before the meeting starts: one the day before and one on the day. */
export const MEETING_REMINDER_LEADS = { day_before: 24, same_day: 2 } as const;
export type MeetingReminderLead = keyof typeof MEETING_REMINDER_LEADS;

/** The canonical IANA name of a time zone, or null when the runtime doesn't know it. */
export function canonicalTimeZone(value: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Group icons (app pages only): stored privately in R2 and served through short-lived signed URLs. */
export const ICON_LIMITS = {
  maxBytes: 256 * 1024,
  maxPixels: 512,
  uploadsPerUserPerDay: 10,
  uploadsPerGroupPerDay: 5,
  contentTypes: ['image/png', 'image/jpeg', 'image/webp'],
} as const;
export type IconContentType = (typeof ICON_LIMITS.contentTypes)[number];

export const notificationKinds = ['join_request', 'join_approved', 'join_rejected', 'group_deleted', 'icon_removed', 'account_banned', 'account_restored', 'meeting_reminder'] as const;
export type NotificationKind = (typeof notificationKinds)[number];
/** Notices about the account itself (ban and restore): sent even to users who turned service emails off. */
export const accountNoticeKinds: readonly NotificationKind[] = ['account_banned', 'account_restored'];
/** A ban record is deleted this many years after the ban or its last renewal, which lifts the ban. */
export const BAN_RETENTION_YEARS = 2;
/** The program's own address (Cloudflare Email Routing): replies to notices, abuse reports and data requests. */
export const STUDY_GROUPS_EMAIL = 'groups@fbrissi.dev';

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'URL must use http or https');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const reasonSchema = trimmed(LIMITS.reason.min, LIMITS.reason.max);
/** The one error for a missing, short or long moderation reason, from the API and the admin dialogs alike. */
export const REASON_REQUIRED_MESSAGE = `A reason of ${LIMITS.reason.min} to ${LIMITS.reason.max} characters is required.`;

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

/**
 * Group names go into emails, so they must not carry links. Any host-like text is refused, in any case: a scheme
 * (`https://`, `mailto:`), `www.`, an IPv4 address, or any `label.tld` (a dot followed by 2 or more letters, or a punycode `xn--` label). Common
 * tech names with a dot are allowed first: anything ending in `.js` (Node.js, Vue.js, Next.js; `.js` is not a
 * top-level domain), ASP.NET, VB.NET, ADO.NET and Socket.IO, and `.NET` on its own. They only count when nothing
 * host-like follows (`node.js.com` is still refused).
 */
const techNames = /\b(?:[a-z0-9-]+\.js|asp\.net|vb\.net|ado\.net|socket\.io)\b(?!\.[a-z0-9])/gi;
const schemeLike = /[a-z][a-z0-9+.-]*:\/\/|\b(?:https?|ftp|file|mailto|javascript|data|tel|sms|ws|wss):/i;
const hostLike = /(?:^|[^a-z0-9-])(?:[a-z0-9-]+\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})(?![a-z0-9-])/i;
const ipv4Like = /\b\d{1,3}(?:\.\d{1,3}){3}\b/;

export function looksLikeLink(value: string): boolean {
  const text = value.replace(techNames, ' ');
  return schemeLike.test(text) || /www\./i.test(text) || hostLike.test(text) || ipv4Like.test(text);
}

export const groupNameUrlMessage = "Group names can't contain links or web addresses.";

/**
 * Text other people see (display names, group names and summaries) can't hide or reorder characters: zero-width
 * characters (U+200B–U+200F, U+FEFF) and bidirectional controls (U+202A–U+202E, U+2066–U+2069) are refused, and so is
 * an email address.
 */
const invisibleCharacters = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;
const emailLike = /[^\s@]+@[^\s@]+\.[^\s@]+/;
export const invisibleCharactersMessage = 'Remove invisible or text-direction characters.';
export const emailInTextMessage = "Don't include an email address.";

export function hasInvisibleCharacters(value: string): boolean {
  return invisibleCharacters.test(value);
}

export function looksLikeEmail(value: string): boolean {
  return emailLike.test(value);
}

const visibleText = (min: number, max: number) => trimmed(min, max)
  .refine((value) => !hasInvisibleCharacters(value), invisibleCharactersMessage)
  .refine((value) => !looksLikeEmail(value), emailInTextMessage);

/** Validation messages written for people; the API returns them as the error instead of "Invalid request". */
export const friendlyValidationMessages: readonly string[] = [groupNameUrlMessage, invisibleCharactersMessage, emailInTextMessage];

export const groupProfileSchema = z.object({
  name: visibleText(LIMITS.groupName.min, LIMITS.groupName.max).refine((value) => !looksLikeLink(value), groupNameUrlMessage),
  summary: visibleText(LIMITS.groupSummary.min, LIMITS.groupSummary.max),
  rules: z.array(trimmed(1, 300)).max(30),
  meetingDay: z.enum(meetingWeekdays),
  meetingStart: time,
  meetingEnd: time,
  timezone: trimmed(1, 64).transform((value, context) => {
    const zone = canonicalTimeZone(value);
    if (zone) return zone;
    context.addIssue({ code: 'custom', message: 'Unknown time zone' });
    return z.NEVER;
  }),
  meetingUrl: httpUrl.nullable(),
  moderationMode: z.enum(moderationModes),
  listed: z.boolean(),
  /** Reminder emails to the members before each meeting. Optional so a page loaded before this field existed keeps the setting. */
  meetingReminders: z.boolean().optional(),
  /** Whether a join request needs the access code. Optional so a page loaded before this field existed keeps the setting. */
  requiresAccessCode: z.boolean().optional(),
});

export const createGroupSchema = groupProfileSchema.extend({
  acceptContentPolicy: z.literal(true),
});

export const joinGroupSchema = z.object({
  /** Checked only when the group requires the access code; otherwise ignored. */
  code: z.string().trim().max(100).optional(),
  message: z.string().trim().max(LIMITS.joinMessage).optional(),
});

/** Re-acceptance covers only the documents whose version changed; the route checks that each of them is accepted. */
export const acceptPoliciesSchema = z.object({
  acceptTerms: z.literal(true).optional(),
  acceptPrivacy: z.literal(true).optional(),
});

export const signupSchema = z.object({
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  confirmAge: z.literal(true),
});

export const updateProfileSchema = z.object({
  displayName: visibleText(LIMITS.displayName.min, LIMITS.displayName.max),
});

export const emailPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal(true),
});

export const banSchema = z.object({
  reason: reasonSchema,
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
export type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>;

export interface EmailPreferencesResponse {
  emailEnabled: boolean;
}

export interface CurrentUser {
  id: string;
  displayName: string;
  isPlatformAdmin: boolean;
  needsConsent: boolean;
  /** The documents whose current version the user hasn't accepted yet. */
  pendingConsents: PolicyDocument[];
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

/** A group's weekly meeting as stored: wall-clock values in its IANA time zone. Never carries the meeting link. */
export interface GroupSchedule {
  meetingDay: string;
  meetingStart: string;
  meetingEnd: string;
  timezone: string;
}

export interface GroupInfo extends GroupCard {
  /** Short-lived signed URL of the group icon, or null. */
  iconUrl: string | null;
  rules: string[];
  meetingDay: string;
  meetingStart: string;
  meetingEnd: string;
  timezone: string;
  meetingUrl: string | null;
  moderationMode: ModerationMode;
  listed: boolean;
  meetingReminders: boolean;
  requiresAccessCode: boolean;
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
  iconUrl: string | null;
}

export interface PendingGroupRequest extends GroupCard {
  requestedAt: string;
}

/** A request the owner rejected less than the cooldown ago: the user can ask again from `canAskAgainAt`. */
export interface RejectedGroupRequest extends GroupCard {
  canAskAgainAt: string;
}

/**
 * When a rejected requester can ask again, in Brasília time (the program's reference time zone), with the exact
 * moment so the day shown is never early: "November 23, 2026 at 9:00 AM (Brasília time)".
 */
export function formatAskAgainAt(iso: string): string {
  const moment = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
  return `${moment.replace(/\s/g, ' ')} (Brasília time)`;
}

export interface MyGroupsResponse {
  groups: MyGroup[];
  pending: PendingGroupRequest[];
  rejected: RejectedGroupRequest[];
  notices: ModerationNotice[];
}

/** What anyone may see of a group before joining: never the access code or the meeting link. */
export type PublicGroup = GroupCard & GroupSchedule & { requiresAccessCode: boolean; iconUrl: string | null };

export interface GroupListResponse {
  /** Listed groups only, each with its schedule and signed icon URL (or null); the response is cached for a minute. */
  groups: PublicGroup[];
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

export interface AdminUser {
  id: string;
  displayName: string;
  createdAt: string;
  ownedGroups: number;
  isPlatformAdmin: boolean;
  ban: { reason: string; createdAt: string; expiresAt: string } | null;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  nextCursor: string | null;
}

export interface ModerationLogResponse {
  actions: ModerationAction[];
  nextCursor: string | null;
}

export interface GroupPreviewResponse {
  group: PublicGroup;
  membership: Membership;
  /** Set while a rejected request's cooldown runs: the user can ask again from then. */
  canAskAgainAt: string | null;
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
  ownedGroups: (GroupCard & { icon: { contentType: string; updatedAt: string; base64: string } | null })[];
  memberships: { groupId: string; groupName: string; joinedAt: string }[];
  joinRequests: { groupId: string; groupName: string; status: string; message: string | null; createdAt: string; decidedAt: string | null }[];
  suggestions: { groupId: string; title: string; type: string; url: string | null; notes: string | null; status: string; createdAt: string }[];
  votes: { groupId: string; roundId: number; materialId: number; createdAt: string }[];
  emailPreferences: { emailEnabled: boolean };
  emails: { kind: string; groupId: string | null; groupName: string | null; reason: string | null; status: string; createdAt: string; sentAt: string | null }[];
}
