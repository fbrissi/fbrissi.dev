import {
  createGroupSchema,
  deleteGroupSchema,
  groupProfileSchema,
  joinGroupSchema,
  LIMITS,
  NOTIFICATION_LIMITS,
  formatAskAgainAt,
  REASON_REQUIRED_MESSAGE,
  reasonSchema,
  STUDY_GROUP_API_PREFIX,
  type AdminGroupListResponse,
  type CreateGroupResponse,
  type GroupListResponse,
  type GroupPreviewResponse,
  type GroupResponse,
  type GroupRole,
  type GroupInfo,
  type GroupSettings,
  type GroupSettingsResponse,
  type JoinRequestsResponse,
  type MembersResponse,
  type Membership,
  type ModerationLogResponse,
} from './contract';
import { randomId, timingSafeEqual } from './crypto';
import { enqueueNotifications, HttpError, iconUrl, NOTICE_WINDOW_MS, now, parseBody, removeIcons, type GroupContext, type RequestContext, type RouteResult, type UserContext } from './http';
import { decodeCursor, isUniqueConstraintError, type GroupRecord, type NewModerationAction, type OutboxNotice, type QueuedNotification } from './repository';
import { z } from 'zod';

const PAGE_SIZE = 24;
const LOG_PAGE_SIZE = 50;
const publicCacheSeconds = 60;
const logCursorSchema = z.string().regex(/^[1-9]\d{0,15}$/);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function requireId(value: string): number {
  return Number(value);
}

type LogEntry = Omit<NewModerationAction, 'actorId' | 'reason' | 'groupId' | 'ownerId'>;

export function moderationEntry(context: GroupContext, reason: string | undefined, entry: LogEntry): NewModerationAction {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new HttpError(400, REASON_REQUIRED_MESSAGE);
  return { ...entry, actorId: context.user.id, ownerId: context.group.ownerId, groupId: context.group.id, label: entry.label.slice(0, 120), reason: parsed.data };
}

/** Deletions by a platform admin who doesn't own the group need a 10–500 character reason and are audited (D7). */
export function adminLog(context: GroupContext, reason: string | undefined, entry: LogEntry): NewModerationAction | undefined {
  return context.role === 'platform_admin' ? moderationEntry(context, reason, entry) : undefined;
}

/** Member-visible group fields; the access code, owner ID and icon key never leave the settings and the server. */
async function groupProfile(context: GroupContext, group: GroupRecord): Promise<GroupInfo> {
  return {
    id: group.id,
    iconUrl: await iconUrl(context, group.icon),
    name: group.name,
    summary: group.summary,
    rules: group.rules,
    meetingDay: group.meetingDay,
    meetingStart: group.meetingStart,
    meetingEnd: group.meetingEnd,
    timezone: group.timezone,
    meetingUrl: group.meetingUrl,
    moderationMode: group.moderationMode,
    listed: group.listed,
  };
}

export function canParticipate(context: RequestContext): boolean {
  return context.isMember || (context.group !== null && context.group.ownerId === context.user?.id);
}

/**
 * Drops the cached first page of the public list after a change that affects it. The Cache API is per data center,
 * so other locations keep their copy until it expires (60 s).
 */
export async function purgePublicGroups(context: RequestContext): Promise<void> {
  await context.app.cache?.delete(new Request(`${context.url.origin}${STUDY_GROUP_API_PREFIX}/groups`));
}

export async function listPublicGroups(context: RequestContext): Promise<RouteResult> {
  const { app, url } = context;
  const cacheKey = new Request(url.toString());
  const cached = await app.cache?.match(cacheKey);
  if (cached) return cached;

  const result = await app.repository.listPublicGroups(decodeCursor(url.searchParams.get('cursor')), PAGE_SIZE);
  // Icons of listed groups are public (signed URLs valid 1 to 2 hours, so the 60-second cache never serves an expired one).
  const groups = await Promise.all(result.items.map(async ({ icon, ...group }) => ({ ...group, iconUrl: await iconUrl(context, icon) })));
  const body: GroupListResponse = { groups, nextCursor: result.nextCursor };
  const response = Response.json(body, {
    headers: { 'Cache-Control': `public, max-age=${publicCacheSeconds}`, 'X-Robots-Tag': 'noindex, nofollow' },
  });
  await app.cache?.put(cacheKey, response.clone());
  return response;
}

export async function createGroup(context: UserContext): Promise<RouteResult> {
  const input = groupProfileSchema.parse(await parseBody(context.request, createGroupSchema));
  const { repository } = context.app;
  if ((await repository.countOwnedGroups(context.user.id)) >= LIMITS.ownedGroupsPerUser) {
    throw new HttpError(409, `You can own at most ${LIMITS.ownedGroupsPerUser} groups`);
  }
  const group = await repository.createGroup({ ...input, id: randomId(10), ownerId: context.user.id, accessCode: randomId(12) }, now(context));
  await purgePublicGroups(context);
  return { status: 201, body: { group } satisfies CreateGroupResponse };
}

const REJOIN_COOLDOWN_MS = NOTIFICATION_LIMITS.rejoinCooldownDays * DAY_MS;

/** When a rejected requester can ask to join again, or null when no rejection is within the cooldown. */
async function canAskAgainAt(context: GroupContext): Promise<string | null> {
  const { app, group, user } = context;
  const rejectedAt = await app.repository.latestRejection(group.id, user.id, new Date(app.clock().getTime() - REJOIN_COOLDOWN_MS).toISOString());
  return rejectedAt ? new Date(Date.parse(rejectedAt) + REJOIN_COOLDOWN_MS).toISOString() : null;
}

export async function previewGroup(context: GroupContext): Promise<RouteResult> {
  const { group, user, isMember, app } = context;
  let membership: Membership = 'none';
  if (group.ownerId === user.id) membership = 'owner';
  else if (isMember) membership = 'member';
  else if (await app.repository.hasPendingRequest(group.id, user.id)) membership = 'pending';
  const body: GroupPreviewResponse = {
    group: { id: group.id, name: group.name, summary: group.summary, iconUrl: await iconUrl(context, group.icon) },
    membership,
    canAskAgainAt: membership === 'none' ? await canAskAgainAt(context) : null,
  };
  return { status: 200, body };
}

/** A wrong code fails with the same generic error every time; every attempt counts against the join rate limit. */
export async function joinGroup(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, joinGroupSchema);
  const { group, user, isMember, app } = context;
  if (isMember || group.ownerId === user.id) throw new HttpError(409, 'You are already a member of this group');
  if (await app.repository.hasPendingRequest(group.id, user.id)) throw new HttpError(409, 'You already asked to join this group');
  const again = await canAskAgainAt(context);
  if (again) throw new HttpError(409, `Your request to join this group was not approved. You can ask again after ${formatAskAgainAt(again)}.`);
  if (!timingSafeEqual(input.code, group.accessCode)) throw new HttpError(403, 'invalid_code');
  if ((await app.repository.countPendingRequestsByUser(user.id)) >= LIMITS.pendingRequestsPerUser) {
    throw new HttpError(409, `You can have at most ${LIMITS.pendingRequestsPerUser} pending requests`);
  }
  // E1: one digest to the owner per group every 6 hours, with no requester name or message. The unclaimed DevTalk
  // group has no owner and gets none until it is claimed.
  const clock = app.clock().getTime();
  const digest = group.ownerId
    ? { ownerId: group.ownerId, windowStart: new Date(clock - NOTIFICATION_LIMITS.joinDigestWindowHours * HOUR_MS).toISOString() }
    : undefined;
  let queued: QueuedNotification[];
  try {
    queued = await app.repository.createJoinRequest(group.id, user.id, input.message || null, now(context), digest);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'You already asked to join this group');
    throw error;
  }
  await enqueueNotifications(context, queued);
  return { status: 201, body: { status: 'pending' } };
}

export async function getGroup(context: GroupContext): Promise<RouteResult> {
  return { status: 200, body: { group: await groupProfile(context, context.group), role: context.role as GroupRole, canParticipate: canParticipate(context) } satisfies GroupResponse };
}

export async function listMembers(context: GroupContext): Promise<RouteResult> {
  return { status: 200, body: { members: await context.app.repository.listMembers(context.group.id) } satisfies MembersResponse };
}

export async function removeMember(context: GroupContext): Promise<RouteResult> {
  if (!(await context.app.repository.removeMember(context.group.id, context.params.userId))) throw new HttpError(404, 'Member not found');
  return null;
}

/** The owner can't leave, only delete the group (Q16). */
export async function leaveGroup(context: GroupContext): Promise<RouteResult> {
  if (context.group.ownerId === context.user.id) throw new HttpError(409, 'The owner can only delete the group');
  if (!(await context.app.repository.removeMember(context.group.id, context.user.id))) throw new HttpError(409, 'You are not a member of this group');
  return null;
}

async function settingsResponse(context: GroupContext, settings: GroupSettings): Promise<RouteResult> {
  const since = new Date(context.app.clock().getTime() - NOTICE_WINDOW_MS).toISOString();
  const notices = await context.app.repository.listGroupNotices(context.group.id, since);
  const body = { settings: { ...settings, iconUrl: await iconUrl(context, context.group.icon) }, notices, role: context.role as GroupRole };
  return { status: 200, body: body satisfies GroupSettingsResponse };
}

export async function getSettings(context: GroupContext): Promise<RouteResult> {
  return settingsResponse(context, { ...(await groupProfile(context, context.group)), accessCode: context.group.accessCode });
}

export async function updateSettings(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, groupProfileSchema);
  const settings = await context.app.repository.updateGroup(context.group.id, input, now(context));
  await purgePublicGroups(context);
  return settingsResponse(context, settings);
}

/** Rotating the code keeps existing members and pending requests (Q13). */
export async function rotateAccessCode(context: GroupContext): Promise<RouteResult> {
  return settingsResponse(context, await context.app.repository.rotateAccessCode(context.group.id, randomId(12), now(context)));
}

export async function deleteGroup(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, deleteGroupSchema);
  if (input.confirmName.toLowerCase() !== context.group.name.trim().toLowerCase()) throw new HttpError(400, 'Type the group name to confirm');
  const { group } = context;
  const log = adminLog(context, input.reason, { action: 'delete_group', targetType: 'group', targetId: group.id, label: group.name });
  // E4: the owner learns about an admin deletion and its reason while there is still time to contest it.
  const notice: OutboxNotice | undefined = log && group.ownerId
    ? { userId: group.ownerId, kind: 'group_deleted', groupId: group.id, dedupeKey: `group_deleted:${group.id}`, payload: { groupName: group.name, reason: log.reason } }
    : undefined;
  const { queued, iconKeys } = await context.app.repository.deleteGroup(group.id, now(context), log, notice);
  await removeIcons(context, iconKeys);
  await purgePublicGroups(context);
  await enqueueNotifications(context, queued);
  return null;
}

export async function listRequests(context: GroupContext): Promise<RouteResult> {
  return { status: 200, body: { requests: await context.app.repository.listPendingRequests(context.group.id) } satisfies JoinRequestsResponse };
}

/** E2 and E3 share one dedupe key, so a request gets at most one decision email. */
function decisionNotice(context: GroupContext, request: { id: number; userId: string }, kind: 'join_approved' | 'join_rejected'): OutboxNotice {
  return { userId: request.userId, kind, groupId: context.group.id, dedupeKey: `join_decision:${request.id}`, payload: { groupName: context.group.name } };
}

export async function approveRequest(context: GroupContext): Promise<RouteResult> {
  const { repository } = context.app;
  const request = await repository.getPendingRequest(context.group.id, requireId(context.params.requestId));
  if (!request) throw new HttpError(404, 'Join request not found');
  if ((await repository.countMembers(context.group.id)) >= LIMITS.membersPerGroup) {
    throw new HttpError(409, `A group can have at most ${LIMITS.membersPerGroup} members`);
  }
  const ids = await repository.approveRequest(context.group.id, request, now(context), decisionNotice(context, request, 'join_approved'));
  await enqueueNotifications(context, ids);
  return null;
}

export async function rejectRequest(context: GroupContext): Promise<RouteResult> {
  const { repository } = context.app;
  const request = await repository.getPendingRequest(context.group.id, requireId(context.params.requestId));
  if (!request) throw new HttpError(404, 'Join request not found');
  const ids = await repository.rejectRequest(request.id, now(context), decisionNotice(context, request, 'join_rejected'));
  await enqueueNotifications(context, ids);
  return null;
}

/** Only the platform admin removes join request messages, always with a reason (5.3). */
export async function deleteRequestMessage(context: GroupContext): Promise<RouteResult> {
  if (!context.isPlatformAdmin) throw new HttpError(403, 'Forbidden');
  const { reason } = await parseBody(context.request, z.object({ reason: z.string() }));
  const id = requireId(context.params.requestId);
  const message = await context.app.repository.getRequestMessage(context.group.id, id);
  if (!message) throw new HttpError(404, 'Join request message not found');
  // The label never repeats the removed text (Q6: label and reason only, no content).
  const log = moderationEntry(context, reason, { action: 'delete_join_message', targetType: 'join_request', targetId: String(id), label: `Join request #${id}` });
  await context.app.repository.clearRequestMessage(id, log, now(context));
  return null;
}

export async function listAllGroups(context: RequestContext): Promise<RouteResult> {
  const result = await context.app.repository.listAllGroups(decodeCursor(context.url.searchParams.get('cursor')), PAGE_SIZE);
  return { status: 200, body: { groups: result.items, nextCursor: result.nextCursor } satisfies AdminGroupListResponse };
}

export async function moderationLog(context: RequestContext): Promise<RouteResult> {
  const cursor = logCursorSchema.safeParse(context.url.searchParams.get('cursor'));
  const result = await context.app.repository.listModerationLog(cursor.success ? Number(cursor.data) : null, LOG_PAGE_SIZE);
  return { status: 200, body: { actions: result.items, nextCursor: result.nextCursor } satisfies ModerationLogResponse };
}
