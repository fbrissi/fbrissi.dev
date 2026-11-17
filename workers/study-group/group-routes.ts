import {
  createGroupSchema,
  deleteGroupSchema,
  groupProfileSchema,
  joinGroupSchema,
  LIMITS,
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
import { HttpError, NOTICE_WINDOW_MS, now, parseBody, type GroupContext, type RequestContext, type RouteResult, type UserContext } from './http';
import { decodeCursor, isUniqueConstraintError, type GroupRecord, type NewModerationAction } from './repository';
import { z } from 'zod';

const PAGE_SIZE = 24;
const LOG_PAGE_SIZE = 50;
const publicCacheSeconds = 60;
const logCursorSchema = z.string().regex(/^[1-9]\d{0,15}$/);

export function requireId(value: string): number {
  return Number(value);
}

type LogEntry = Omit<NewModerationAction, 'actorId' | 'reason' | 'groupId'>;

function moderationEntry(context: GroupContext, reason: string | undefined, entry: LogEntry): NewModerationAction {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new HttpError(400, 'A reason of 10 to 500 characters is required');
  return { ...entry, actorId: context.user.id, groupId: context.group.id, label: entry.label.slice(0, 120), reason: parsed.data };
}

/** Deletions by a platform admin who doesn't own the group need a 10–500 character reason and are audited (D7). */
export function adminLog(context: GroupContext, reason: string | undefined, entry: LogEntry): NewModerationAction | undefined {
  return context.role === 'platform_admin' ? moderationEntry(context, reason, entry) : undefined;
}

/** Member-visible group fields; the access code and owner ID never leave the settings and the server. */
function groupProfile(group: GroupRecord): GroupInfo {
  return {
    id: group.id,
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
  const body: GroupListResponse = { groups: result.items, nextCursor: result.nextCursor };
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

export async function previewGroup(context: GroupContext): Promise<RouteResult> {
  const { group, user, isMember, app } = context;
  let membership: Membership = 'none';
  if (group.ownerId === user.id) membership = 'owner';
  else if (isMember) membership = 'member';
  else if (await app.repository.hasPendingRequest(group.id, user.id)) membership = 'pending';
  return { status: 200, body: { group: { id: group.id, name: group.name, summary: group.summary }, membership } satisfies GroupPreviewResponse };
}

/** A wrong code fails with the same generic error every time; every attempt counts against the join rate limit. */
export async function joinGroup(context: GroupContext): Promise<RouteResult> {
  const input = await parseBody(context.request, joinGroupSchema);
  const { group, user, isMember, app } = context;
  if (isMember || group.ownerId === user.id) throw new HttpError(409, 'You are already a member of this group');
  if (await app.repository.hasPendingRequest(group.id, user.id)) throw new HttpError(409, 'You already asked to join this group');
  if (!timingSafeEqual(input.code, group.accessCode)) throw new HttpError(403, 'invalid_code');
  if ((await app.repository.countPendingRequestsByUser(user.id)) >= LIMITS.pendingRequestsPerUser) {
    throw new HttpError(409, `You can have at most ${LIMITS.pendingRequestsPerUser} pending requests`);
  }
  try {
    await app.repository.createJoinRequest(group.id, user.id, input.message || null, now(context));
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'You already asked to join this group');
    throw error;
  }
  return { status: 201, body: { status: 'pending' } };
}

export async function getGroup(context: GroupContext): Promise<RouteResult> {
  return { status: 200, body: { group: groupProfile(context.group), role: context.role as GroupRole, canParticipate: canParticipate(context) } satisfies GroupResponse };
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
  return { status: 200, body: { settings, notices, role: context.role as GroupRole } satisfies GroupSettingsResponse };
}

export async function getSettings(context: GroupContext): Promise<RouteResult> {
  return settingsResponse(context, { ...groupProfile(context.group), accessCode: context.group.accessCode });
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
  const log = adminLog(context, input.reason, { action: 'delete_group', targetType: 'group', targetId: context.group.id, label: context.group.name });
  await context.app.repository.deleteGroup(context.group.id, now(context), log);
  await purgePublicGroups(context);
  return null;
}

export async function listRequests(context: GroupContext): Promise<RouteResult> {
  return { status: 200, body: { requests: await context.app.repository.listPendingRequests(context.group.id) } satisfies JoinRequestsResponse };
}

export async function approveRequest(context: GroupContext): Promise<RouteResult> {
  const { repository } = context.app;
  const request = await repository.getPendingRequest(context.group.id, requireId(context.params.requestId));
  if (!request) throw new HttpError(404, 'Join request not found');
  if ((await repository.countMembers(context.group.id)) >= LIMITS.membersPerGroup) {
    throw new HttpError(409, `A group can have at most ${LIMITS.membersPerGroup} members`);
  }
  await repository.approveRequest(context.group.id, request, now(context));
  return null;
}

export async function rejectRequest(context: GroupContext): Promise<RouteResult> {
  const { repository } = context.app;
  const request = await repository.getPendingRequest(context.group.id, requireId(context.params.requestId));
  if (!request) throw new HttpError(404, 'Join request not found');
  await repository.rejectRequest(request.id, now(context));
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
